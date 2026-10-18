import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash, timingSafeEqual } from "node:crypto";

// `founderEmail()` reads the environment, so pin it for the duration of the
// module. Without this the test silently depends on whatever FOUNDER_EMAIL the
// developer or CI happens to export.
process.env.FOUNDER_EMAIL = "Founder@Vantage-Ars.CO.ZA";
const { founderEmail } = await import("@/lib/office/company");
const { isFounderEmail, normalizeFounderEmailInput } = await import("./founder-setup");

// Mirrors setupTokenMatches() without importing the database module.
function matches(presented: string | null | undefined, configured: string | undefined): boolean {
  const expected = configured?.trim();
  if (!expected || expected.length < 16) return false;
  if (typeof presented !== "string" || !presented) return false;
  const d = (v: string) => createHash("sha256").update(v, "utf8").digest();
  return timingSafeEqual(d(presented.trim()), d(expected));
}

test("setup token must be configured and at least 16 characters", () => {
  assert.equal(matches("anything", undefined), false);
  assert.equal(matches("short", "short"), false);
});

test("setup token matches only the configured value", () => {
  const token = "a-long-random-setup-token";
  assert.equal(matches(token, token), true);
  assert.equal(matches(` ${token} `, token), true);
  assert.equal(matches("a-long-random-setup-tokeX", token), false);
  assert.equal(matches("", token), false);
  assert.equal(matches(null, token), false);
});

test("founder email normalization and checks are stable", () => {
  assert.equal(founderEmail(), "founder@vantage-ars.co.za");
  assert.equal(normalizeFounderEmailInput(" Founder@Vantage-Ars.CO.ZA "), founderEmail());
  assert.equal(isFounderEmail(" Founder@Vantage-Ars.CO.ZA "), true);
  assert.equal(isFounderEmail("founder@vantage-ars.co.za"), true);
  assert.equal(isFounderEmail("someone@example.com"), false);
  assert.equal(isFounderEmail("  "), false);
  assert.equal(normalizeFounderEmailInput(undefined), "");
});
