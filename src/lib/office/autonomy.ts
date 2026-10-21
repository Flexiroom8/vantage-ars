import type { DutyId, DutyView } from "./duties";

export type AutonomyPosture = "idle" | "steady" | "surge" | "recovery";

export type AutonomySignals = {
  openWork: number;
  dueWork: number;
  urgentTickets: number;
  unansweredInbound: number;
  waitingChats: number;
  undeliveredPeriods: number;
  consecutiveFailures: number;
};

export type AutonomyBudget = {
  posture: AutonomyPosture;
  maxItemsPerAgent: number;
  maxItemsTotal: number;
  cadenceScale: number;
  acceleratedDuties: readonly DutyId[];
};

export const RECOVERY_COOLDOWN_MINUTES = 30;
export const RECOVERY_FAILURES = 3;

const SURGE_OPEN_WORK = 12;
const SURGE_DUE_WORK = 8;
const INBOUND_WAIT_MINUTES = 30;
const CHAT_WAIT_MINUTES = 20;

const URGENT_SEVERITIES = new Set(["p0", "p1"]);

const ACCELERATED_DUTIES: readonly DutyId[] = [
  "foyer_intake",
  "close_win_handoff",
  "close_quote_notice",
  "desk_acknowledge",
  "desk_sla_watch",
  "desk_chat_reply",
  "desk_service_fulfilment",
  "desk_service_notice",
  "ledger_payment_notices",
  "ledger_subscription_billing",
];

const BUDGETS: Record<
  AutonomyPosture,
  { maxItemsPerAgent: number; maxItemsTotal: number; cadenceScale: number }
> = {
  idle: { maxItemsPerAgent: 4, maxItemsTotal: 24, cadenceScale: 1 },
  steady: { maxItemsPerAgent: 8, maxItemsTotal: 48, cadenceScale: 1 },
  surge: { maxItemsPerAgent: 12, maxItemsTotal: 72, cadenceScale: 0.5 },
  recovery: { maxItemsPerAgent: 3, maxItemsTotal: 18, cadenceScale: 1 },
};

function ageMinutes(iso: string | null, now: string): number {
  if (!iso) return 0;
  const then = Date.parse(iso);
  const current = Date.parse(now);
  if (!Number.isFinite(then) || !Number.isFinite(current)) return 0;
  return Math.max(0, (current - then) / 60_000);
}

export function autonomySignals(view: DutyView, consecutiveFailures: number): AutonomySignals {
  const open = view.work.filter((item) => item.status === "open");
  return {
    openWork: open.length,
    dueWork: open.filter((item) => {
      const due = Date.parse(item.dueAt);
      return Number.isFinite(due) && due <= Date.parse(view.now);
    }).length,
    urgentTickets: view.tickets.filter(
      (ticket) => ticket.status !== "resolved" && URGENT_SEVERITIES.has(ticket.severity),
    ).length,
    unansweredInbound: view.inbound.filter(
      (item) =>
        item.status !== "filed" && ageMinutes(item.createdAt, view.now) >= INBOUND_WAIT_MINUTES,
    ).length,
    waitingChats: view.chatThreads.filter(
      (thread) =>
        thread.status === "open" &&
        thread.unansweredCount > 0 &&
        ageMinutes(thread.lastMessageAt, view.now) >= CHAT_WAIT_MINUTES,
    ).length,
    undeliveredPeriods: view.billingCycles.filter(
      (cycle) => Boolean(cycle.invoiceId) && (!cycle.reportDocumentId || !cycle.notifiedAt),
    ).length,
    consecutiveFailures: Math.max(0, Math.floor(consecutiveFailures) || 0),
  };
}

export function autonomyPosture(signals: AutonomySignals, recovering = false): AutonomyPosture {
  if (recovering || signals.consecutiveFailures >= RECOVERY_FAILURES) return "recovery";
  if (
    signals.urgentTickets > 0 ||
    signals.unansweredInbound > 0 ||
    signals.waitingChats > 0 ||
    signals.undeliveredPeriods > 0 ||
    signals.openWork >= SURGE_OPEN_WORK ||
    signals.dueWork >= SURGE_DUE_WORK
  ) {
    return "surge";
  }
  return signals.openWork > 0 || signals.dueWork > 0 ? "steady" : "idle";
}

function budgetForPosture(posture: AutonomyPosture): AutonomyBudget {
  return {
    posture,
    ...BUDGETS[posture],
    acceleratedDuties: posture === "surge" ? ACCELERATED_DUTIES : [],
  };
}

export function autonomyBudget(signals: AutonomySignals, recovering = false): AutonomyBudget {
  return budgetForPosture(autonomyPosture(signals, recovering));
}

export function effectiveCadenceMinutes(
  duty: DutyId,
  baseMinutes: number,
  budget: AutonomyBudget,
): number {
  const base = Math.max(1, Math.floor(baseMinutes) || 1);
  if (budget.cadenceScale >= 1 || !budget.acceleratedDuties.includes(duty)) return base;
  return Math.max(5, Math.ceil(base * budget.cadenceScale));
}

export function effectiveCadenceForPosture(
  duty: DutyId,
  baseMinutes: number,
  posture: AutonomyPosture,
): number {
  return effectiveCadenceMinutes(duty, baseMinutes, budgetForPosture(posture));
}

export function shouldRecoverFromBreaker(
  minutesSinceTick: number | null,
  consecutiveFailures: number,
  failureLimit: number,
  cooldownMinutes = RECOVERY_COOLDOWN_MINUTES,
): boolean {
  if (consecutiveFailures < failureLimit) return false;
  if (minutesSinceTick === null || !Number.isFinite(minutesSinceTick)) return false;
  return minutesSinceTick >= Math.max(1, cooldownMinutes);
}

export function isAutonomyPosture(value: unknown): value is AutonomyPosture {
  return value === "idle" || value === "steady" || value === "surge" || value === "recovery";
}
