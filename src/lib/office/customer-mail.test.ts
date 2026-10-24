import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderCustomerMail } from "./customer-mail.ts";
import { diagnosticChecklistForQuote } from "./diagnostics.ts";

describe("diagnostic checklist customer email", () => {
  it("renders a safe, scope-limited checklist without promising a fix", () => {
    const diagnosticChecklist = diagnosticChecklistForQuote({
      rateId: "voip-diagnosis",
      title: "VoIP fault diagnosis",
    });
    assert.ok(diagnosticChecklist);
    const mail = renderCustomerMail("diagnostic_checklist", {
      companyName: "Acme",
      diagnosticChecklist,
    });

    assert.equal(mail.ok, true);
    if (!mail.ok) return;
    assert.match(mail.subject, /Phone and call checks/);
    assert.match(mail.body, /accepted diagnostic scope/);
    assert.match(mail.body, /Do not share passwords/);
    assert.match(mail.body, /Do not run scans/);
    assert.match(mail.body, /new written quote/);
    assert.equal(mail.body.toLowerCase().includes("guarantee"), false);
  });

  it("refuses to send without a known approved checklist", () => {
    assert.deepEqual(renderCustomerMail("diagnostic_checklist", { companyName: "Acme" }), {
      ok: false,
      error: "There is no approved diagnostic checklist for this quote.",
    });
  });
});
