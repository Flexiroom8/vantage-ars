import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PUBLIC_EMAIL } from "./company.ts";
import { FOUNDER_EMAIL, founderApprovalNotice, founderEnquiryNotice } from "./notice.ts";

describe("founder email", () => {
  it("notifies only the founder and does not copy the customer", () => {
    const notice = founderEnquiryNotice({
      name: "Ada\nBcc: other@example.com",
      email: "ada@example.com",
      subject: "Handset fault",
      desk: true,
      excerpt: "The phone is down.",
    });
    assert.equal(FOUNDER_EMAIL, "juanlouw.greyling@gmail.com");
    assert.equal(PUBLIC_EMAIL, "hello@vantage-ars.co.za");
    assert.equal(notice.subject.includes("\n"), false);
    assert.equal(notice.body.includes("No email was sent to the customer."), true);
    assert.equal(notice.body.includes("Their email: ada@example.com"), true);
    assert.equal(notice.body.includes("\nBcc:"), false);
  });

  it("states that an approval has not been sent to the customer", () => {
    const notice = founderApprovalNotice({
      gate: "customer_win",
      title: "Quote · Remote technical support",
      reason: "This action risks winning a customer.",
      amountCents: 69000,
      companyName: "Northline",
    });
    assert.equal(notice.subject, "Vantage-ARS · approval required");
    assert.equal(notice.body.includes("Nothing has been sent to the customer."), true);
    assert.equal(notice.body.includes("R"), true);
  });
});
