/**
 * Service fulfilment — turning the office's own records into something a
 * customer can read.
 *
 * Every number in a report comes from a row the office already holds. Remote
 * hours are recorded when the founder has logged time for the account and
 * period. When no time entries exist, the report falls back to an estimate
 * from the faults resolved and says so wherever it gives the figure. Nothing
 * is extrapolated silently, and nothing is promised. When the office has no
 * record of something, the report says so rather than filling the gap.
 *
 * The reports deliberately avoid the words that turn a measurement into a
 * promise. A report states what happened; it never says what will happen, and
 * it never claims an uptime, a response guarantee, or a service level that the
 * office has not written down.
 *
 * Pure module. No database, no clock, no environment.
 */
import { formatZar } from "./money";
import type { PlanDefinition } from "./plans";

/**
 * The office's internal targets, by severity.
 *
 * A target is measured from the moment a fault is raised to the moment its
 * resolution is recorded, because that is the one clock the office keeps.
 * The report quotes these same figures, so the label and the measurement
 * cannot drift apart.
 */
export const INTERNAL_TARGET_MINUTES: Record<string, number> = {
  p1: 4 * 60,
  p2: 24 * 60,
  p3: 7 * 24 * 60,
};

/** The same targets, written the way a customer reads them. */
export const INTERNAL_TARGET_LABELS: Record<string, string> = {
  p1: "P1 four hours",
  p2: "P2 24 hours",
  p3: "P3 seven days",
};

/**
 * The hours allowed for one fault when the remote hours worked in a period
 * are estimated from the fault count.
 *
 * The office records no time per fault, so the estimate is worked out from
 * the faults resolved and this allowance is stated in the report. One hour is
 * deliberately on the low side: a fault that took longer is under-reported
 * rather than over-billed.
 */
export const ESTIMATED_HOURS_PER_FAULT = 1;

export type RateFinding = {
  reference: string;
  amountCents: number;
  matched: boolean;
  detail: string;
};

export type FaultKind = { label: string; count: number };

export type ServiceFacts = {
  companyName: string;
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  /** Faults raised inside the period. */
  ticketsOpened: number;
  /** Faults whose resolution was recorded inside the period. */
  ticketsResolved: number;
  /** Faults still open on the record when the report was written. */
  ticketsOpen: number;
  /** The severity mix of the faults raised inside the period. */
  severityCounts: { p1: number; p2: number; p3: number };
  /** Faults whose raise-to-resolution time could be measured from the record. */
  measuredFaults: number;
  /** Of those, how many were resolved inside our published internal target. */
  withinTarget: number;
  invoicesIssued: number;
  invoicedCents: number;
  spendCents: number;
  quotesIssued: number;
  rateFindings: RateFinding[];
  openItems: string[];
  /** The remote hours the plan includes for the period. */
  includedHours: number;
  /**
   * The remote hours worked in the period. Read from time entries when any
   * exist, otherwise estimated from the faults resolved.
   */
  hoursUsed: number;
  /** Where `hoursUsed` came from, so the report can label it honestly. */
  hoursBasis: "recorded" | "estimated";
  /** How many time entries the recorded figure was read from. */
  timeEntries: number;
  /** The kinds of fault raised inside the period. */
  faultKinds: FaultKind[];
  /** The kinds of every fault on record for the account. */
  historyKinds: FaultKind[];
  /** Every fault on record for the account. */
  faultsOnRecord: number;
  /** Of those, the ones recorded as resolved. */
  faultsResolvedOnRecord: number;
};

export function emptyFacts(companyName: string, periodLabel: string): ServiceFacts {
  return {
    companyName,
    periodStart: "",
    periodEnd: "",
    periodLabel,
    ticketsOpened: 0,
    ticketsResolved: 0,
    ticketsOpen: 0,
    severityCounts: { p1: 0, p2: 0, p3: 0 },
    measuredFaults: 0,
    withinTarget: 0,
    invoicesIssued: 0,
    invoicedCents: 0,
    spendCents: 0,
    quotesIssued: 0,
    rateFindings: [],
    openItems: [],
    includedHours: 0,
    hoursUsed: 0,
    hoursBasis: "estimated",
    timeEntries: 0,
    faultKinds: [],
    historyKinds: [],
    faultsOnRecord: 0,
    faultsResolvedOnRecord: 0,
  };
}

