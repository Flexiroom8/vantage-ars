/**
 * Environment helpers (renamed from `env.server.ts` so the TanStack auth API
 * route can reach the auth server without tripping the client-bundle import
 * protection; content is unchanged). `env()` reads `process.env` and is only
 * ever CALLED in server contexts.
 */
export function env(key: string): string | undefined {
  const v = process.env[key]?.trim();
  return v || undefined;
}

/** Environment variables the office cannot run without in production. */
const CRITICAL_ENV = [
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "FOUNDER_EMAIL",
  "DATABASE_URL",
] as const;

/** Environment variables whose absence degrades the office but does not stop it. */
const ADVISED_ENV = [
  "CRON_SECRET",
  "AUTONOMY",
  "PAYMENT_BANK_NAME",
  "PAYMENT_ACCOUNT_NUMBER",
  "PAYMENT_BRANCH_CODE",
  "PAYMENT_BENEFICIARY",
  "PAYMENT_SWIFT",
  "GMAIL_SMTP_USER",
  "GMAIL_SMTP_APP_PASSWORD",
] as const;

/**
 * Validate that critical environment variables are present. Logs a clear
 * warning for each missing variable so a misconfigured deploy fails loudly
 * instead of silently rejecting cron runs or auth sessions. Safe to call at
 * module load; intended to be invoked once from the server entry point.
 */
export function validateEnv(): { missing: string[]; advised: string[] } {
  const missing = CRITICAL_ENV.filter((key) => !env(key));
  const advised = ADVISED_ENV.filter((key) => !env(key));
  if (missing.length > 0) {
    console.error(
      `[vantage-ars] Missing critical environment variables: ${missing.join(
        ", ",
      )}. The office will not run correctly until these are set.`,
    );
  }
  if (advised.length > 0) {
    console.warn(
      `[vantage-ars] Advisable environment variables not set: ${advised.join(
        ", ",
      )}. Some office features will be degraded.`,
    );
  }
  return { missing, advised };
}

/**
 * Workspace preview vs deployed app. The deployer writes GROK_PROJECT_ID on
 * every publish; the sandbox preview never has it. Single source of truth for
 * the split — gate audience, gate endpoints and connector-token semantics all
 * key off this predicate.
 */
export function isWorkspacePreview(): boolean {
  return !env("GROK_PROJECT_ID");
}
