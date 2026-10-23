import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { searchOffice } from "./search.ts";
import type { OfficeSnapshot } from "./types.ts";

function snapshot(overrides: Partial<OfficeSnapshot> = {}): OfficeSnapshot {
  return {
    company: {} as OfficeSnapshot["company"],
    provisions: [],
    agents: [],
    inbound: [],
    leads: [],
    opportunities: [],
    campaigns: [],
    ledger: [],
    tickets: [],
    documents: [],
    approvals: [],
    decisions: [],
    audit: [],
    notices: [],
    mail: { smtpConnected: false, account: null },
    health: {} as OfficeSnapshot["health"],
    delegation: null,
    delegationUsage: { usedToday: 0, usedThisMonth: 0, spentTodayCents: 0, spentThisMonthCents: 0 },
    subscriptions: [],
    revenue: {} as OfficeSnapshot["revenue"],
    ...overrides,
  };
}

describe("office search", () => {
  it("returns nothing for an empty query", () => {
    assert.deepEqual(searchOffice(snapshot(), "   "), []);
  });

  it("finds office pages and is case-insensitive", () => {
    const hits = searchOffice(snapshot(), "GOVERNANCE");
    assert.equal(hits[0]?.href, "/office/governance");
    assert.equal(hits[0]?.kind, "page");
  });

  it("finds a customer through an invoice and deduplicates the book", () => {
    const hits = searchOffice(
      snapshot({
        subscriptions: [
          {
            companyName: "Acme Fibre",
            status: "active",
            planId: "managed",
            cycle: "monthly",
            nextBillingAt: "2026-05-01T00:00:00.000Z",
          } as OfficeSnapshot["subscriptions"][number],
        ],
        ledger: [
          {
            kind: "invoice",
            counterparty: "Acme Fibre",
            status: "sent",
          } as OfficeSnapshot["ledger"][number],
        ],
      }),
      "acme",
    );
    assert.equal(hits.filter((hit) => hit.kind === "customer").length, 1);
  });

  it("requires every term to match", () => {
    const hits = searchOffice(snapshot(), "acme firewall");
    assert.equal(hits.length, 0);
  });

  it("caps the result list", () => {
    const hits = searchOffice(snapshot(), "o", 3);
    assert.equal(hits.length, 3);
  });
});
