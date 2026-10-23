import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PDFDocument } from "pdf-lib";

import { buildRateCardPdf, RATE_CARD_FILENAME } from "./rate-card-pdf.ts";

describe("rate card PDF", () => {
  it("has a stable file name", () => {
    assert.equal(RATE_CARD_FILENAME, "vantage-ars-rate-card.pdf");
  });

  it("is a readable PDF with a title and at least one page", async () => {
    const bytes = await buildRateCardPdf();
    assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), "%PDF-");
    const doc = await PDFDocument.load(bytes);
    assert.equal(doc.getTitle(), "Vantage-ARS rate card");
    assert.ok(doc.getPageCount() >= 1);
  });
});
