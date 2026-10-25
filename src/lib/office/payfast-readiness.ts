export type PayFastMode = "sandbox" | "live";

export type PayFastReadiness = {
  requested: boolean;
  configured: boolean;
  checkoutEnabled: false;
  mode: PayFastMode | null;
  missing: string[];
  invalid: string[];
};

export type PayFastEnv = Record<string, string | undefined>;

const REQUIRED_SETTINGS = [
  "PAYFAST_MODE",
  "PAYFAST_MERCHANT_ID",
  "PAYFAST_MERCHANT_KEY",
  "PAYFAST_PASSPHRASE",
] as const;

function clean(value: string | undefined): string {
  return value?.trim() ?? "";
}

function hasControlCharacters(value: string): boolean {
  return Array.from(value).some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code <= 31 || code === 127;
  });
}

/**
 * Reports whether the PayFast settings are complete and well-formed without
 * returning any credential values. This is readiness information only:
 * checkout remains disabled until a server-side adapter is implemented.
 */
export function payfastReadiness(env: PayFastEnv): PayFastReadiness {
  const missing = REQUIRED_SETTINGS.filter((key) => !clean(env[key]));
  const invalid: string[] = [];
  const rawMode = clean(env.PAYFAST_MODE);
  const mode: PayFastMode | null = rawMode === "sandbox" || rawMode === "live" ? rawMode : null;
  const merchantId = clean(env.PAYFAST_MERCHANT_ID);
  const merchantKey = clean(env.PAYFAST_MERCHANT_KEY);
  const passphrase = clean(env.PAYFAST_PASSPHRASE);

  if (rawMode && !mode) invalid.push("PAYFAST_MODE");
  if (merchantId && !/^\d{1,20}$/.test(merchantId)) invalid.push("PAYFAST_MERCHANT_ID");
  if (merchantKey && (merchantKey.length > 255 || hasControlCharacters(merchantKey))) {
    invalid.push("PAYFAST_MERCHANT_KEY");
  }
  if (passphrase && (passphrase.length > 255 || hasControlCharacters(passphrase))) {
    invalid.push("PAYFAST_PASSPHRASE");
  }

  return {
    requested: clean(env.PAYFAST_CHECKOUT_ENABLED).toLowerCase() === "true",
    configured: missing.length === 0 && invalid.length === 0,
    checkoutEnabled: false,
    mode,
    missing,
    invalid,
  };
}
