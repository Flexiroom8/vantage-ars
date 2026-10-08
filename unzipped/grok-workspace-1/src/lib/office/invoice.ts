import { formatZar } from "./money.ts";

export function customerQuoteText(summary: string): string {
  return summary.replace(/^INTERNAL QUOTE DRAFT\.\s*This has not been sent\.\s*/i, "").trim();
}

export function quoteInvoice(valueCents: number):
  | { ok: true; cents: number; vatCents: number; memo: string }
  | { ok: false; error: string } {
  if (!Number.isInteger(valueCents) || valueCents <= 0) {
    return { ok: false, error: "There is no approved figure to invoice." };
  }
  return {
    ok: true,
    cents: valueCents,
    vatCents: 0,
    memo: "Labour from the approved quote. VAT was not stated, so none is added. The invoice has not been emailed.",
  };
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

export function invoiceCopy(companyName: string, cents: number, reference?: string): string {
  const name = companyName.trim() || "Customer";
  return [
    `Invoice for ${name}.`,
    `Amount due ${formatZar(cents)}.`,
    "Labour from the accepted quote.",
    "VAT was not stated, so none is added.",
    reference ? `Reference: ${reference}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function receiptCopy(companyName: string, cents: number): string {
  const name = companyName.trim() || "Customer";
  return [
    `Receipt for ${name}.`,
    `Amount received ${formatZar(cents)}.`,
    "This matches the invoice.",
    "VAT was not stated, so none is added.",
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
