/**
 * Password policy shared by the client reset forms and the server auth config.
 *
 * Kept free of any database or node-only import so a route module can import it
 * without pulling the server bundle into the browser.
 */

/** Minimum length enforced by Better Auth and mirrored in both reset forms. */
export const MIN_FOUNDER_PASSWORD = 12;

/** Maximum length enforced by Better Auth. */
export const MAX_FOUNDER_PASSWORD = 256;

/** Reset links are deliberately short-lived and single-use. */
export const RESET_TOKEN_TTL_SECONDS = 3600;

/**
 * Single source of truth for the rule text shown to the founder. Returns null
 * when the password is acceptable, otherwise the reason it is not.
 */
export function passwordProblem(password: string, confirm?: string): string | null {
  if (password.length < MIN_FOUNDER_PASSWORD) {
    return `Password must be at least ${MIN_FOUNDER_PASSWORD} characters.`;
  }
  if (password.length > MAX_FOUNDER_PASSWORD) {
    return `Password must be at most ${MAX_FOUNDER_PASSWORD} characters.`;
  }
  if (confirm !== undefined && password !== confirm) {
    return "Passwords do not match.";
  }
  if (/^\d+$/.test(password) || /^([a-z]|[A-Z])+$/.test(password)) {
    return "Mix in a number or a symbol so the password is not a single character class.";
  }
  return null;
}
