import { formatZar } from "./money.ts";

export function customerQuoteText(summary: string): string {
  return summary.replace(/^INTERNAL QUOTE DRAFT\.\s*This has not been sent\.\s*/i, "").trim();
}

export type InvoiceFigure =
  | { ok: true; cents: number; netCents: number; vatCents: number; treatment: VatTreatment; memo: string }
  | { ok: false; error: string };

/**
 * `valueCents` is the approved quote figure. `cents` in the result is what the customer owes:
 * - none (default): nothing added, VAT not stated
 * - standard: quote figure is net, 15% VAT is added
 * - included: quote figure already contains VAT
 * - zero_rated: quote figure is net, VAT is 0%
 */
export function quoteInvoice(valueCents: number, treatment: VatTreatment = "none"): InvoiceFigure {
  if (!Number.isInteger(valueCents) || valueCents <= 0) {
    return { ok: false, error: "There is no approved figure to invoice." };
  }
  const split = vatBreakdown(valueCents, treatment);
  if (!split.ok) return split;
  const memo =
    treatment === "none"
      ? "Labour from the approved quote. VAT was not stated, so none is added. The invoice has not been emailed."
      : `Labour from the approved quote. ${VAT_TREATMENT_LABELS[treatment]}. The invoice has not been emailed.`;
  return { ok: true, cents: split.grossCents, netCents: split.netCents, vatCents: split.vatCents, treatment, memo };
}

export function receiptForInvoice(amountCents: number):
  | { ok: true; cents: number; memo: string }
  | { ok: false; error: string } {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    return { ok: false, error: "There is no invoice figure to receive." };
  }
  return {
    ok: true,
    cents: amountCents,
    memo: "Founder recorded that this invoice was paid in full. The customer was not emailed.",
  };
}

export function documentRef(id: string): string {
  const compact = id.replace(/-/g, "").slice(0, 8).toUpperCase();
  return `VA-${compact || "00000000"}`;
}

export const PAYMENT_METHODS = [
  {
    id: "eft",
    title: "EFT",
    available: true,
    detail: "Capitec Bank. Account 1592015539. Branch 470010. Beneficiary Vantage ARS.",
  },
  {
    id: "wire",
    title: "International wire",
    available: true,
    detail: "SWIFT CABLZAJJ. Capitec Bank, South Africa. Account 1592015539. Branch 470010.",
  },
  {
    id: "card",
    title: "Card",
    available: false,
    detail: "Card checkout is not connected. Do not send card numbers by email.",
  },
] as const;

export function paymentInstructionsText(): string {
  return [
    "EFT: Capitec Bank, account 1592015539, branch 470010, beneficiary Vantage ARS.",
    "International wire: SWIFT CABLZAJJ, Capitec Bank, South Africa, same account.",
    "Reference: the quote or invoice reference.",
    "Card payment is not available.",
  ].join(" ");
}

export type VatSummary = { treatment: VatTreatment; netCents: number; vatCents: number };

function vatLines(vat: VatSummary | undefined): string[] {
  if (!vat || vat.treatment === "none") return ["VAT was not stated, so none is added."];
  if (vat.treatment === "zero_rated") return [`Excluding VAT: ${formatZar(vat.netCents)}.`, "VAT at 0% (zero-rated)."];
  return [`Excluding VAT: ${formatZar(vat.netCents)}.`, `VAT at 15%: ${formatZar(vat.vatCents)}.`];
}

export function invoiceCopy(companyName: string, cents: number, reference?: string, vat?: VatSummary): string {
  const name = companyName.trim() || "Customer";
  return [
    `Invoice for ${name}.`,
    "Labour from the accepted quote.",
    ...vatLines(vat),
    `Amount due ${formatZar(cents)}.`,
    reference ? `Reference: ${reference}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function receiptCopy(companyName: string, cents: number, vat?: VatSummary): string {
  const name = companyName.trim() || "Customer";
  return [
    `Receipt for ${name}.`,
    `Amount received ${formatZar(cents)}.`,
    "This matches the invoice.",
    ...vatLines(vat),
  ].join(" ");
}

export function paymentNote(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, 400);
}

export function withPaymentNote(body: string, note: string): string {
  const extra = paymentNote(note);
  if (!extra) return body;
  return `${body} Pay: ${extra}`;
}

export function deliveryJob(companyName: string, quoteSummary: string): { title: string; summary: string } {
  const name = companyName.trim() || "Customer";
  const scope = customerQuoteText(quoteSummary);
  return {
    title: `Deliver · ${name}`,
    summary: scope || "Accepted quote. Scope is the approved labour only.",
  };
}

export type VatTreatment = "none" | "standard" | "included" | "zero_rated";

export const VAT_RATE_BPS = 1500; // South Africa standard rate, 15.00%

/**
 * Integer-cent VAT breakdown. `cents` is the figure on the quote:
 * - none: VAT not stated, nothing added (current default behaviour)
 * - standard: cents is the net amount, 15% is added
 * - included: cents already contains VAT, so net and VAT are extracted
 * - zero_rated: cents is the net amount and VAT is 0% (for example qualifying exports)
 * Whether a treatment applies to a customer is the founder's call; this only does the arithmetic.
 */
export function vatBreakdown(
  cents: number,
  treatment: VatTreatment,
): { ok: true; netCents: number; vatCents: number; grossCents: number } | { ok: false; error: string } {
  if (!Number.isInteger(cents) || cents <= 0) return { ok: false, error: "There is no figure to apply VAT to." };
  switch (treatment) {
    case "none":
    case "zero_rated":
      return { ok: true, netCents: cents, vatCents: 0, grossCents: cents };
    case "standard": {
      const vat = Math.floor((cents * VAT_RATE_BPS + 5000) / 10000);
      return { ok: true, netCents: cents, vatCents: vat, grossCents: cents + vat };
    }
    case "included": {
      const net = Math.floor((cents * 10000 + (10000 + VAT_RATE_BPS) / 2) / (10000 + VAT_RATE_BPS));
      return { ok: true, netCents: net, vatCents: cents - net, grossCents: cents };
    }
    default:
      return { ok: false, error: "Unknown VAT treatment." };
  }
}

/**
 * Maps the `vatTreatment` on an invoice action to integer-cent VAT.
 * Missing treatment keeps the previous behaviour (15% on top). "unstated" and
 * "none" add nothing. An unrecognised value adds nothing rather than inventing VAT.
 */
export function ledgerVat(treatment: unknown, cents: number): { treatment: VatTreatment; vatCents: number; netCents: number } {
  const known: VatTreatment[] = ["none", "standard", "included", "zero_rated"];
  const t: VatTreatment =
    treatment === undefined || treatment === null
      ? "standard"
      : treatment === "unstated"
        ? "none"
        : known.includes(treatment as VatTreatment)
          ? (treatment as VatTreatment)
          : "none";
  const r = vatBreakdown(cents, t);
  if (!r.ok) return { treatment: "none", vatCents: 0, netCents: Math.max(0, Number.isInteger(cents) ? cents : 0) };
  return { treatment: t, vatCents: r.vatCents, netCents: r.netCents };
}

export const VAT_TREATMENT_LABELS: Record<VatTreatment, string> = {
  none: "No VAT added",
  standard: "Add 15% VAT to the quote figure",
  included: "Quote figure already includes 15% VAT",
  zero_rated: "Zero-rated (0% VAT)",
};

/** Untrusted input to a treatment. Anything unrecognised becomes "none" so VAT is never invented. */
export function parseVatTreatment(value: unknown): VatTreatment {
  return value === "standard" || value === "included" || value === "zero_rated" ? value : "none";
}
