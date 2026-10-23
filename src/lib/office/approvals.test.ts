import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { approvalAgeDays, isApprovalStale } from "./approvals.ts";

const NOW = Date.parse("2026-04-10T12:00:00.000Z");

describe("approval ageing", () => {
  it("counts whole days since filing", () => {
    assert.equal(approvalAgeDays("2026-04-10T11:00:00.000Z", NOW), 0);
    assert.equal(approvalAgeDays("2026-04-09T12:00:00.000Z", NOW), 1);
    assert.equal(approvalAgeDays("2026-04-03T12:00:00.000Z", NOW), 7);
  });

  it("treats seven days as stale", () => {
    assert.equal(isApprovalStale("2026-04-04T12:00:00.000Z", 7, NOW), false);
    assert.equal(isApprovalStale("2026-04-03T12:00:00.000Z", 7, NOW), true);
  });

  it("does not go negative or throw on a bad date", () => {
    assert.equal(approvalAgeDays("2026-04-11T12:00:00.000Z", NOW), 0);
    assert.equal(approvalAgeDays("not a date", NOW), 0);
  });
});
