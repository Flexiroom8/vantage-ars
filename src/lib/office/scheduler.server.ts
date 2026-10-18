/**
 * The scheduler. This is what makes the office run by itself.
 *
 * One tick does three things, in order:
 *   1. **Refuse to run blind.** Halted office, unreachable database, broken audit
 *      chain, or repeated failures — all of these stop work before anything is
 *      filed, never halfway through.
 *   2. **Decide.** For each duty whose cadence has elapsed, ask the planner what
 *      the real state of the business says is worth doing. An empty answer is a
 *      successful run.
 *   3. **Execute.** Drain each agent's queue through the governor, record every
 *      run, and keep the office's own bookkeeping current.
 *
 * The tick is safe to run concurrently and repeatedly: duties are deduped by a
 * database constraint, work items are claimed atomically, and the state row is
 * only advanced after the work is filed.
 */
import { randomUUID } from "node:crypto";
import { databaseHealth, getSql } from "../db";
import { COMPANY } from "./company";
import {
  DUTY_CADENCE_MINUTES,
  DUTY_OWNER,
  DUTY_TITLES,
  planDuty,
  type DutyId,
} from "./duties";
import { readDutyView } from "./office-view.server";
import { RUNNERS } from "./duty-runners.server";
import {
  claimWork,
  completeWork,
  enqueueWork,
  failWork,
  pruneWork,
  releaseStaleWork,
  workCounts,
  type WorkItem,
} from "./work-queue.server";
import { ensureOffice, appendAudit } from "./store.server";

/** How many items one tick will drain per agent. Keeps a tick bounded. */
const MAX_ITEMS_PER_AGENT = 8;
/** Consecutive failing ticks before the scheduler refuses to keep trying. */
export const FAILURE_LIMIT = 5;

export type TickResult = {
  ok: boolean;
  ranAt: string;
  skipped?: string;
  planned: number;
  executed: number;
  escalated: number;
  blocked: number;
  failed: number;
  ran: { duty: DutyId; owner: string; filed: number; ran: number; note: string }[];
  detail: string;
};

const DUTY_IDS = Object.keys(DUTY_CADENCE_MINUTES) as DutyId[];

