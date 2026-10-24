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
 * The pace is adaptive. An idle office drains a small budget, ordinary work
 * gets the standard budget, and a queue or a waiting customer puts the office
 * into surge, where customer-response duties run sooner and the drain budget
 * rises. Repeated failures put it into recovery, where the budget shrinks. A
 * circuit-breaker that has had a clean cooldown probes the database, the chain
 * and the halt state, then resumes itself at the recovery budget.
 *
 * The tick is safe to run concurrently and repeatedly: duties are deduped by a
 * database constraint, work items are claimed atomically, and the state row is
 * only advanced after the work is filed.
 */
import { randomUUID } from "node:crypto";
import { databaseHealth, getSql } from "../db";
import {
  autonomyBudget,
  autonomySignals,
  effectiveCadenceForPosture,
  effectiveCadenceMinutes,
  isAutonomyPosture,
  RECOVERY_COOLDOWN_MINUTES,
  shouldRecoverFromBreaker,
  breakerOpened,
  type AutonomyPosture,
} from "./autonomy";
import { COMPANY } from "./company";
import { DUTY_CADENCE_MINUTES, DUTY_OWNER, DUTY_TITLES, planDuty, type DutyId } from "./duties";
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

/** Consecutive failing ticks before the scheduler refuses to keep trying. */
export const FAILURE_LIMIT = 5;

