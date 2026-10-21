import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { publicStatus, type PublicStatusInput } from "./public-status.ts";

function healthy(overrides: Partial<PublicStatusInput> = {}): PublicStatusInput {
  return {
    checkedAt: "2026-10-21T09:00:00.000Z",
    company: "Vantage-ARS",
    version: "4.7.0",
    halted: false,
    database: { ok: true },
    chain: { ok: true },
    scheduler: { autonomyEnabled: true, overdue: false, consecutiveFailures: 0 },
    rateCard: { ok: true },
    ...overrides,
  };
}

describe("public status", () => {
  it("reports a healthy office as operational", () => {
    const status = publicStatus(healthy());
    assert.equal(status.ok, true);
    assert.equal(status.state, "operational");
    assert.equal(status.checks.length, 5);
    assert.ok(status.checks.every((check) => check.ok));
    assert.equal(status.checkedAt, "2026-10-21T09:00:00.000Z");
    assert.equal(status.version, "4.7.0");
  });

  it("degrades when the database cannot be read", () => {
    const status = publicStatus(healthy({ database: { ok: false } }));
    assert.equal(status.ok, false);
    assert.equal(status.state, "degraded");
    assert.equal(status.checks.find((check) => check.id === "records")?.ok, false);
  });

  it("degrades when the decision record does not verify", () => {
    const status = publicStatus(healthy({ chain: { ok: false } }));
    assert.equal(status.state, "degraded");
    assert.match(status.summary, /integrity or scheduling/i);
  });

  it("degrades when scheduled work is overdue", () => {
    const status = publicStatus(
      healthy({
        scheduler: { autonomyEnabled: true, overdue: true, consecutiveFailures: 0 },
      }),
    );
    assert.equal(status.state, "degraded");
    assert.equal(status.checks.find((check) => check.id === "scheduled-desk")?.ok, false);
  });

  it("degrades after repeated scheduler failures", () => {
    const status = publicStatus(
      healthy({
        scheduler: { autonomyEnabled: true, overdue: false, consecutiveFailures: 3 },
      }),
    );
    assert.equal(status.state, "degraded");
  });

  it("does not call a deliberately manual desk degraded", () => {
    const status = publicStatus(
      healthy({
        scheduler: { autonomyEnabled: false, overdue: false, consecutiveFailures: 0 },
      }),
    );
    assert.equal(status.state, "operational");
    assert.match(
      status.checks.find((check) => check.id === "scheduled-desk")?.detail ?? "",
      /paused/i,
    );
  });

  it("reports halted even when every other check passes", () => {
    const status = publicStatus(healthy({ halted: true }));
    assert.equal(status.ok, false);
    assert.equal(status.state, "halted");
    assert.match(status.summary, /halted/i);
  });

  it("degrades when the published rate card disagrees with the office", () => {
    const status = publicStatus(healthy({ rateCard: { ok: false } }));
    assert.equal(status.state, "degraded");
  });

  it("never carries money, customer or authority detail", () => {
    const payload = JSON.stringify(publicStatus(healthy()));
    for (const forbidden of [
      "treasury",
      "receivable",
      "payable",
      "customer",
      "delegation",
      "haltReason",
      "problems",
      "mail",
    ]) {
      assert.equal(payload.includes(forbidden), false, `public status leaked ${forbidden}`);
    }
  });
});
