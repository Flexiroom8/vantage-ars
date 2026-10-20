/**
 * Pure helpers for customer quote links. No runtime imports, so they can be
 * unit tested with `node --test`.
 */

/** Links stay valid for 30 days unless the founder revokes them sooner. */
export const QUOTE_LINK_DAYS = 30;

export type QuoteLinkState = "open" | "accepted" | "declined" | "expired" | "revoked" | "closed";

export type QuoteLinkRecord = {
  expiresAt: string;
  revokedAt: string | null;
  answer: string | null;
};

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,64}$/;

/** True when the value has the shape of a link token (cheap pre-check before hashing). */
export function plausibleToken(value: unknown): value is string {
  return typeof value === "string" && TOKEN_PATTERN.test(value);
}

export function linkExpiry(from: Date = new Date(), days = QUOTE_LINK_DAYS): Date {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * Where the link stands. `documentStatus` is the quote document's own status:
 * when the founder has already recorded an answer the link is closed.
 */
export function linkState(
  link: QuoteLinkRecord,
  documentStatus: string,
  now: Date = new Date(),
): QuoteLinkState {
  if (link.answer === "accepted") return "accepted";
  if (link.answer === "declined") return "declined";
  if (link.revokedAt) return "revoked";
  if (documentStatus === "accepted") return "accepted";
  if (documentStatus === "declined") return "declined";
  if (documentStatus !== "approved_unsent") return "closed";
  if (new Date(link.expiresAt).getTime() <= now.getTime()) return "expired";
  return "open";
}

export type CustomerAnswer =
  | { ok: true; outcome: "accepted" | "declined"; name: string; note: string }
  | { ok: false; error: string };

/** Validate what the customer typed before anything is recorded. */
export function parseCustomerAnswer(input: {
  outcome?: unknown;
  name?: unknown;
  note?: unknown;
  agree?: unknown;
}): CustomerAnswer {
  const outcome =
    input.outcome === "accepted" ? "accepted" : input.outcome === "declined" ? "declined" : null;
  if (!outcome) return { ok: false, error: "Choose accept or decline." };
  const name =
    typeof input.name === "string" ? input.name.replace(/\s+/g, " ").trim().slice(0, 160) : "";
  if (name.length < 2) return { ok: false, error: "Type your full name." };
  const note = typeof input.note === "string" ? input.note.trim().slice(0, 1000) : "";
  if (outcome === "accepted" && input.agree !== true) {
    return { ok: false, error: "Tick the box to confirm you accept the quote and its terms." };
  }
  return { ok: true, outcome, name, note };
}

export type QuoteLinkSummary = {
  documentId: string;
  state: QuoteLinkState;
  createdAt: string;
  expiresAt: string;
  firstViewedAt: string | null;
  lastViewedAt: string | null;
  viewCount: number;
  answeredAt: string | null;
  answerName: string | null;
  answerNote: string | null;
};
