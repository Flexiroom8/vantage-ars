import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type OfficePdfKind = "quote" | "invoice" | "receipt";

export type QuotePdfInput = {
  companyName: string;
  amount: string;
  body: string;
  payment: string;
  kind?: OfficePdfKind;
};

const ink = rgb(0.12, 0.13, 0.1);
const muted = rgb(0.38, 0.38, 0.34);
const paper = rgb(0.96, 0.95, 0.91);
const olive = rgb(0.29, 0.33, 0.18);

function pdfText(value: string): string {
  return value
    .replace(/\u202F/g, " ")
    .replace(/\u00A0/g, " ")
    // Keep tab, newline, carriage return and Latin-1; the standard PDF fonts cannot draw anything else.
    // eslint-disable-next-line no-control-regex
    .replace(/[^\x09\x0A\x0D\x20-\xFF]/g, "")
    .trim();
}

function wrap(value: string, width: number): string[] {
  const words = pdfText(value).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > width && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function quoteReference(body: string): string | null {
  return body.match(/Reference:\s*(VA-[A-Z0-9]+)/)?.[1] ?? null;
}

export function quotePdfName(companyName: string, body: string, kind: OfficePdfKind = "quote"): string {
  const ref = quoteReference(body) ?? kind;
  const slug = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const label = kind === "quote" ? "" : `${kind}-`;
  return `vantage-ars-${slug || "customer"}-${label}${ref}.pdf`;
}

export async function buildQuotePdf(input: QuotePdfInput): Promise<Uint8Array> {
  const kind = input.kind ?? "quote";
  const heading = kind === "invoice" ? "Invoice" : kind === "receipt" ? "Receipt" : "Quote";
  const company = pdfText(input.companyName) || "Customer";
  const amount = pdfText(input.amount) || "-";
  const reference = quoteReference(input.body);
  const scope = wrap(input.body, 88);
  const pay = wrap(input.payment, 88);
  const dated = new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date());

  const doc = await PDFDocument.create();
  doc.setTitle(reference ? `${heading} ${reference}` : `${heading} for ${company}`);
  doc.setAuthor("Vantage-ARS");
  doc.setSubject(`Written ${kind}. This file was not emailed.`);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const pageWidth = 595;
  const pageHeight = 842;
  let page = doc.addPage([pageWidth, pageHeight]);
  page.drawRectangle({ x: 0, y: 0, width: pageWidth, height: pageHeight, color: paper });
  page.drawRectangle({ x: 0, y: 0, width: 10, height: pageHeight, color: olive });

  let y = 790;
  const draw = (text: string, size: number, face: typeof font, color = ink) => {
    if (y < 72) {
      page = doc.addPage([pageWidth, pageHeight]);
      page.drawRectangle({ x: 0, y: 0, width: pageWidth, height: pageHeight, color: paper });
      page.drawRectangle({ x: 0, y: 0, width: 10, height: pageHeight, color: olive });
      y = 790;
    }
    page.drawText(text, { x: 48, y, size, font: face, color });
    y -= size + 8;
  };

  draw("VANTAGE-ARS", 11, bold, olive);
  draw("vantage-ars.co.za", 10, font, muted);
  y -= 10;
  draw(heading, 28, bold);
  draw(dated, 10, font, muted);
  y -= 8;
  draw("Prepared for", 10, font, muted);
  draw(company, 16, bold);
  draw(amount, 18, bold);
  if (reference) draw(`Reference ${reference}`, 12, font);
  y -= 8;
  draw(kind === "quote" ? "Scope" : heading, 10, font, muted);
  for (const line of scope.length ? scope : ["No scope was recorded."]) draw(line, 11, font);
  if (pay.length) {
    y -= 8;
    draw(kind === "receipt" ? "Payment" : "How to pay", 10, font, muted);
    for (const line of pay) draw(line, 11, font);
  }
  y -= 12;
  draw("VAT was not stated, so none is added.", 10, font, muted);
  draw(`This ${kind} was not emailed. Send the file yourself.`, 10, font, muted);

  return doc.save();
}

export function downloadPdf(bytes: Uint8Array, filename: string): void {
  const blob = new Blob(
    [bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer],
    { type: "application/pdf" },
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
