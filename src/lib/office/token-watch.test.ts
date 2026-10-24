import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyCloudflareToken, tokenVerdict } from "./token-watch.ts";

describe("Cloudflare token shape", () => {
  it("reports a missing token without inventing one", () => {
    const result = classifyCloudflareToken("  ");
    assert.equal(result.state, "missing");
    assert.equal(result.detail.includes("not set"), true);
  });

  it("rejects a pasted prefix and does not repeat the secret", () => {
    const secret = "cfat_this_is_not_a_dashboard_token_value";
    const result = classifyCloudflareToken(secret);
    assert.equal(result.state, "unusable");
    assert.equal(result.detail.includes(secret), false);
    assert.equal(result.detail.includes("cfat_"), true);
  });

  it("treats a long unmarked value as present and hides it", () => {
    const secret = "a".repeat(40);
    const result = classifyCloudflareToken(secret);
    assert.equal(result.state, "present");
    assert.equal(result.detail.includes(secret), false);
    assert.equal(result.detail.includes("40"), true);
  });

  it("says accepted only when Cloudflare says so", () => {
    const shape = classifyCloudflareToken("a".repeat(40));
    assert.equal(tokenVerdict(shape, { ok: true, status: 200 }).state, "accepted");
    assert.equal(tokenVerdict(shape, { ok: false, status: 401 }).state, "rejected");
    assert.equal(tokenVerdict(shape, null).state, "unreachable");
  });
});
