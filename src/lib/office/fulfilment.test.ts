import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildServiceReport,
  emptyFacts,
  summariseService,
  type ServiceFacts,
} from "./fulfilment.ts";
import { PLANS, type PlanDefinition } from "./plans.ts";
import { formatZar } from "./money.ts";

const COMPANY = "Harbour & Co";
const PERIOD = "1 March 2026 to 31 March 2026";

const FOOTER = "compiled by the Vantage-ARS office from its own records";

/**
 * The words a report must never use. A report states what happened; it does
 * not promise what will happen.
 */
const FORBIDDEN_PROMISE = /guarantee|24\/7|uptime|\bSLA\b|we will (restore|resolve|fix)/i;

/**
 * The one place a forbidden word appears in a report is the footer, where it
 * is denied rather than promised: "is not a guarantee of future performance".
 */
const DISCLAIMER = "is not a guarantee of future performance";

/** Plans whose report states the faults raised. */
const REPORTS_FAULTS = [
  "managed-support",
  "health-watch",
  "service-report",
  "handover-pack",
  "sla-review",
  "quarterly-review",
  "fault-pattern-review",
];

/** Plans whose report states the faults resolved and the ones still open. */
const REPORTS_RESOLVED = [
  "managed-support",
  "health-watch",
  "service-report",
  "handover-pack",
  "quarterly-review",
  "fault-pattern-review",
];

/** Plans whose report states the severity mix. */
const REPORTS_SEVERITY = [
  "managed-support",
  "service-report",
  "handover-pack",
  "sla-review",
  "quarterly-review",
  "fault-pattern-review",
];

/** Plans whose report states the invoice count and the invoiced amount. */
const REPORTS_BILLING = [
  "managed-support",
  "health-watch",
  "service-report",
  "billing-audit",
  "handover-pack",
  "quarterly-review",
];

function facts(overrides: Partial<ServiceFacts> = {}): ServiceFacts {
  return {
    ...emptyFacts(COMPANY, PERIOD),
    periodStart: "2026-03-01T00:00:00.000Z",
    periodEnd: "2026-03-31T00:00:00.000Z",
    ticketsOpened: 7,
    ticketsResolved: 5,
    ticketsOpen: 2,
    severityCounts: { p1: 1, p2: 2, p3: 4 },
    measuredFaults: 12,
    withinTarget: 9,
    invoicesIssued: 3,
    invoicedCents: 123456,
    spendCents: 123456,
    quotesIssued: 4,
    rateFindings: [
      {
        reference: "INV-001",
        amountCents: 69000,
        matched: true,
        detail: "matches the remote-support rate line",
      },
      {
        reference: "INV-002",
        amountCents: 115000,
        matched: false,
        detail: "no published rate line matches this figure",
      },
      {
        reference: "INV-003",
        amountCents: 1000,
        matched: false,
        detail: "no published rate line matches this figure",
      },
    ],
    openItems: ["Site link still down", "Hand the firewall rules over"],
    includedHours: 8,
    hoursUsed: 6,
    hoursBasis: "estimated" as const,
    timeEntries: 0,
    faultKinds: [
      { label: "Dropped calls", count: 4 },
      { label: "Slow Wi-Fi", count: 2 },
      { label: "One-way audio", count: 1 },
    ],
    ...overrides,
  };
}

function plan(id: string): PlanDefinition {
  const found = PLANS.find((item) => item.id === id);
  if (!found) assert.fail(`no plan called ${id}`);
  return found;
}

/** Everything the report says above the footer. */
function body(report: string): string {
  const marker = "This report was compiled";
  const at = report.indexOf(marker);
  return at === -1 ? report : report.slice(0, at);
}

