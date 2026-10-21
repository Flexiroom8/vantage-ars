import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { KICK_AFTER_MINUTES, shouldKick } from "./kick.ts";
import { RECOVERY_COOLDOWN_MINUTES } from "./autonomy.ts";

describe("opportunistic nudge policy", () => {
  it("nudges a scheduler that has never ticked", () => {
    assert.equal(shouldKick(null, 0, 5), true);
  });

  it("leaves a fresh scheduler alone", () => {
    assert.equal(shouldKick(0, 0, 5), false);
    assert.equal(shouldKick(KICK_AFTER_MINUTES - 0.01, 0, 5), false);
  });

  it("nudges once a full cadence window has clearly lapsed", () => {
    assert.equal(shouldKick(KICK_AFTER_MINUTES, 0, 5), true);
    assert.equal(shouldKick(180, 0, 5), true);
  });

  it("waits out a circuit-breaker cooldown before allowing a recovery probe", () => {
    assert.equal(shouldKick(10, 5, 5), false);
    assert.equal(shouldKick(RECOVERY_COOLDOWN_MINUTES - 1, 5, 5), false);
    assert.equal(shouldKick(RECOVERY_COOLDOWN_MINUTES, 5, 5), true);
    assert.equal(shouldKick(null, 6, 5), false);
    assert.equal(shouldKick(999, 4, 5), true);
  });
});
