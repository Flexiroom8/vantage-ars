import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parsePaymentNotice } from "./payment-notice.ts";

describe("payment notice", () => {
  it("records a claim without treating it as a receipt", () => {
    const notice = parsePaymentNotice({ name: "Harbour Co", reference: "va-abc12345", amount: "690,00" });
    assert.equal(notice.ok, true);
    if (!notice.ok) return;
    assert.equal(notice.reference, "VA-ABC12345");
    assert.equal(notice.cents, 69000);
    assert.equal(notice.summary.includes("not a receipt"), true);
  });

  it("rejects a missing reference or a zero amount", () => {
    assert.equal(parsePaymentNotice({ name: "Harbour", reference: "invoice", amount: "690" }).ok, false);
    assert.equal(parsePaymentNotice({ name: "Harbour", reference: "VA-ABC12345", amount: "0" }).ok, false);
  });
});