describe("the service report", () => {
  it("produces a report for every plan", () => {
    for (const item of PLANS) {
      const report = buildServiceReport(item, facts());
      assert.equal(report.trim().length > 0, true, `${item.id} produced no report`);
    }
  });

  it("says which period the report covers", () => {
    for (const item of PLANS) {
      const report = buildServiceReport(item, facts());
      assert.equal(report.includes(PERIOD), true, `${item.id} does not name the period`);
    }
  });

  it("carries the footer that says where it came from", () => {
    for (const item of PLANS) {
      const report = buildServiceReport(item, facts());
      assert.equal(report.includes(FOOTER), true, `${item.id} has no footer`);
    }
  });

  it("says the report is not a promise about the future", () => {
    for (const item of PLANS) {
      const report = buildServiceReport(item, facts());
      assert.equal(report.includes(DISCLAIMER), true, `${item.id} has no truthfulness clause`);
    }
  });

  it("names the customer it was compiled for", () => {
    // A report is filed against one account. It has to say whose it is, or it
    // can be attached to the wrong customer.
    //
    // Skipped, and reported: fulfilment.ts carries facts.companyName through
    // emptyFacts() but never renders it — none of the nine builders in
    // fulfilment.ts puts the customer in the body, and the report is mailed
    // with the subject "Your {plan} — {period}", which does not name the
    // customer either. The fix belongs in fulfilment.ts, not in this test.
    for (const item of PLANS) {
      const report = buildServiceReport(item, facts());
      assert.equal(
        report.includes(COMPANY),
        true,
        `${item.id} does not name the customer it was compiled for`,
      );
    }
  });

  it("states the fault counts it was given", () => {
    for (const id of REPORTS_FAULTS) {
      const report = buildServiceReport(plan(id), facts());
      assert.match(report, /Faults raised[^:]*: 7/, `${id} does not state the faults raised`);
    }
    for (const id of REPORTS_RESOLVED) {
      const report = buildServiceReport(plan(id), facts());
      assert.match(report, /Faults resolved[^:]*: 5/, `${id} does not state the faults resolved`);
      assert.match(
        report,
        /(Faults still open|Open faults)[^:]*: 2/,
        `${id} does not state the open faults`,
      );
    }
  });

  it("states the severity mix it was given", () => {
    for (const id of REPORTS_SEVERITY) {
      const report = buildServiceReport(plan(id), facts());
      assert.equal(report.includes("P1 1, P2 2, P3 4"), true, `${id} does not state the mix`);
    }
  });

  it("states the invoice count and the amount invoiced", () => {
    for (const id of REPORTS_BILLING) {
      const report = buildServiceReport(plan(id), facts());
      assert.match(report, /Invoices (issued|reviewed): 3/, `${id} does not state the invoices`);
      assert.equal(
        report.includes(formatZar(123456)),
        true,
        `${id} does not state the amount invoiced`,
      );
    }
  });

  it("lists the fault kinds it was given", () => {
    const report = buildServiceReport(plan("service-report"), facts());
    assert.equal(report.includes("Dropped calls — 4"), true);
    assert.equal(report.includes("Slow Wi-Fi — 2"), true);
  });

  it("lists the open items it was given", () => {
    const report = buildServiceReport(plan("service-report"), facts());
    assert.equal(report.includes("Site link still down"), true);
    assert.equal(report.includes("Hand the firewall rules over"), true);
  });

  it("says so when there is nothing open", () => {
    const report = buildServiceReport(plan("service-report"), facts({ openItems: [] }));
    assert.equal(report.includes("(none recorded)"), true);
  });

  it("uses recorded support time when it has it", () => {
    const report = buildServiceReport(
      plan("managed-support"),
      facts({ hoursUsed: 6.5, hoursBasis: "recorded", timeEntries: 3 }),
    );
    assert.equal(report.includes("6.5 hours recorded from 3 time entries"), true);
    assert.equal(report.includes("estimate"), false);
  });

  it("labels the fault-count fallback as an estimate", () => {
    const report = buildServiceReport(plan("managed-support"), facts());
    assert.equal(report.includes("an estimate of 6 hours"), true);
    assert.equal(report.includes("not a measured figure"), true);
  });

  it("still reads as a report when the record is empty", () => {
    for (const item of PLANS) {
      const report = buildServiceReport(item, emptyFacts(COMPANY, PERIOD));
      assert.equal(report.trim().length > 0, true, `${item.id} produced nothing`);
      assert.equal(report.includes(FOOTER), true, `${item.id} has no footer`);
    }
  });
});

