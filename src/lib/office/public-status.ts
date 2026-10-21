/**
 * The public readiness view of the office.
 *
 * This is deliberately a projection, not a redaction: the route never receives
 * the full health document, so there is no field to forget to remove. Money,
 * customers, delegation limits, mail accounts and the halt reason stay inside
 * the office; a visitor sees only whether the desk can answer, whether its
 * records verify, and whether scheduled work is current.
 *
 * It is a readiness check at the moment it is read. It is not a history, an
 * uptime measurement, a service level or a promise.
 */

export type PublicStatusState = "operational" | "degraded" | "halted";

export type PublicStatusCheck = {
  id: "records" | "record-integrity" | "scheduled-desk" | "published-rates" | "office-state";
  label: string;
  ok: boolean;
  detail: string;
};

/** Only the fields the public page is allowed to depend on. */
export type PublicStatusInput = {
  checkedAt: string;
  company: string;
  version: string;
  halted: boolean;
  database: { ok: boolean };
  chain: { ok: boolean };
  scheduler: {
    autonomyEnabled: boolean;
    overdue: boolean;
    consecutiveFailures: number;
  };
  rateCard: { ok: boolean };
};

export type PublicStatus = {
  ok: boolean;
  checkedAt: string;
  company: string;
  version: string;
  state: PublicStatusState;
  summary: string;
  checks: PublicStatusCheck[];
};

const FAILED_SCHEDULER_TICKS = 3;

function scheduledDesk(input: PublicStatusInput): PublicStatusCheck {
  const scheduler = input.scheduler;
  if (!scheduler.autonomyEnabled) {
    return {
      id: "scheduled-desk",
      label: "Scheduled desk",
      ok: true,
      detail: "Scheduled work is paused. The desk is being run manually.",
    };
  }
  if (scheduler.consecutiveFailures >= FAILED_SCHEDULER_TICKS) {
    return {
      id: "scheduled-desk",
      label: "Scheduled desk",
      ok: false,
      detail: "Scheduled work has failed repeatedly. Enquiries are still recorded for review.",
    };
  }
  if (scheduler.overdue) {
    return {
      id: "scheduled-desk",
      label: "Scheduled desk",
      ok: false,
      detail: "Scheduled work is behind. Enquiries are still recorded for review.",
    };
  }
  return {
    id: "scheduled-desk",
    label: "Scheduled desk",
    ok: true,
    detail: "Scheduled work is current.",
  };
}

/**
 * Map the office's own health facts to the public document.
 *
 * Every detail is written here, in code, from a boolean. Raw error strings and
 * database details are never passed through: they can contain table names,
 * connection strings or customer content.
 */
export function publicStatus(input: PublicStatusInput): PublicStatus {
  const checks: PublicStatusCheck[] = [
    {
      id: "records",
      label: "Office records",
      ok: input.database.ok,
      detail: input.database.ok
        ? "The office database is reachable and holds its schema."
        : "The office database could not be read. Enquiries may not be recorded right now.",
    },
    {
      id: "record-integrity",
      label: "Decision record",
      ok: input.chain.ok,
      detail: input.chain.ok
        ? "The decision record verifies back to its first entry."
        : "The decision record does not verify. New autonomous work is paused.",
    },
    scheduledDesk(input),
    {
      id: "published-rates",
      label: "Published prices",
      ok: input.rateCard.ok,
      detail: input.rateCard.ok
        ? "The public rate card and the office prices agree."
        : "The public rate card and office prices disagree. The office will not quote from an inconsistent card.",
    },
    {
      id: "office-state",
      label: "Office state",
      ok: !input.halted,
      detail: input.halted
        ? "The office is halted pending a founder decision. Enquiries are still recorded."
        : "The office is open and working inside its founder gates.",
    },
  ];

  const requiredFailed = checks.some((check) => !check.ok);
  const state: PublicStatusState = input.halted
    ? "halted"
    : requiredFailed
      ? "degraded"
      : "operational";

  const summary =
    state === "operational"
      ? "The desk is answering, its records are intact and its scheduled work is current."
      : state === "halted"
        ? "The office is halted pending a founder decision. Enquiries are still recorded for review."
        : "The desk is reachable, but one or more integrity or scheduling checks need attention.";

  return {
    ok: state === "operational",
    checkedAt: input.checkedAt,
    company: input.company,
    version: input.version,
    state,
    summary,
    checks,
  };
}
