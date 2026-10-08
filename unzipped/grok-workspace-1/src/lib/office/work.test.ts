import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { founderWork } from "./work.ts";

const empty = { approvals: [], documents: [], opportunities: [], ledger: [], tickets: [] };

describe("founder work", () => {
  it("stays empty when nothing is waiting", () => {
    assert.deepEqual(founderWork(empty), []);
  });

  it("lists a quote to send, then an invoice, and ignores closed work", () => {
    const items = founderWork({
      ...empty,
      documents: [{ id: "q1", kind: "quote", status: "approved_unsent", title: "Quote · Harbour" }],
      opportunities: [{ id: "o1", stage: "won", companyName: "Harbour" }],
      ledger: [{ id: "inv1", kind: "invoice", status: "paid", relatedId: "o1", counterparty: "Harbour" }],
      tickets: [{ id: "t1", status: "resolved", ownerAgent: "forge", title: "Deliver · Harbour" }],
    });
    assert.deepEqual(
      items.map((item) => item.href),
      ["/office/sales"],
    );
  });

  it("asks for an invoice only when the win has no invoice", () => {
    const items = founderWork({
      ...empty,
      opportunities: [{ id: "o1", stage: "won", companyName: "Harbour" }],
    });
    assert.equal(items.length, 1);
    assert.equal(items[0]?.href, "/office/ledger");
  });
});
