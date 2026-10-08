import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clientKey, createRateLimiter, str, validEmail } from "./guard.ts";

const headers = (map: Record<string, string>) => ({ get: (name: string) => map[name.toLowerCase()] ?? null });

describe("guard", () => {
  it("never throws on non-string input", () => {
    assert.equal(str(undefined), "");
    assert.equal(str(42), "");
    assert.equal(str({ trim: 1 }), "");
    assert.equal(str("abcdef", 3), "abc");
  });

  it("prefers edge headers and ignores a spoofed first forwarded hop", () => {
    assert.equal(clientKey(headers({ "cf-connecting-ip": "1.2.3.4", "x-forwarded-for": "9.9.9.9" })), "1.2.3.4");
    assert.equal(clientKey(headers({ "x-forwarded-for": "6.6.6.6, 10.0.0.1, 5.5.5.5" })), "5.5.5.5");
    assert.equal(clientKey(undefined), "local");
    assert.equal(clientKey(headers({})), "local");
  });

  it("limits inside the window and recovers after it", () => {
    const limiter = createRateLimiter(2, 1000);
    assert.equal(limiter.allow("a", 0), true);
    assert.equal(limiter.allow("a", 10), true);
    assert.equal(limiter.allow("a", 20), false);
    assert.equal(limiter.allow("b", 20), true);
    assert.equal(limiter.allow("a", 1500), true);
  });

  it("prunes idle keys and stays bounded under a flood", () => {
    const limiter = createRateLimiter(1, 1000, 3);
    limiter.allow("a", 0);
    limiter.allow("b", 0);
    limiter.allow("c", 0);
    assert.equal(limiter.allow("d", 10), false); // full, nothing expired yet
    assert.equal(limiter.allow("d", 2000), true); // idle keys pruned
    assert.ok(limiter.size() <= 3);
  });

  it("validates emails without accepting header-injection characters", () => {
    assert.equal(validEmail("a@b.co"), true);
    assert.equal(validEmail("a@b"), false);
    assert.equal(validEmail("a b@c.co"), false);
    assert.equal(validEmail("a@b.co,evil@x.co"), false);
    assert.equal(validEmail("<a@b.co>"), false);
  });
});
