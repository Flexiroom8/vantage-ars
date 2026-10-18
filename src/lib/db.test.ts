import { test } from "node:test";
import assert from "node:assert/strict";
import { advisoryKey } from "./db";

// pg_advisory_xact_lock takes a signed bigint. A naive unsigned FNV-1a mask
// can land above 2^63 — exactly what "vantage-ars:audit-chain" does
// (16358042832438545941) — which made every chain write fail on Neon with
// `value "16358042832438545941" is out of range for type bigint`.
const SIGNED_MIN = -9223372036854775808n;
const SIGNED_MAX = 9223372036854775807n;

test("advisoryKey stays inside Postgres's signed bigint range", () => {
  for (const name of [
    "vantage-ars:audit-chain",
    "chain",
    "claim-work",
    "audit-head",
    "duty-lock",
    "",
    "\u00e9\u4e2d\u6587",
  ]) {
    const key = advisoryKey(name);
    assert.ok(key >= SIGNED_MIN && key <= SIGNED_MAX, `${name} -> ${key}`);
  }
});

test("advisoryKey is deterministic and lossless", () => {
  assert.equal(advisoryKey("vantage-ars:audit-chain"), BigInt.asIntN(64, 16358042832438545941n));
  assert.equal(advisoryKey("vantage-ars:audit-chain") < 0n, true);
  assert.equal(advisoryKey("a") !== advisoryKey("b"), true);
  // Round-trip through signed keeps one distinct key per hash value.
  for (const name of ["vantage-ars:audit-chain", "x", "y"]) {
    assert.equal(advisoryKey(name), BigInt.asIntN(64, BigInt.asUintN(64, advisoryKey(name))));
  }
});
