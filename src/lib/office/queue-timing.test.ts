import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pruneKeepDays, retryBackoffMinutes, staleClaimMinutes } from "./queue-timing.ts";

describe("the retry backoff", () => {
  it("doubles, from two minutes", () => {
    assert.equal(retryBackoffMinutes(1), 2);
    assert.equal(retryBackoffMinutes(2), 4);
    assert.equal(retryBackoffMinutes(3), 8);
    assert.equal(retryBackoffMinutes(4), 16);
  });

  it("is never more than an hour", () => {
    assert.equal(retryBackoffMinutes(5), 32);
    assert.equal(retryBackoffMinutes(6), 60);
    assert.equal(retryBackoffMinutes(20), 60);
  });

  it("never waits for less than two minutes", () => {
    assert.equal(retryBackoffMinutes(0), 2);
    assert.equal(retryBackoffMinutes(-3), 2);
  });
});

describe("the stale claim window", () => {
  it("is thirty minutes by default", () => {
    assert.equal(staleClaimMinutes(), 30);
  });

  it("treats zero as the default, not as now", () => {
    assert.equal(staleClaimMinutes(0), 30);
  });

  it("never reclaims instantly", () => {
    assert.equal(staleClaimMinutes(1), 1);
  });
});

describe("the pruning window", () => {
  it("is thirty days by default", () => {
    assert.equal(pruneKeepDays(), 30);
  });

  it("treats zero as the default", () => {
    assert.equal(pruneKeepDays(0), 30);
  });

  it("keeps at least a day", () => {
    assert.equal(pruneKeepDays(-5), 1);
  });
});
