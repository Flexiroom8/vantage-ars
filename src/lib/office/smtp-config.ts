export type SmtpConfig = {
  host: string;
  port: 465;
  user: string;
  password: string;
  from: string;
};

export type SmtpEnv = Record<string, string | undefined>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HOST = /^(?=.{1,253}$)[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?$/;
const GENERIC_KEYS = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM"];

function clean(value: string | undefined): string {
  return (value ?? "").trim();
}

function cleanPassword(value: string | undefined): string {
  return clean(value).replace(/\s+/g, "");
}

export function hasGenericSmtpSettings(env: SmtpEnv): boolean {
  return GENERIC_KEYS.some((key) => clean(env[key]) !== "");
}

/**
 * Generic SMTP is deliberately restricted to implicit TLS on port 465.
 * A partial or unsupported configuration fails closed instead of falling back
 * to legacy Gmail credentials with a different sender identity.
 */
export function genericSmtpConfig(env: SmtpEnv): SmtpConfig | null {
  const host = clean(env.SMTP_HOST).toLowerCase();
  const port = clean(env.SMTP_PORT || "465");
  const user = clean(env.SMTP_USER);
  const password = cleanPassword(env.SMTP_PASSWORD);
  const from = clean(env.SMTP_FROM);
  if (
    !HOST.test(host) ||
    port !== "465" ||
    !EMAIL.test(user) ||
    password.length < 8 ||
    !EMAIL.test(from)
  ) {
    return null;
  }
  return { host, port: 465, user, password, from };
}

export function gmailSmtpConfig(userValue: string | undefined, passwordValue: string | undefined) {
  const user = clean(userValue);
  const password = cleanPassword(passwordValue);
  if (!EMAIL.test(user) || password.length < 8) return null;
  return { host: "smtp.gmail.com", port: 465 as const, user, password, from: user };
}