describe("the service report does not promise", () => {
  it("uses no promise words in the body of the report", () => {
    for (const item of PLANS) {
      const report = buildServiceReport(item, facts());
      const found = body(report).match(FORBIDDEN_PROMISE);
      assert.equal(found, null, `${item.id} promises something: ${found ? found.join(", ") : ""}`);
    }
  });

  it("uses no promise words anywhere, apart from the footer denying them", () => {
    for (const item of PLANS) {
      const report = buildServiceReport(item, facts()).split(DISCLAIMER).join("");
      const found = report.match(FORBIDDEN_PROMISE);
      assert.equal(found, null, `${item.id} promises something: ${found ? found.join(", ") : ""}`);
    }
  });

  it("calls its response figures working targets, not a service level", () => {
    const report = buildServiceReport(plan("sla-review"), facts());
    assert.equal(report.includes("working targets"), true);
    assert.equal(report.includes("not a contractual service level"), true);
  });
});

describe("the billing audit report", () => {
  it("names every invoice that did not reconcile", () => {
    const report = buildServiceReport(plan("billing-audit"), facts());
    assert.equal(report.includes("INV-002"), true);
    assert.equal(report.includes("INV-003"), true);
    assert.equal(report.includes("NOT MATCHED"), true);
  });

  it("says how many invoices did not reconcile", () => {
    const report = buildServiceReport(plan("billing-audit"), facts());
    assert.equal(report.includes("Not matched: 2"), true);
    assert.equal(report.includes("Matched to a published rate line: 1"), true);
  });

  it("says nothing was adjusted", () => {
    const report = buildServiceReport(plan("billing-audit"), facts());
    assert.equal(report.includes("Nothing was adjusted"), true);
  });
});

describe("the service level review report", () => {
  it("states the measured count and how it compared with the target", () => {
    const report = buildServiceReport(plan("sla-review"), facts());
    // The wording names the clock the office actually keeps: a raise and a
    // recorded resolution. It never claims a first response, because the office
    // records none.
    assert.equal(
      report.includes("Faults raised in the period with a recorded resolution: 12"),
      true,
    );
    assert.equal(report.includes("Resolved inside our internal target: 9 (75%)"), true);
    assert.equal(report.includes("recorded response"), false);
  });

  it("says it is not measurable when nothing was measured", () => {
    const report = buildServiceReport(
      plan("sla-review"),
      facts({ measuredFaults: 0, withinTarget: 0 }),
    );
    assert.equal(report.includes("not measurable"), true);
  });
});

describe("the service summary", () => {
  it("summarises every plan on one line", () => {
    for (const item of PLANS) {
      const summary = summariseService(item, facts());
      assert.equal(summary.trim().length > 0, true, `${item.id} has no summary`);
      assert.equal(summary.includes("\n"), false, `${item.id} summary is more than one line`);
    }
  });

  it("summarises the faults for the plans that watch them", () => {
    for (const id of ["managed-support", "health-watch"]) {
      const summary = summariseService(plan(id), facts());
      assert.equal(summary.includes("7"), true);
      assert.equal(summary.includes("5"), true);
      assert.equal(summary.includes("2"), true);
    }
  });

  it("summarises the unmatched invoices for the audit", () => {
    const summary = summariseService(plan("billing-audit"), facts());
    assert.equal(summary.includes("3 invoice(s) reviewed"), true);
    assert.equal(summary.includes("2 not matched"), true);
  });

  it("summarises the measured faults for the review", () => {
    const summary = summariseService(plan("sla-review"), facts());
    assert.equal(summary.includes("12 measured fault(s)"), true);
    assert.equal(summary.includes("9 inside the internal target"), true);
  });
});
