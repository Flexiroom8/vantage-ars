import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PDFDocument } from "pdf-lib";
import { buildQuotePdf, quotePdfName, quoteReference } from "./quote-pdf.ts";

describe("quote pdf", () => {
  it("names the file from the company and reference", () => {
    const body = "Remote support. Reference: VA-ABC12345.";
    assert.equal(quoteReference(body), "VA-ABC12345");
    assert.equal(quotePdfName("Harbour & Co", body), "vantage-ars-harbour-co-VA-ABC12345.pdf");
    assert.equal(
      quotePdfName("Harbour & Co", body, "invoice"),
      "vantage-ars-harbour-co-invoice-VA-ABC12345.pdf",
    );
  });

  it("builds a PDF that was not marked as emailed", async () => {
    const bytes = await buildQuotePdf({
      companyName: "Harbour & Co",
      amount: "R 690,00",
      body: "Remote technical support. 1 hour(s). Labour R 690,00. Reference: VA-ABC12345.",
      payment: "EFT: Test Bank, account 0000000001, beneficiary Test Beneficiary.",
    });
    assert.equal(Buffer.from(bytes.subarray(0, 5)).toString(), "%PDF-");
    const doc = await PDFDocument.load(bytes);
    assert.equal(doc.getPageCount() >= 1, true);
    assert.equal(doc.getAuthor(), "Vantage-ARS");
    assert.equal(doc.getSubject()?.includes("not emailed"), true);
  });
});