function line(label: string, value: string): string {
  return `${label}: ${value}`;
}

function list(items: string[]): string {
  if (!items.length) return "  (none recorded)";
  return items.map((item) => `  - ${item}`).join("\n");
}

function severityLine(counts: ServiceFacts["severityCounts"]): string {
  return `P1 ${counts.p1}, P2 ${counts.p2}, P3 ${counts.p3}`;
}

/** Wrap a paragraph so the report reads the same on every line. */
function paragraph(text: string, width = 78): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of text.split(" ")) {
    if (!current) current = word;
    else if (current.length + 1 + word.length <= width) current += ` ${word}`;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** The internal targets, written the way a customer reads them. */
function targetPhrase(): string {
  const labels = Object.values(INTERNAL_TARGET_LABELS);
  const last = labels[labels.length - 1];
  return `${labels.slice(0, -1).join(", ")} and ${last}`;
}

/** The allowance the remote-hours estimate is worked out from. */
function allowancePhrase(): string {
  const hours = ESTIMATED_HOURS_PER_FAULT;
  return `${hours} hour${hours === 1 ? "" : "s"} per fault resolved`;
}

/** How the invoices in the period stood against the published rate card. */
function rateCardLine(facts: ServiceFacts): string {
  if (!facts.rateFindings.length) return "no invoices in the period to check";
  const matched = facts.rateFindings.filter((finding) => finding.matched).length;
  const unmatched = facts.rateFindings.length - matched;
  return `${facts.rateFindings.length} invoice(s) checked, ${matched} matched a published rate line, ${unmatched} did not`;
}

/**
 * The footer every report carries. It is the truthfulness clause: this came
 * from the office's records, it covers one period, and it is not a guarantee.
 */
function footer(facts: ServiceFacts): string {
  return [
    "This report was compiled by the Vantage-ARS office from its own records",
    `for ${facts.periodLabel}. It describes what the record shows for that period and`,
    "is not a guarantee of future performance. VAT is added only where the",
    "invoice states it.",
  ].join("\n");
}

function managedSupportBody(facts: ServiceFacts): string {
  const support: string[] = [];
  if (facts.includedHours > 0) {
    support.push(line("Included remote hours", String(facts.includedHours)));
    if (facts.hoursBasis === "recorded") {
      support.push(
        line(
          "Remote hours used",
          `${facts.hoursUsed} hours recorded from ${facts.timeEntries} time entr${facts.timeEntries === 1 ? "y" : "ies"}.`,
        ),
      );
    } else {
      support.push(
        line(
          "Remote hours used",
          `an estimate of ${facts.hoursUsed} hours, worked out at ${allowancePhrase()} (${facts.ticketsResolved} faults). The office records no time per ticket, so this is an estimate, not a measured figure.`,
        ),
      );
    }
  } else {
    support.push(line("Faults handled in the period", String(facts.ticketsResolved)));
  }
  return [
    `Managed support plan — ${facts.periodLabel}`,
    "",
    line("Faults raised in the period", String(facts.ticketsOpened)),
    line("Faults resolved in the period", String(facts.ticketsResolved)),
    line("Faults still open on the record", String(facts.ticketsOpen)),
    line("Severity mix", severityLine(facts.severityCounts)),
    ...support,
    line("Quotes issued", String(facts.quotesIssued)),
    line("Invoices issued", `${facts.invoicesIssued} (${formatZar(facts.invoicedCents)})`),
    line("Total invoiced in the period", formatZar(facts.invoicedCents)),
    "",
    "Faults by kind",
    list(facts.faultKinds.map((kind) => `${kind.label} — ${kind.count}`)),
    "",
    "Still open on the record",
    list(facts.openItems),
  ].join("\n");
}

function healthWatchBody(facts: ServiceFacts): string {
  const target =
    facts.measuredFaults > 0
      ? `${facts.withinTarget} of ${facts.measuredFaults} measured faults were resolved inside our internal target`
      : "no fault in the period had both a recorded raise and a recorded resolution";
  return [
    `Remote health and spend watch — ${facts.periodLabel}`,
    "",
    line("Open faults", String(facts.ticketsOpen)),
    line("Faults raised in the period", String(facts.ticketsOpened)),
    line("Faults resolved in the period", String(facts.ticketsResolved)),
    line("Resolution against our internal targets", target),
    line("Invoices issued", `${facts.invoicesIssued} (${formatZar(facts.invoicedCents)})`),
    line("Total invoiced in the period", formatZar(facts.invoicedCents)),
    line("Quotes issued", String(facts.quotesIssued)),
    line("Spend checked against the published rate card", rateCardLine(facts)),
    "",
    "Still open on the record",
    list(facts.openItems),
    "",
    ...paragraph(
      `Our internal targets for closing a raised fault are ${targetPhrase()}. The office keeps one clock for a fault: the time from the fault being raised to its resolution being recorded. It keeps no separate first-response time, so none is given here. These are working targets, not a contractual service level.`,
    ),
  ].join("\n");
}

function serviceReportBody(facts: ServiceFacts): string {
  return [
    `Service report — ${facts.periodLabel}`,
    "",
    line("Faults raised in the period", String(facts.ticketsOpened)),
    line("Faults resolved in the period", String(facts.ticketsResolved)),
    line("Faults still open on the record", String(facts.ticketsOpen)),
    line("Severity mix", severityLine(facts.severityCounts)),
    line("Quotes issued", String(facts.quotesIssued)),
    line("Invoices issued", `${facts.invoicesIssued} (${formatZar(facts.invoicedCents)})`),
    line("Total invoiced in the period", formatZar(facts.invoicedCents)),
    "",
    "Faults by kind",
    list(facts.faultKinds.map((kind) => `${kind.label} — ${kind.count}`)),
    "",
    "Still open on the record",
    list(facts.openItems),
  ].join("\n");
}

function billingAuditBody(facts: ServiceFacts): string {
  const matched = facts.rateFindings.filter((finding) => finding.matched).length;
  const unmatched = facts.rateFindings.filter((finding) => !finding.matched);
  return [
    `Billing and rate compliance audit — ${facts.periodLabel}`,
    "",
    line("Invoices reviewed", String(facts.rateFindings.length)),
    line("Matched to a published rate line", String(matched)),
    line("Not matched", String(unmatched.length)),
    line("Total invoiced in the period", formatZar(facts.invoicedCents)),
    "",
    "Invoice by invoice",
    list(
      facts.rateFindings.map(
        (finding) =>
          `${finding.reference} — ${formatZar(finding.amountCents)} — ${finding.matched ? "matched" : "NOT MATCHED"} — ${finding.detail}`,
      ),
    ),
    "",
    "Nothing was adjusted. A figure that does not match a published rate line is",
    "reported for you to query, and is corrected only if we agree it is wrong.",
  ].join("\n");
}

function handoverBody(facts: ServiceFacts): string {
  return [
    `Infrastructure documentation and handover pack — ${facts.periodLabel}`,
    "",
    "What the office record shows for this account",
    line("Faults on record", String(facts.faultsOnRecord)),
    line("Faults resolved on record", String(facts.faultsResolvedOnRecord)),
    line("Faults raised in the period", String(facts.ticketsOpened)),
    line("Faults resolved in the period", String(facts.ticketsResolved)),
    line("Faults still open on the record", String(facts.ticketsOpen)),
    line("Severity mix", severityLine(facts.severityCounts)),
    line("Quotes issued", String(facts.quotesIssued)),
    line("Invoices issued", `${facts.invoicesIssued} (${formatZar(facts.invoicedCents)})`),
    line("Total invoiced in the period", formatZar(facts.invoicedCents)),
    "",
    "Faults by kind, every fault on record for this account",
    list(facts.historyKinds.map((kind) => `${kind.label} — ${kind.count}`)),
    "",
    "Open items to hand over",
    list(facts.openItems),
    "",
    "This pack describes what the office has recorded. It is not a site survey,",
    "and it does not document equipment or cabling the office has never seen.",
  ].join("\n");
}

function continuityBody(facts: ServiceFacts): string {
  const kinds = facts.historyKinds.length ? facts.historyKinds : facts.faultKinds;
  const repeat = kinds.filter((kind) => kind.count > 1);
  return [
    `Business continuity plan — ${facts.periodLabel}`,
    "",
    "Failure points the office has actually recorded for this account",
    list(
      (repeat.length ? repeat : kinds).map(
        (kind) => `${kind.label} — recorded ${kind.count} time(s)`,
      ),
    ),
    "",
    "Recovery order, most damaging first",
    list(
      kinds
        .slice()
        .sort((a, b) => b.count - a.count)
        .map((kind, index) => `${index + 1}. ${kind.label} — ${kind.count} recorded occurrence(s)`),
    ),
    "",
    "Gaps visible from the record",
    list(
      facts.openItems.length
        ? facts.openItems
        : ["No open items were on the record when this plan was written."],
    ),
    "",
    "What this period cost",
    line("Invoices issued", `${facts.invoicesIssued} (${formatZar(facts.invoicedCents)})`),
    line("Total invoiced in the period", formatZar(facts.invoicedCents)),
    "",
    "This plan is built from the faults the office has recorded. It is not a formal",
    "disaster recovery plan and it is not a compliance certification.",
  ].join("\n");
}

function slaReviewBody(facts: ServiceFacts): string {
  const share =
    facts.measuredFaults > 0
      ? `${Math.round((facts.withinTarget / facts.measuredFaults) * 100)}%`
      : "not measurable";
  return [
    `Service level and response review — ${facts.periodLabel}`,
    "",
    line("Faults raised in the period", String(facts.ticketsOpened)),
    line("Faults resolved in the period", String(facts.ticketsResolved)),
    line("Faults still open on the record", String(facts.ticketsOpen)),
    line("Severity mix", severityLine(facts.severityCounts)),
    line("Faults raised in the period with a recorded resolution", String(facts.measuredFaults)),
    line("Resolved inside our internal target", `${facts.withinTarget} (${share})`),
    line("Invoices issued", `${facts.invoicesIssued} (${formatZar(facts.invoicedCents)})`),
    line("Total invoiced in the period", formatZar(facts.invoicedCents)),
    "",
    ...paragraph(
      `Our internal targets for closing a raised fault are ${targetPhrase()}. One clock is kept for a fault: the time from the fault being raised to its resolution being recorded. The office keeps no separate first-response time, so no first-response figure is given here. The measured durations above are for the faults raised in the period that have since been resolved. These are working targets that we measure ourselves against. They are not a contractual service level and we do not sell them as one.`,
    ),
    "",
    "Faults by kind",
    list(facts.faultKinds.map((kind) => `${kind.label} — ${kind.count}`)),
  ].join("\n");
}

function quarterlyBody(facts: ServiceFacts): string {
  const kinds = facts.historyKinds.length ? facts.historyKinds : facts.faultKinds;
  const repeat = kinds.filter((kind) => kind.count > 1);
  return [
    `Quarterly infrastructure review — ${facts.periodLabel}`,
    "",
    line("Faults raised in the quarter", String(facts.ticketsOpened)),
    line("Faults resolved in the quarter", String(facts.ticketsResolved)),
    line("Faults still open on the record", String(facts.ticketsOpen)),
    line("Severity mix", severityLine(facts.severityCounts)),
    line("Faults on record for the account", String(facts.faultsOnRecord)),
    line("Quotes issued", String(facts.quotesIssued)),
    line("Invoices issued", `${facts.invoicesIssued} (${formatZar(facts.invoicedCents)})`),
    line("Total invoiced in the quarter", formatZar(facts.invoicedCents)),
    "",
    "Failure points the record repeats",
    list(
      (repeat.length ? repeat : kinds).map(
        (kind) => `${kind.label} — recorded ${kind.count} time(s)`,
      ),
    ),
    "",
    "Next quarter, in the order the record suggests",
    list([
      ...facts.openItems.map((item) => `Close the open item: ${item}`),
      ...(repeat.length
        ? repeat.map((kind) => `Investigate the repeated ${kind.label} failures (${kind.count}).`)
        : ["No repeat failure is visible in the record yet."]),
      "Agree which recommendation, if any, should be quoted as new work.",
    ]),
    "",
    ...paragraph(
      "This review is built from the office's own record for the quarter. It names what the record shows and does not claim a root cause it cannot evidence. Any recommendation that needs new work is quoted separately and is not authorised by this review.",
    ),
  ].join("\n");
}

function faultPatternBody(facts: ServiceFacts): string {
  const kinds = facts.historyKinds.length ? facts.historyKinds : facts.faultKinds;
  const ordered = kinds.slice().sort((a, b) => b.count - a.count);
  const repeat = ordered.filter((kind) => kind.count > 1);
  const share =
    facts.measuredFaults > 0
      ? `${Math.round((facts.withinTarget / facts.measuredFaults) * 100)}%`
      : "not measurable";
  return [
    `Fault pattern and incident review — ${facts.periodLabel}`,
    "",
    line("Faults on record for the account", String(facts.faultsOnRecord)),
    line("Faults resolved on record", String(facts.faultsResolvedOnRecord)),
    line("Faults raised in the period", String(facts.ticketsOpened)),
    line("Faults resolved in the period", String(facts.ticketsResolved)),
    line("Faults still open on the record", String(facts.ticketsOpen)),
    line("Severity mix", severityLine(facts.severityCounts)),
    line("Faults with a measured resolution", String(facts.measuredFaults)),
    line("Resolved inside our internal target", `${facts.withinTarget} (${share})`),
    "",
    "Fault kinds, most frequent first",
    list(ordered.map((kind) => `${kind.label} — ${kind.count} recorded`)),
    "",
    "Repeated failure points",
    list(
      repeat.length
        ? repeat.map((kind) => `${kind.label} — ${kind.count} recorded occurrences`)
        : ["No fault kind appears more than once on the record."],
    ),
    "",
    "Still open on the record",
    list(facts.openItems),
    "",
    ...paragraph(
      "This review reports patterns visible in the recorded faults and their measured resolution times. It does not claim a root cause beyond that record, and it does not promise that a repeated fault will not recur. Any remediation is new work and is quoted separately.",
    ),
  ].join("\n");
}

const BUILDERS: Record<string, (facts: ServiceFacts) => string> = {
  "managed-support": managedSupportBody,
  "health-watch": healthWatchBody,
  "service-report": serviceReportBody,
  "billing-audit": billingAuditBody,
  "handover-pack": handoverBody,
  "continuity-plan": continuityBody,
  "sla-review": slaReviewBody,
  "quarterly-review": quarterlyBody,
  "fault-pattern-review": faultPatternBody,
};

/**
 * Build the customer-facing body of a productised service.
 *
 * The body is assembled here, from facts, and only here. The agent never
 * writes the customer's text — it asks for the deliverable and the office
 * produces it.
 */
export function buildServiceReport(plan: PlanDefinition, facts: ServiceFacts): string {
  const builder = BUILDERS[plan.id];
  const body = builder ? builder(facts) : `Service delivered — ${facts.periodLabel}`;
  // The report always names the account it was compiled for. A report that
  // does not say whose it is can be filed against, or read by, the wrong
  // customer.
  return [`Prepared for ${facts.companyName}.`, "", body, "", "—", "", footer(facts)].join("\n");
}

/** A one-line summary of a report, for the office screens. */
export function summariseService(plan: PlanDefinition, facts: ServiceFacts): string {
  if (plan.id === "billing-audit") {
    const unmatched = facts.rateFindings.filter((finding) => !finding.matched).length;
    return `${facts.rateFindings.length} invoice(s) reviewed, ${unmatched} not matched to a published rate line.`;
  }
  if (plan.id === "sla-review" || plan.id === "fault-pattern-review") {
    return `${facts.measuredFaults} measured fault(s), ${facts.withinTarget} inside the internal target.`;
  }
  if (plan.id === "quarterly-review") {
    return `${facts.ticketsOpened} fault(s) raised this quarter, ${facts.openItems.length} open item(s) still on the record.`;
  }
  if (plan.id === "managed-support" || plan.id === "health-watch") {
    return `${facts.ticketsOpened} fault(s) raised, ${facts.ticketsResolved} resolved, ${facts.ticketsOpen} still open.`;
  }
  return `${facts.ticketsOpened} fault(s), ${facts.quotesIssued} quote(s), ${facts.invoicesIssued} invoice(s).`;
}
