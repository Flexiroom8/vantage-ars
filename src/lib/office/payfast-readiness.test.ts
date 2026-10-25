import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { payfastReadiness } from "./payfast-readiness.ts";

const complete = {
  PAYFAST_CHECKOUT_ENABLED: "true",
  PAYFAST_MODE: "sandbox",
  PAYFAST_MERCHANT_ID: "10000100",
  PAYFAST_MERCHANT_KEY: "merchant-key-secret",
  PAYFAST_PASSPHRASE: "passphrase-secret",
};

describe("PayFast gateway readiness", () => {
  it("fails closed by default and identifies missing settings by name only", () => {
    const result = payfastReadiness({});
    assert.equal(result.requested, false);
    assert.equal(result.configured, false);
    assert.equal(result.checkoutEnabled, false);
    assert.equal(result.missing.includes("PAYFAST_MERCHANT_ID"), true);
    assert.equal(JSON.stringify(result).includes("secret"), false);
  });

  it("validates a complete operator request without enabling checkout", () => {
    const result = payfastReadiness(complete);
    assert.equal(result.requested, true);
    assert.equal(result.configured, true);
    assert.equal(result.mode, "sandbox");
    assert.equal(result.checkoutEnabled, false);
    assert.deepEqual(result.missing, []);
    assert.deepEqual(result.invalid, []);
    assert.equal(JSON.stringify(result).includes("merchant-key-secret"), false);
    assert.equal(JSON.stringify(result).includes("passphrase-secret"), false);
  });

  it("rejects invalid modes, merchant IDs, and control characters", () => {
    const result = payfastReadiness({
      ...complete,
      PAYFAST_MODE: "production",
      PAYFAST_MERCHANT_ID: "merchant-100",
      PAYFAST_MERCHANT_KEY: "key\ninjected",
    });
    assert.deepEqual(result.invalid, [
      "PAYFAST_MODE",
      "PAYFAST_MERCHANT_ID",
      "PAYFAST_MERCHANT_KEY",
    ]);
    assert.equal(result.configured, false);
    assert.equal(result.checkoutEnabled, false);
  });

  it("requires explicit opt-in and every credential even in live mode", () => {
    const { PAYFAST_PASSPHRASE: _passphrase, ...partial } = {
      ...complete,
      PAYFAST_CHECKOUT_ENABLED: "yes",
      PAYFAST_MODE: "live",
    };
    const result = payfastReadiness(partial);
    assert.equal(result.requested, false);
    assert.equal(result.configured, false);
    assert.equal(result.missing.includes("PAYFAST_PASSPHRASE"), true);
    assert.equal(result.mode, "live");
    assert.equal(result.checkoutEnabled, false);
  });
});
