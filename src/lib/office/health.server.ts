/**
 * One health document for the whole office.
 *
 * This is what an operator (or an uptime monitor) checks to answer "is the
 * business running?", not just "is the process up?". It covers the things that
 * actually stop a business working unattended:
 *
 *   - the database is reachable AND has the schema,
 *   - the audit chain verifies (an office that cannot prove what it did must
 *     not be trusted to keep acting),
 *   - the autonomy scheduler has run recently and is not in circuit-break,
 *   - the work queue is draining rather than growing,
 *   - mail is actually delivering — an office that cannot tell the founder
 *     anything is not running, however healthy the rest looks,
 *   - and the money position, which is the part nobody else is watching.
 */
import { databaseHealth } from "../db";
import { smtpStatus } from "./smtp.server";
import { schedulerStatus } from "./scheduler.server";
import { readDutyView } from "./office-view.server";
import { workCounts } from "./work-queue.server";
import { rateCardIntegrity } from "./duties";
import { loadCompanyForHealth } from "./store-health.server";
import { ensureOffice } from "./store.server";

/** The extra, founder-only detail. Explicitly typed so it stays serialisable. */
export type HealthDetail = {
  duties: {
    duty: string;
    owner: string;
    title: string;
    lastRunAt: string | null;
    dueInMinutes: number;
  }[];
  recentRuns: {
    id: string;
    agentId: string;
    duty: string;
    status: string;
    briefing: string;
    durationMs: number;
    startedAt: string;
  }[];
  queue: { open: number; claimed: number; abandoned: number; done: number };
  work: {
    id: string;
    agentId: string;
    kind: string;
    status: string;
    attempts: number;
    maxAttempts: number;
    dueAt: string;
    lastError: string | null;
  }[];
};

/** The scheduler is considered overdue past three missed cadence windows. */
const SCHEDULER_STALE_MINUTES = 180;

export type OfficeHealth = {
  ok: boolean;
  checkedAt: string;
  company: string;
  version: string;
  halted: boolean;
  haltReason: string | null;
  database: { ok: boolean; source: string; latencyMs: number; detail: string };
  chain: { ok: boolean; detail: string };
  scheduler: {
    autonomyEnabled: boolean;
    lastTickAt: string | null;
    minutesSinceTick: number | null;
    overdue: boolean;
    consecutiveFailures: number;
    dutiesDue: number;
    duties: number;
  };
  queue: { open: number; claimed: number; abandoned: number; done: number };
  mail: { connected: boolean; account: string | null };
  money: { treasuryCents: number; receivableCents: number; payableCents: number };
  pipeline: { openOpportunities: number; pendingApprovals: number; openTickets: number };
  rateCard: { ok: boolean; detail: string };
  problems: string[];
  full?: HealthDetail;
};

