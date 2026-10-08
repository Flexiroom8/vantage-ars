import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { customerQuoteText, deliveryJob, documentRef, invoiceCopy, ledgerVat, paymentInstructionsText, paymentNote, quoteInvoice, receiptCopy, receiptForInvoice, vatBreakdown, withPaymentNote } from "./invoice.ts";

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

describe("VAT breakdown", () => {
  it("adds 15% to a net figure", () => {
    assert.deepEqual(vatBreakdown(69000, "standard"), { ok: true, netCents: 69000, vatCents: 10350, grossCents: 79350 });
  });

  it("extracts VAT from a VAT-inclusive figure and always reconciles", () => {
    const r = vatBreakdown(79350, "included");
    assert.deepEqual(r, { ok: true, netCents: 69000, vatCents: 10350, grossCents: 79350 });
    for (let cents = 1; cents < 20000; cents += 7) {
      const x = vatBreakdown(cents, "included");
      assert.ok(x.ok && x.netCents + x.vatCents === cents);
    }
  });

  it("adds nothing for none or zero-rated and refuses bad figures", () => {
    assert.equal(vatBreakdown(80500, "none").ok && (vatBreakdown(80500, "none") as { vatCents: number }).vatCents, 0);
    assert.equal((vatBreakdown(80500, "zero_rated") as { grossCents: number }).grossCents, 80500);
    assert.equal(vatBreakdown(0, "standard").ok, false);
    assert.equal(vatBreakdown(10.5, "standard").ok, false);
  });
});

describe("ledgerVat", () => {
  it("keeps the old default of 15% when no treatment is given", () => {
    assert.equal(ledgerVat(undefined, 100000).vatCents, 15000);
  });
  it("adds nothing for unstated, none, zero-rated and unknown values", () => {
    for (const t of ["unstated", "none", "zero_rated", "bogus", 42]) {
      assert.equal(ledgerVat(t, 100000).vatCents, 0);
    }
  });
  it("extracts VAT from a VAT-inclusive figure", () => {
    const r = ledgerVat("included", 11500);
    assert.deepEqual([r.netCents, r.vatCents], [10000, 1500]);
  });
  it("never throws on a bad amount", () => {
    assert.equal(ledgerVat("standard", -5).vatCents, 0);
    assert.equal(ledgerVat("standard", Number.NaN).vatCents, 0);
  });
});
