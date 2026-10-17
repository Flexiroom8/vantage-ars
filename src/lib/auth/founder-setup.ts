/**
 * Founder account setup for email/password sign-in (server-only).
 *
 * The office has exactly one account: the founder (`COMPANY.email`). Public
 * sign-up is closed. The founder account can be created once, and only by a
 * request that carries the `FOUNDER_SETUP_TOKEN` set in the server environment.
 * Remove the token from the environment after setup.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { getSql } from "@/lib/db";
import { founderEmail } from "@/lib/office/company";

export const FOUNDER_SETUP_HEADER = "x-founder-setup-token";
export const MIN_FOUNDER_PASSWORD = 12;

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/** Constant-time comparison of the presented token with the configured one. */
export function setupTokenMatches(
  presented: string | null | undefined,
  configured = process.env.FOUNDER_SETUP_TOKEN,
): boolean {
  const expected = configured?.trim();
  if (!expected || expected.length < 16) return false;
  if (typeof presented !== "string" || !presented) return false;
  return timingSafeEqual(digest(presented.trim()), digest(expected));
}

export function normalizeFounderEmailInput(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
}

export function isFounderEmail(value: unknown): boolean {
  return normalizeFounderEmailInput(value) === founderEmail();
}

export async function founderAccountExists(): Promise<boolean> {
  const sql = await getSql();
  const rows = await sql<{ n: number }>`select count(*)::int as n from "user" where lower(email) = ${founderEmail()}`;
  return Number(rows[0]?.n ?? 0) > 0;
}

/** True while the one-time founder setup can still be used. */
export async function founderSetupOpen(): Promise<boolean> {
  const token = process.env.FOUNDER_SETUP_TOKEN?.trim();
  if (!token || token.length < 16) return false;
  return !(await founderAccountExists());
}

export type SetupVerdict = { ok: true } | { ok: false; error: string };

/** Gate for Better Auth's `/sign-up/email`. Only the founder, once, with the token. */
export async function checkFounderSignUp(
  email: unknown,
  presentedToken: string | null | undefined,
): Promise<SetupVerdict> {
  const normalized = normalizeFounderEmailInput(email);
  if (normalized !== founderEmail()) {
    return {
      ok: false,
      error: "Sign-up is closed. This office has one founder account.",
    };
  }
  if (!setupTokenMatches(presentedToken)) {
    return { ok: false, error: "The setup token is missing or wrong." };
  }
  if (await founderAccountExists()) {
    return {
      ok: false,
      error: "The founder account already exists. Sign in instead.",
    };
  }
  return { ok: true };
}

/** Guard for password resets: only the founder can request a reset for the office. */
export async function checkFounderPasswordReset(
  email: unknown,
): Promise<SetupVerdict> {
  const normalized = normalizeFounderEmailInput(email);
  if (normalized !== founderEmail()) {
    return {
      ok: false,
      error: "Use the founder email for this office to reset your password.",
    };
  }
  if (!(await founderAccountExists())) {
    return {
      ok: false,
      error: "The founder account has not been created yet. Set it up first.",
    };
  }
  return { ok: true };
}
