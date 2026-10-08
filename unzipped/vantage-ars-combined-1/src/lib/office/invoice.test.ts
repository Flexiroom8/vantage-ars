import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { customerQuoteText, deliveryJob, documentRef, invoiceCopy, ledgerVat, expenseVat, paymentMethods, bankDetails, parseVatTreatment, paymentInstructionsText, paymentNote, quoteInvoice, receiptCopy, receiptForInvoice, vatBreakdown, withPaymentNote } from "./invoice.ts";

const TEST_BANK = {
  PAYMENT_BANK_NAME: "Test Bank",
  PAYMENT_ACCOUNT_NUMBER: "0000000001",
  PAYMENT_BRANCH_CODE: "000001",
  PAYMENT_BENEFICIARY: "Test Beneficiary",
  PAYMENT_SWIFT: "TESTZAJJ",
};

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
    assert.equal(paymentInstructionsText(TEST_BANK).includes("0000000001"), true);
    assert.equal(paymentNote(paymentInstructionsText(TEST_BANK)), paymentInstructionsText(TEST_BANK));
    assert.equal(paymentInstructionsText(TEST_BANK).toLowerCase().includes("card payment is not available"), true);
    assert.equal(documentRef("abc"), "VA-ABC");
  });

  it("puts the payment details on the quote the founder sends", () => {
    const sent = withPaymentNote(
      customerQuoteText("INTERNAL QUOTE DRAFT. This has not been sent. Remote support. Reference: VA-ABC12345."),
      paymentInstructionsText(TEST_BANK),
    );
    assert.equal(sent.includes("INTERNAL"), false);
    assert.equal(sent.includes("VA-ABC12345"), true);
    assert.equal(sent.includes("Test Beneficiary"), true);
    assert.equal(sent.includes("0000000001"), true);
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

describe("invoice with VAT treatment", () => {
  it("adds 15% on top for standard and bills the gross figure", () => {
    const f = quoteInvoice(69000, "standard");
    assert.equal(f.ok, true);
    if (f.ok) assert.deepEqual([f.netCents, f.vatCents, f.cents], [69000, 10350, 79350]);
  });
  it("extracts VAT for included and bills the quote figure unchanged", () => {
    const f = quoteInvoice(11500, "included");
    assert.equal(f.ok, true);
    if (f.ok) assert.deepEqual([f.netCents, f.vatCents, f.cents], [10000, 1500, 11500]);
  });
  it("bills the net figure for zero-rated with no VAT", () => {
    const f = quoteInvoice(50000, "zero_rated");
    if (f.ok) assert.deepEqual([f.vatCents, f.cents], [0, 50000]);
  });
  it("keeps the old default and wording when no treatment is chosen", () => {
    const f = quoteInvoice(69000);
    if (f.ok) {
      assert.equal(f.cents, 69000);
      assert.equal(f.memo.includes("VAT was not stated"), true);
    }
  });
  it("writes VAT lines into the customer copy", () => {
    const text = invoiceCopy("Harbour & Co", 79350, "VA-1", { treatment: "standard", netCents: 69000, vatCents: 10350 });
    assert.equal(text.includes("VAT at 15%"), true);
    assert.equal(text.toLowerCase().includes("vat was not stated"), false);
    assert.equal(text.includes("793"), true);
  });
  it("turns unknown input into no VAT", () => {
    assert.equal(parseVatTreatment("anything"), "none");
    assert.equal(parseVatTreatment(undefined), "none");
    assert.equal(parseVatTreatment("included"), "included");
  });
});

describe("bank details from the environment", () => {
  it("shows the details only when all required settings are present", () => {
    const methods = paymentMethods(TEST_BANK);
    assert.equal(methods.find((m) => m.id === "eft")?.detail.includes("0000000001"), true);
    assert.equal(methods.find((m) => m.id === "wire")?.detail.includes("TESTZAJJ"), true);
    assert.equal(methods.find((m) => m.id === "card")?.available, false);
  });
  it("never invents details when settings are missing", () => {
    assert.equal(bankDetails({ PAYMENT_BANK_NAME: "Test Bank" }), null);
    const text = paymentInstructionsText({});
    assert.equal(/\d{6,}/.test(text), false);
    assert.equal(text.includes("sent with the quote or invoice"), true);
    assert.equal(paymentMethods({}).every((m) => !/\d{6,}/.test(m.detail)), true);
  });
  it("omits the wire line without a SWIFT code", () => {
    const { PAYMENT_SWIFT: _unused, ...noSwift } = TEST_BANK;
    assert.equal(paymentInstructionsText(noSwift).includes("International wire"), false);
  });
});

describe("expense VAT", () => {
  it("claims input VAT only when the amount is stated to include it", () => {
    assert.equal(expenseVat("included", 11500), 1500);
    for (const t of [undefined, "none", "standard", "bogus", 1]) assert.equal(expenseVat(t, 11500), 0);
  });
  it("is safe on bad amounts", () => {
    assert.equal(expenseVat("included", 0), 0);
    assert.equal(expenseVat("included", Number.NaN), 0);
  });
});
