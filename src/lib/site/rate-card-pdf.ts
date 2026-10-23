import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { RATE_GROUPS, ratesByIds } from "@/lib/office/catalogue";
import { COMPANY } from "@/lib/office/company";

const ink = rgb(0.12, 0.13, 0.1);
const muted = rgb(0.38, 0.38, 0.34);
const paper = rgb(0.96, 0.95, 0.91);
const olive = rgb(0.29, 0.33, 0.18);

export const RATE_CARD_FILENAME = "vantage-ars-rate-card.pdf";

function pdfText(value: string): string {
  return [...value.replace(/\u202F/g, " ").replace(/\u00A0/g, " ")]
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code === 9 || code === 10 || code === 13 || (code >= 32 && code <= 255);
    })
    .join("")
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

export async function buildRateCardPdf(): Promise<Uint8Array> {
  const dated = new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date());
  const doc = await PDFDocument.create();
  doc.setTitle("Vantage-ARS rate card");
  doc.setAuthor(COMPANY.legalName);
  doc.setSubject("Published rates. A written quote confirms the total.");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const pageWidth = 595;
  const pageHeight = 842;
  let page = doc.addPage([pageWidth, pageHeight]);
  let y = 790;

  function newPage() {
    page = doc.addPage([pageWidth, pageHeight]);
    page.drawRectangle({ x: 0, y: 0, width: pageWidth, height: pageHeight, color: paper });
    page.drawRectangle({ x: 0, y: 0, width: 10, height: pageHeight, color: olive });
    y = 790;
  }

  function draw(text: string, size: number, face: typeof font, color = ink, indent = 0) {
    if (y < 72) newPage();
    page.drawText(text, { x: 48 + indent, y, size, font: face, color });
    y -= size + 7;
  }

  newPage();
  draw("VANTAGE-ARS", 11, bold, olive);
  draw("vantage-ars.co.za", 10, font, muted);
  y -= 10;
  draw("Rate card", 30, bold);
  draw(dated, 10, font, muted);
  draw("South African rand. VAT is added only where the written quote says so.", 10, font, muted);
  y -= 6;

  for (const group of RATE_GROUPS) {
    const rates = ratesByIds(group.ids);
    if (rates.length === 0) continue;
    y -= 8;
    draw(group.title, 18, bold, olive);
    for (const line of wrap(group.note, 90)) draw(line, 10, font, muted);
    y -= 2;
    for (const rate of rates) {
      if (y < 110) newPage();
      draw(rate.title, 12, bold);
      draw(rate.price, 11, font, rate.offered ? olive : muted, 12);
      if (rate.scope) for (const line of wrap(rate.scope, 84)) draw(line, 10, font, muted, 12);
      if (rate.basis) draw(rate.basis, 9, font, muted, 12);
      y -= 2;
    }
  }

  y -= 10;
  draw("A written quote confirms the scope and the total before work starts.", 10, font, muted);
  draw(
    "Nothing here is an uptime promise, a service level or an automated monitoring service.",
    10,
    font,
    muted,
  );
  return doc.save();
}