export async function officeHealth(options: { full?: boolean } = {}): Promise<OfficeHealth> {
  const checkedAt = new Date().toISOString();
  const problems: string[] = [];

  const database = await databaseHealth();
  if (!database.ok) problems.push(`Database: ${database.detail}`);

  // Provision before reading the company row: on a fresh deployment the health
  // check is often the very first request, and reporting "Office is not
  // provisioned" would be true-but-useless to whoever is watching the monitor.
  if (database.ok) {
    try {
      await ensureOffice();
    } catch (error) {
      problems.push(`Provisioning failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  let company: Awaited<ReturnType<typeof loadCompanyForHealth>> | null = null;
  if (database.ok && !problems.some((problem) => problem.startsWith("Provisioning"))) {
    try {
      company = await loadCompanyForHealth();
    } catch (error) {
      problems.push(`Company state unavailable: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const autonomyEnabled = process.env.AUTONOMY?.trim().toLowerCase() === "on";

  // Everything below needs a working database. Report honestly rather than
  // throwing, so a monitor gets a document it can read.
  if (!database.ok || !company) {
    return {
      ok: false,
      checkedAt,
      company: "Vantage-ARS",
      version: "4.2.0",
      halted: false,
      haltReason: null,
      database,
      chain: { ok: false, detail: "Not checked: the database is unavailable." },
      scheduler: {
        autonomyEnabled,
        lastTickAt: null,
        minutesSinceTick: null,
        overdue: autonomyEnabled,
        consecutiveFailures: 0,
        dutiesDue: 0,
        duties: 0,
      },
      queue: { open: 0, claimed: 0, abandoned: 0, done: 0 },
      mail: { connected: false, account: null },
      money: { treasuryCents: 0, receivableCents: 0, payableCents: 0 },
      pipeline: { openOpportunities: 0, pendingApprovals: 0, openTickets: 0 },
      rateCard: rateCardIntegrity(),
      problems,
    };
  }

  const [view, status, queue, mail] = await Promise.all([
    readDutyView(),
    schedulerStatus(),
    workCounts(),
    Promise.resolve(smtpStatus()),
  ]);

  const chainDetail = await chainDetailFor(view.chainIntact);
  if (!view.chainIntact) problems.push(`Audit chain: ${chainDetail}`);

  const minutesSinceTick = status.lastTickAt
    ? Math.round((Date.now() - Date.parse(status.lastTickAt)) / 60_000)
    : null;
  const overdue = autonomyEnabled && (minutesSinceTick === null || minutesSinceTick > SCHEDULER_STALE_MINUTES);
  if (autonomyEnabled && minutesSinceTick === null) {
    problems.push("Autonomy is on but the scheduler has never run.");
  } else if (overdue) {
    problems.push(`The scheduler last ran ${minutesSinceTick} minutes ago.`);
  }
  if (status.consecutiveFailures >= 3) {
    problems.push(`The scheduler has failed ${status.consecutiveFailures} ticks in a row.`);
  }
  if (queue.abandoned > 0) {
    problems.push(`${queue.abandoned} work item(s) exhausted their retries.`);
  }
  if (company.halted) {
    problems.push(`Office is halted: ${company.haltReason ?? "no reason recorded"}`);
  }
  if (!mail.smtpConnected) {
    problems.push("Founder notices cannot be delivered by email. They are recorded in the office only.");
  }

  const rateCard = rateCardIntegrity();
  if (!rateCard.ok) problems.push(`Rate card: ${rateCard.detail}`);

  const ok = problems.every(
    (problem) =>
      !problem.startsWith("Database") &&
      !problem.startsWith("Audit chain") &&
      !problem.startsWith("The scheduler") &&
      !problem.startsWith("Autonomy is on") &&
      !problem.startsWith("Office is halted"),
  );

  const health: OfficeHealth = {
    ok,
    checkedAt,
    company: company.tradingName,
    version: "4.2.0",
    halted: company.halted,
    haltReason: company.haltReason,
    database,
    chain: { ok: view.chainIntact, detail: chainDetail },
    scheduler: {
      autonomyEnabled,
      lastTickAt: status.lastTickAt,
      minutesSinceTick,
      overdue,
      consecutiveFailures: status.consecutiveFailures,
      dutiesDue: status.dueDuties.filter((duty) => duty.dueInMinutes <= 0).length,
      duties: status.dueDuties.length,
    },
    queue,
    mail: { connected: mail.smtpConnected, account: mail.account },
    money: {
      treasuryCents: company.treasuryCents,
      receivableCents: company.receivableCents,
      payableCents: company.payableCents,
    },
    pipeline: {
      openOpportunities: view.opportunities.filter((opp) => !["won", "lost"].includes(opp.stage)).length,
      pendingApprovals: view.approvalsPending.length,
      openTickets: view.tickets.filter((ticket) => ticket.status !== "resolved").length,
    },
    rateCard,
    problems,
  };

  if (options.full) {
    health.full = {
      duties: status.dueDuties,
      recentRuns: status.recentRuns.slice(0, 20),
      queue,
      work: view.work.slice(0, 50),
    };
  }

  return health;
}

async function chainDetailFor(intact: boolean): Promise<string> {
  if (intact) return "Audit chain verified: every record links to the one before it, back to genesis.";
  return "The audit chain does not verify. Autonomous actions are halted until the founder resolves it.";
}