import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { customerQuoteText, deliveryJob, documentRef, invoiceCopy, paymentInstructionsText, paymentNote, quoteInvoice, receiptCopy, receiptForInvoice, withPaymentNote } from "./invoice.ts";

describe("quote to invoice", () => {
  it("strips the internal header from the copy the founder sends", () => {
    const text = customerQuoteText(
      "INTERNAL QUOTE DRAFT. This has not been sent. Remote technical support. 1 hour(s). Labour R 690,00.",
    );
    assert.equal(text.startsWith("INTERNAL"), false);
    assert.equal(text.includes("Remote technical support"), true);
  });

  it("invoices the approved figure and does not add VAT", () => {
    const figure = quoteInvoice(69000);
    assert.equal(figure.ok, true);
    if (figure.ok) {
      assert.equal(figure.cents, 69000);
      assert.equal(figure.vatCents, 0);
    }
    assert.equal(quoteInvoice(0).ok, false);
  });

  it("receives only the invoice figure", () => {
    const receipt = receiptForInvoice(69000);
    assert.equal(receipt.ok, true);
    if (receipt.ok) assert.equal(receipt.cents, 69000);
    assert.equal(receiptForInvoice(0).ok, false);
  });

  it("writes an invoice the founder can send, without adding VAT", () => {
    const text = invoiceCopy("Harbour & Co", 69000);
    assert.equal(text.includes("Harbour & Co"), true);
    assert.equal(text.includes("690"), true);
    assert.equal(text.toLowerCase().includes("vat was not stated"), true);
    assert.equal(text.includes("INTERNAL"), false);
  });

  it("opens delivery from the accepted quote", () => {
    const job = deliveryJob(
      "Harbour & Co",
      "INTERNAL QUOTE DRAFT. This has not been sent. Remote technical support. 1 hour(s).",
    );
    assert.equal(job.title, "Deliver · Harbour & Co");
    assert.equal(job.summary.startsWith("INTERNAL"), false);
    assert.equal(job.summary.includes("Remote technical support"), true);
  });

  it("writes a receipt for the amount that arrived", () => {
    const text = receiptCopy("Harbour & Co", 69000);
    assert.equal(text.includes("Harbour & Co"), true);
    assert.equal(text.includes("690"), true);
    assert.equal(text.toLowerCase().includes("received"), true);
    assert.equal(text.includes("INTERNAL"), false);
  });

  it("adds payment instructions only when the founder wrote them", () => {
    const body = invoiceCopy("Harbour & Co", 69000);
    assert.equal(withPaymentNote(body, "  "), body);
    assert.equal(withPaymentNote(body, "FNB 123").includes("Pay: FNB 123"), true);
    assert.equal(paymentNote("x".repeat(500)).length, 400);
    assert.equal(paymentInstructionsText().includes("1592015539"), true);
    assert.equal(paymentNote(paymentInstructionsText()), paymentInstructionsText());
    assert.equal(paymentInstructionsText().toLowerCase().includes("card payment is not available"), true);
    assert.equal(documentRef("abc"), "VA-ABC");
  });

  it("puts the payment details on the quote the founder sends", () => {
    const sent = withPaymentNote(
      customerQuoteText("INTERNAL QUOTE DRAFT. This has not been sent. Remote support. Reference: VA-ABC12345."),
      paymentInstructionsText(),
    );
    assert.equal(sent.includes("INTERNAL"), false);
    assert.equal(sent.includes("VA-ABC12345"), true);
    assert.equal(sent.includes("Vantage ARS"), true);
    assert.equal(sent.includes("1592015539"), true);
  });
});