export type TickResult = {
  ok: boolean;
  ranAt: string;
  skipped?: string;
  posture: AutonomyPosture;
  budget: { maxItemsPerAgent: number; maxItemsTotal: number };
  recovered: boolean;
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

async function writeDutyState(
  state: Record<string, string>,
  failures: number,
  posture: AutonomyPosture,
  budget: number,
): Promise<void> {
  const sql = await getSql();
  await sql`
    insert into office_state (
      id, last_tick_at, last_tick_detail, duty_state_json, consecutive_failures,
      last_posture, last_budget
    )
    values (
      ${COMPANY.id}, now(), ${`tick recorded`}, ${JSON.stringify(state)}, ${failures},
      ${posture}, ${budget}
    )
    on conflict (id) do update set
      last_tick_at = now(),
      duty_state_json = excluded.duty_state_json,
      consecutive_failures = excluded.consecutive_failures,
      last_posture = excluded.last_posture,
      last_budget = excluded.last_budget,
      updated_at = now()
  `;
}

function due(
  duty: DutyId,
  lastRun: string | undefined,
  now: string,
  cadenceMinutes: number,
): boolean {
  if (!lastRun) return true;
  const elapsed = Date.parse(now) - Date.parse(lastRun);
  if (!Number.isFinite(elapsed)) return true;
  return elapsed >= cadenceMinutes * 60_000;
}

export async function tick(options: { now?: string } = {}): Promise<TickResult> {
  const now = options.now ?? new Date().toISOString();
  const empty: TickResult = {
    ok: true,
    ranAt: now,
    posture: "idle",
    budget: { maxItemsPerAgent: 0, maxItemsTotal: 0 },
    recovered: false,
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
  const prior = await sql<{ consecutive_failures: number; last_tick_at: string | null }>`
    select consecutive_failures, last_tick_at from office_state where id = ${COMPANY.id}
  `;
  const priorFailures = Number(prior[0]?.consecutive_failures ?? 0);
  let consecutiveFailures = priorFailures;
  const lastTickMs = prior[0]?.last_tick_at ? Date.parse(String(prior[0].last_tick_at)) : NaN;
  const minutesSinceTick = Number.isFinite(lastTickMs)
    ? (Date.parse(now) - lastTickMs) / 60_000
    : null;
  const chainBroken = !view.chainIntact;
  let recovered = false;

  if (consecutiveFailures >= FAILURE_LIMIT && !chainBroken) {
    if (
      !shouldRecoverFromBreaker(
        minutesSinceTick,
        consecutiveFailures,
        FAILURE_LIMIT,
        RECOVERY_COOLDOWN_MINUTES,
      )
    ) {
      return {
        ...empty,
        ok: false,
        skipped: "circuit-breaker",
        detail: `The scheduler has failed ${consecutiveFailures} ticks in a row and is refusing to act. A clean probe is allowed after ${RECOVERY_COOLDOWN_MINUTES} minutes.`,
      };
    }
    consecutiveFailures = 0;
    recovered = true;
    await appendAudit(
      "scheduler_recovered",
      "Scheduler recovered by self-check",
      `The scheduler had failed ${priorFailures} ticks in a row. The database, audit chain and halt state were clean after ${Math.round(minutesSinceTick ?? RECOVERY_COOLDOWN_MINUTES)} minutes, so it cleared the breaker and resumed at the recovery budget.`,
      "vantage",
    );
  }

  // Anything a dead worker left mid-flight goes back on the queue.
  const reclaimed = chainBroken ? 0 : await releaseStaleWork();

  const signals = autonomySignals(view, consecutiveFailures);
  const budget = autonomyBudget(signals, recovered || chainBroken);

  const dutyState = await readDutyState();
  let planned = 0;

  // ── Plan ────────────────────────────────────────────────────────────────────
  for (const duty of DUTY_IDS) {
    if (chainBroken) {
      if (duty !== "seal_chain_verify") continue;
    } else if (
      !due(
        duty,
        dutyState[duty],
        now,
        effectiveCadenceMinutes(duty, DUTY_CADENCE_MINUTES[duty], budget),
      )
    ) {
      continue;
    }
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
  let totalRun = 0;

  const owners = chainBroken ? ["seal"] : [...new Set(DUTY_IDS.map((duty) => DUTY_OWNER[duty]))];
  for (const agentId of owners) {
    let itemsRun = 0;
    while (itemsRun < budget.maxItemsPerAgent && totalRun < budget.maxItemsTotal) {
      const item: WorkItem | null = await claimWork(agentId);
      if (!item) break;
      itemsRun += 1;
      totalRun += 1;
      const runner = RUNNERS[item.kind];
      if (!runner) {
        await completeWork(
          item.id,
          `No runner for kind "${item.kind}". Left for the founder to inspect.`,
        );
        failed += 1;
        ran.push({
          duty: item.kind as DutyId,
          owner: agentId,
          filed: 0,
          ran: 1,
          note: `No runner is registered for kind "${item.kind}" — this duty planned work nothing can execute.`,
        });
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
        ran.push({
          duty: item.kind as DutyId,
          owner: agentId,
          filed: 0,
          ran: 1,
          note: result.outcome,
        });
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
        ran.push({
          duty: item.kind as DutyId,
          owner: agentId,
          filed: 0,
          ran: 1,
          note: `Failed: ${message}`,
        });
      }
    }
  }

  // Keep finished work from piling up forever: agent_runs is the durable history,
  // the work table is a queue.
  const pruned = chainBroken ? 0 : await pruneWork();

  const nextFailures = failed > 0 ? consecutiveFailures + 1 : 0;
  await writeDutyState(dutyState, nextFailures, budget.posture, budget.maxItemsTotal);

  if (breakerOpened(consecutiveFailures, failed > 0, FAILURE_LIMIT)) {
    await notifyFounderOnce(
      "The office stopped itself",
      `The scheduler failed ${nextFailures} ticks in a row and is refusing to act. It will probe again after ${RECOVERY_COOLDOWN_MINUTES} minutes if the database and the audit chain are clean. Nothing was spent.`,
      "/office",
    );
  }
  if (recovered) {
    await notifyFounderOnce(
      "The office resumed",
      "The scheduler cleared its own circuit breaker after a clean probe. Ordinary work is running again at the recovery pace.",
      "/office",
    );
  }

  const counts = await workCounts();
  const detail = [
    `Pace: ${budget.posture} (${budget.maxItemsPerAgent} per agent, ${budget.maxItemsTotal} total).`,
    recovered ? "The circuit breaker was cleared by a clean probe." : "",
    chainBroken
      ? "The audit chain does not verify; only SEAL ran and no ordinary work was planned."
      : "",
    `Duties due and planned: ${planned} new item(s).`,
    ran.length
      ? ran.map((entry) => `${entry.owner}: ${entry.note}`).join(" ")
      : "No duty found work to do.",
    counts.open ? `${counts.open} item(s) still queued.` : "Queue is clear.",
    counts.abandoned
      ? `${counts.abandoned} item(s) abandoned after repeated failure — the founder should look.`
      : "",
    reclaimed ? `Reclaimed ${reclaimed} item(s) left by an interrupted run.` : "",
    pruned ? `Pruned ${pruned} finished item(s) from the queue.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    ok: true,
    ranAt: now,
    posture: budget.posture,
    budget: { maxItemsPerAgent: budget.maxItemsPerAgent, maxItemsTotal: budget.maxItemsTotal },
    recovered,
    planned,
    executed,
    escalated,
    blocked,
    failed,
    ran,
    detail,
  };
}

async function notifyFounderOnce(title: string, detail: string, where: string): Promise<void> {
  try {
    const { deliverFounderNotice } = await import("./notify.server");
    const { founderOfficeAlertNotice } = await import("./notice");
    await deliverFounderNotice(founderOfficeAlertNotice({ title, detail, where }));
  } catch {
    // The halt is already in the books. A missed mail must not fail the tick.
  }
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
  posture: AutonomyPosture;
  budget: number;
  dutyState: Record<string, string>;
  dueDuties: {
    duty: DutyId;
    owner: string;
    title: string;
    lastRunAt: string | null;
    dueInMinutes: number;
  }[];
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
    select last_tick_at, consecutive_failures, duty_state_json, last_posture, last_budget
    from office_state where id = ${COMPANY.id}
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

  const posture: AutonomyPosture = isAutonomyPosture(state.last_posture)
    ? state.last_posture
    : "idle";
  const now = Date.now();
  const dueDuties = DUTY_IDS.map((duty) => {
    const lastRunAt = dutyState[duty] ?? null;
    const elapsed = lastRunAt ? now - Date.parse(lastRunAt) : Infinity;
    const cadence = effectiveCadenceForPosture(duty, DUTY_CADENCE_MINUTES[duty], posture);
    const dueInMinutes = Number.isFinite(elapsed)
      ? Math.max(0, Math.round((cadence * 60_000 - elapsed) / 60_000))
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
    posture,
    budget: Number(state.last_budget ?? 0),
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
    await appendAudit("office_tick", "Autonomous run", result.detail, "vantage");
  }
  return result;
}
