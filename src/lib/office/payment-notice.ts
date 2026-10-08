import { formatZar } from "./money.ts";
import { safePartyName } from "./intake.ts";

export function parseClaimedZar(value: string): number | null {
  let text = value.trim().replace(/^R/i, "").replace(/\s/g, "");
  if (/^\d{1,7},\d{2}$/.test(text)) text = text.replace(",", ".");
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(text)) return null;
  const cents = Math.round(Number(text) * 100);
  if (!Number.isInteger(cents) || cents <= 0) return null;
  return cents;
}

export function parsePaymentNotice(input: {
  name: string;
  reference: string;
  amount: string;
}):
  | { ok: true; name: string; reference: string; cents: number; summary: string }
  | { ok: false; error: string } {
  const name = safePartyName(input.name);
  if (name === "the enquirer") return { ok: false, error: "Enter the name on the payment." };
  const reference = input.reference.trim().toUpperCase().replace(/\s/g, "");
  if (!/^VA-[A-Z0-9]{4,12}$/.test(reference)) {
    return { ok: false, error: "Enter the quote or invoice reference, such as VA- followed by the code." };
  }
  const cents = parseClaimedZar(input.amount);
  if (cents === null) return { ok: false, error: "Enter the amount you paid, in rand." };
  return {
    ok: true,
    name,
    reference,
    cents,
    summary: `Claimed ${formatZar(cents)}. Reference ${reference}. This is not a receipt. Treasury is unchanged.`,
  };
}