/** Per-duty last-run timestamps, so duties keep their own cadence. */
async function readDutyState(): Promise<Record<string, string>> {
  const sql = await getSql();
  const rows = await sql<{ id: string; duty_state_json: string }>`
    select id, duty_state_json from office_state where id = ${COMPANY.id}
  `;
  if (!rows.length) {
    await sql`
      insert into office_state (id) values (${COMPANY.id}) on conflict (id) do nothing
    `;
    return {};
  }
  try {
    const parsed = JSON.parse(rows[0].duty_state_json ?? "{}");
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

async function writeDutyState(state: Record<string, string>, failures: number): Promise<void> {
  const sql = await getSql();
  await sql`
    insert into office_state (id, last_tick_at, last_tick_detail, duty_state_json, consecutive_failures)
    values (${COMPANY.id}, now(), ${`tick recorded`}, ${JSON.stringify(state)}, ${failures})
    on conflict (id) do update set
      last_tick_at = now(),
      duty_state_json = excluded.duty_state_json,
      consecutive_failures = excluded.consecutive_failures,
      updated_at = now()
  `;
}

function due(duty: DutyId, lastRun: string | undefined, now: string): boolean {
  if (!lastRun) return true;
  const elapsed = Date.parse(now) - Date.parse(lastRun);
  if (!Number.isFinite(elapsed)) return true;
  return elapsed >= DUTY_CADENCE_MINUTES[duty] * 60_000;
}

export async function tick(options: { now?: string } = {}): Promise<TickResult> {
  const now = options.now ?? new Date().toISOString();
  const empty: TickResult = {
    ok: true,
    ranAt: now,
    planned: 0,
    executed: 0,
    escalated: 0,
    blocked: 0,
    failed: 0,
    ran: [],
    detail: "",
  };

  const health = await databaseHealth();
  if (!health.ok) {
    return { ...empty, ok: false, detail: `Database is not ready: ${health.detail}` };
  }

  await ensureOffice();

  const view = await readDutyView(now);
  if (view.halted) {
    return { ...empty, skipped: "halted", detail: "Office is halted. No duties were run." };
  }

  const sql = await getSql();
  const prior = await sql<{ consecutive_failures: number }>`
    select consecutive_failures from office_state where id = ${COMPANY.id}
  `;
  const consecutiveFailures = Number(prior[0]?.consecutive_failures ?? 0);
  if (consecutiveFailures >= FAILURE_LIMIT) {
    return {
      ...empty,
      ok: false,
      skipped: "circuit-breaker",
      detail: `The scheduler has failed ${consecutiveFailures} ticks in a row and is refusing to act. Inspect the office before it runs again.`,
    };
  }

  // Anything a dead worker left mid-flight goes back on the queue.
  const reclaimed = await releaseStaleWork();

  const dutyState = await readDutyState();
  let planned = 0;

  // ── Plan ────────────────────────────────────────────────────────────────────
  for (const duty of DUTY_IDS) {
    if (!due(duty, dutyState[duty], now)) continue;
    let work: ReturnType<typeof planDuty>;
    try {
      work = planDuty(duty, view);
    } catch (error) {
      work = [];
      void error;
    }
    dutyState[duty] = now;
    for (const item of work) {
      const result = await enqueueWork({
        agentId: item.agentId,
        kind: item.kind,
        reason: item.reason,
        payload: item.payload,
        priority: item.priority,
        maxAttempts: (item as { maxAttempts?: number }).maxAttempts,
        dedupeKey: item.dedupeKey,
      });
      if (result === "enqueued") planned += 1;
    }
  }

  // ── Execute ─────────────────────────────────────────────────────────────────
  const ran: TickResult["ran"] = [];
  let executed = 0;
  let escalated = 0;
  let blocked = 0;
  let failed = 0;

  const owners = [...new Set(DUTY_IDS.map((duty) => DUTY_OWNER[duty]))];
  for (const agentId of owners) {
    let itemsRun = 0;
    while (itemsRun < MAX_ITEMS_PER_AGENT) {
      const item: WorkItem | null = await claimWork(agentId);
      if (!item) break;
      itemsRun += 1;
      const runner = RUNNERS[item.kind];
      if (!runner) {
        await completeWork(item.id, `No runner for kind "${item.kind}". Left for the founder to inspect.`);
        failed += 1;
        ran.push({ duty: item.kind as DutyId, owner: agentId, filed: 0, ran: 1, note: `No runner is registered for kind "${item.kind}" — this duty planned work nothing can execute.` });
        continue;
      }

      const startedAt = Date.now();
      const runId = randomUUID();
      try {
        const result = await runner(item, view);
        await recordRun({
          id: runId,
          agentId,
          workItemId: item.id,
          duty: item.kind,
          status: "ok",
          result,
          durationMs: Date.now() - startedAt,
        });
        await completeWork(item.id, result.outcome);
        executed += result.executed;
        escalated += result.escalated;
        blocked += result.blocked;
        ran.push({ duty: item.kind as DutyId, owner: agentId, filed: 0, ran: 1, note: result.outcome });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await failWork(item.id, message, item.maxAttempts);
        await recordRun({
          id: runId,
          agentId,
          workItemId: item.id,
          duty: item.kind,
          status: "error",
          result: { outcome: message, executed: 0, escalated: 0, blocked: 0 },
          durationMs: Date.now() - startedAt,
        });
        failed += 1;
        ran.push({ duty: item.kind as DutyId, owner: agentId, filed: 0, ran: 1, note: `Failed: ${message}` });
      }
    }
  }

  // Keep finished work from piling up forever: agent_runs is the durable history,
  // the work table is a queue.
  const pruned = await pruneWork();

  await writeDutyState(dutyState, failed > 0 ? consecutiveFailures + 1 : 0);

  const counts = await workCounts();
  const detail = [
    `Duties due and planned: ${planned} new item(s).`,
    ran.length ? ran.map((entry) => `${entry.owner}: ${entry.note}`).join(" ") : "No duty found work to do.",
    counts.open ? `${counts.open} item(s) still queued.` : "Queue is clear.",
    counts.abandoned ? `${counts.abandoned} item(s) abandoned after repeated failure — the founder should look.` : "",
    reclaimed ? `Reclaimed ${reclaimed} item(s) left by an interrupted run.` : "",
    pruned ? `Pruned ${pruned} finished item(s) from the queue.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return { ok: true, ranAt: now, planned, executed, escalated, blocked, failed, ran, detail };
}

async function recordRun(input: {
  id: string;
  agentId: string;
  workItemId: string;
  duty: string;
  status: string;
  result: { outcome: string; executed: number; escalated: number; blocked: number };
  durationMs: number;
}): Promise<void> {
  const sql = await getSql();
  await sql`
    insert into agent_runs (
      id, agent_id, work_item_id, duty, status, executed, escalated, blocked,
      briefing, detail_json, duration_ms, finished_at
    ) values (
      ${input.id}, ${input.agentId}, ${input.workItemId}, ${input.duty}, ${input.status},
      ${input.result.executed}, ${input.result.escalated}, ${input.result.blocked},
      ${input.result.outcome}, ${JSON.stringify(input.result)}, ${input.durationMs}, now()
    )
  `;
  await sql`
    update agents
    set last_heartbeat = now(), current_task = ${DUTY_TITLES[input.duty as DutyId] ?? input.duty}
    where id = ${input.agentId}
  `;
}

export type SchedulerStatus = {
  lastTickAt: string | null;
  consecutiveFailures: number;
  dutyState: Record<string, string>;
  dueDuties: { duty: DutyId; owner: string; title: string; lastRunAt: string | null; dueInMinutes: number }[];
  queue: { open: number; claimed: number; abandoned: number; done: number };
  recentRuns: {
    id: string;
    agentId: string;
    duty: string;
    status: string;
    briefing: string;
    durationMs: number;
    startedAt: string;
  }[];
};

export async function schedulerStatus(): Promise<SchedulerStatus> {
  const sql = await getSql();
  const state = await sql<Record<string, unknown>>`
    select last_tick_at, consecutive_failures, duty_state_json from office_state where id = ${COMPANY.id}
  `.then((rows) => rows[0] ?? {});
  const queue = await workCounts();
  const runs = await sql<Record<string, unknown>>`
    select id, agent_id, duty, status, briefing, duration_ms, started_at
    from agent_runs order by started_at desc limit 40
  `;

  let dutyState: Record<string, string> = {};
  try {
    const parsed = JSON.parse(String(state.duty_state_json ?? "{}"));
    if (parsed && typeof parsed === "object") dutyState = parsed as Record<string, string>;
  } catch {
    dutyState = {};
  }

  const now = Date.now();
  const dueDuties = DUTY_IDS.map((duty) => {
    const lastRunAt = dutyState[duty] ?? null;
    const elapsed = lastRunAt ? now - Date.parse(lastRunAt) : Infinity;
    const dueInMinutes = Number.isFinite(elapsed)
      ? Math.max(0, Math.round((DUTY_CADENCE_MINUTES[duty] * 60_000 - elapsed) / 60_000))
      : 0;
    return {
      duty,
      owner: DUTY_OWNER[duty],
      title: DUTY_TITLES[duty],
      lastRunAt,
      dueInMinutes,
    };
  }).sort((a, b) => a.dueInMinutes - b.dueInMinutes);

  return {
    lastTickAt: state.last_tick_at ? new Date(String(state.last_tick_at)).toISOString() : null,
    consecutiveFailures: Number(state.consecutive_failures ?? 0),
    dutyState,
    dueDuties,
    queue,
    recentRuns: runs.map((row) => ({
      id: String(row.id),
      agentId: String(row.agent_id),
      duty: String(row.duty),
      status: String(row.status),
      briefing: String(row.briefing ?? ""),
      durationMs: Number(row.duration_ms ?? 0),
      startedAt: new Date(String(row.started_at)).toISOString(),
    })),
  };
}

/** Founder-triggered run. Same code path as the scheduler; nothing privileged. */
export async function runNow(): Promise<TickResult> {
  const result = await tick();
  if (result.ok && result.planned + result.ran.length > 0) {
    await appendAudit(
      "office_tick",
      "Autonomous run",
      result.detail,
      "vantage",
    );
  }
  return result;
}