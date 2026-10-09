import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash, timingSafeEqual } from "node:crypto";

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
