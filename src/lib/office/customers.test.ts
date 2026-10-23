import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildCustomerBook,
  customerAccountsToCsv,
  summarizeCustomerAccounts,
  type CustomerActivity,
  type CustomerLedgerRow,
  type CustomerPlanRow,
} from "./customers.ts";

const NOW = "2026-03-31T12:00:00.000Z";

function activity(overrides: Partial<CustomerActivity> = {}): CustomerActivity {
  return {
    companyName: "Acme",
    source: "lead",
    stage: "qualified",
    score: 40,
    valueCents: 0,
    createdAt: "2026-03-01T08:00:00.000Z",
    updatedAt: "2026-03-02T08:00:00.000Z",
    ...overrides,
  };
}

function ledger(overrides: Partial<CustomerLedgerRow> = {}): CustomerLedgerRow {
  return {
    companyName: "Acme",
    kind: "invoice",
    amountCents: 100000,
    status: "issued",
    createdAt: "2026-03-20T08:00:00.000Z",
    ...overrides,
  };
}

function plan(overrides: Partial<CustomerPlanRow> = {}): CustomerPlanRow {
  return {
    companyName: "Acme",
    contactName: "Naledi Mokoena",
    contactEmail: "ops@acme.example",
    planId: "managed-support",
    cycle: "monthly",
    priceCents: 490000,
    status: "active",
    nextBillingAt: "2026-04-15T08:00:00.000Z",
    createdAt: "2026-02-01T08:00:00.000Z",
    ...overrides,
  };
}

describe("the customer book", () => {
  it("merges one company from every record and keeps the newest name", () => {
    const book = buildCustomerBook({
      activity: [
        activity({ companyName: "  ACME  " }),
        activity({
          companyName: "ACME",
          source: "opportunity",
          stage: "proposal",
          valueCents: 250000,
          updatedAt: "2026-03-15T08:00:00.000Z",
        }),
      ],
      ledger: [ledger({ companyName: "acme" })],
      plans: [plan()],
      nowIso: NOW,
    });
    assert.equal(book.accounts.length, 1);
    assert.equal(book.accounts[0].companyName, "acme");
    assert.equal(book.accounts[0].pipelineCents, 250000);
    assert.equal(book.accounts[0].invoicedCents, 100000);
    assert.equal(book.accounts[0].status, "client");
  });

  it("counts invoices, receipts and only issued balances as outstanding", () => {
    const book = buildCustomerBook({
      activity: [],
      ledger: [
        ledger({ createdAt: "2026-03-29T08:00:00.000Z", amountCents: 50000 }),
        ledger({ createdAt: "2026-03-01T08:00:00.000Z", amountCents: 70000 }),
        ledger({ kind: "receipt", status: "cleared", amountCents: 50000 }),
        ledger({ status: "paid", amountCents: 90000 }),
      ],
      plans: [],
      nowIso: NOW,
    });
    const account = book.accounts[0];
    assert.equal(account.invoicedCents, 210000);
    assert.equal(account.receivedCents, 50000);
    assert.equal(account.outstandingCents, 120000);
    assert.equal(account.overdueCents, 70000);
    assert.equal(account.status, "client");
    assert.equal(account.churnRisk, true);
  });

  it("does not count an invoice paid within the issued status twice", () => {
    const book = buildCustomerBook({
      activity: [],
      ledger: [ledger({ amountCents: 12345, status: "paid" })],
      plans: [],
      nowIso: NOW,
    });
    assert.equal(book.accounts[0].outstandingCents, 0);
    assert.equal(book.accounts[0].overdueCents, 0);
  });

  it("turns a quarterly plan into its monthly value and finds the next renewal", () => {
    const book = buildCustomerBook({
      activity: [],
      ledger: [],
      plans: [
        plan({
          planId: "quarterly-review",
          cycle: "quarterly",
          priceCents: 517500,
          nextBillingAt: "2026-05-01T08:00:00.000Z",
        }),
        plan({
          planId: "health-watch",
          cycle: "monthly",
          priceCents: 149000,
          nextBillingAt: "2026-04-10T08:00:00.000Z",
        }),
        plan({
          planId: "managed-support",
          status: "cancelled",
          nextBillingAt: "2026-01-01T08:00:00.000Z",
        }),
      ],
      nowIso: NOW,
    });
    const account = book.accounts[0];
    assert.equal(account.activeSubscriptions, 2);
    assert.equal(account.monthlyRecurringCents, 172500 + 149000);
    assert.equal(account.nextBillingAt, "2026-04-10T08:00:00.000Z");
    assert.deepEqual(account.planIds.sort(), ["health-watch", "quarterly-review"]);
  });

  it("distinguishes a lost prospect from a live one and a client", () => {
    const book = buildCustomerBook({
      activity: [
        activity({ companyName: "Lost Co", source: "opportunity", stage: "lost" }),
        activity({ companyName: "Open Co", source: "opportunity", stage: "negotiation" }),
        activity({ companyName: "Won Co", source: "opportunity", stage: "won", valueCents: 80000 }),
      ],
      ledger: [],
      plans: [],
      nowIso: NOW,
    });
    const byName = new Map(book.accounts.map((account) => [account.companyName, account]));
    assert.equal(byName.get("Lost Co")?.status, "lost");
    assert.equal(byName.get("Open Co")?.status, "prospect");
    assert.equal(byName.get("Won Co")?.status, "client");
    assert.equal(book.summary.clients, 1);
    assert.equal(book.summary.prospects, 1);
    assert.equal(book.summary.lost, 1);
  });

  it("flags a churn risk when a renewal is more than fourteen days late", () => {
    const book = buildCustomerBook({
      activity: [],
      ledger: [],
      plans: [plan({ nextBillingAt: "2026-03-01T08:00:00.000Z" })],
      nowIso: NOW,
    });
    assert.equal(book.accounts[0].churnRisk, true);
    assert.equal(book.summary.churnRisk, 1);
  });

  it("summarises the book and exports a spreadsheet-safe CSV", () => {
    const book = buildCustomerBook({
      activity: [activity()],
      ledger: [ledger()],
      plans: [plan()],
      nowIso: NOW,
    });
    assert.equal(summarizeCustomerAccounts(book.accounts).accounts, 1);
    const csv = customerAccountsToCsv(book.accounts);
    const lines = csv.split("\r\n");
    assert.equal(lines.length, 2);
    assert.match(lines[0], /^company,status,contact_name/);
    assert.match(lines[1], /^Acme,client,/);
    assert.match(lines[1], /4900\.00/);
    assert.match(lines[1], /Managed support plan/);

    const escaped = customerAccountsToCsv([
      {
        ...book.accounts[0],
        companyName: 'Acme, "North"',
        contactName: "Line\nBreak",
      },
    ]);
    assert.match(escaped, /"Acme, ""North"""/);
    assert.match(escaped, /"Line\nBreak"/);
  });
});
