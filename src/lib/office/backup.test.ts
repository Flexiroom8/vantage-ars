import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BACKUP_TABLES, buildBackup, verifyBackup } from "./backup.ts";

const tables = { leads: [{ id: "a", name: "Harbour & Co" }], approvals: [] };

describe("backup", () => {
  it("verifies a file it just built, even after a JSON round trip", () => {
    const file = buildBackup(tables, "2026-10-05T00:00:00.000Z");
    assert.deepEqual(file.rowCounts, { leads: 1, approvals: 0 });
    assert.deepEqual(verifyBackup(JSON.parse(JSON.stringify(file))), { ok: true });
  });
  it("detects an edited row", () => {
    const file = JSON.parse(JSON.stringify(buildBackup(tables)));
    file.tables.leads[0].name = "Someone Else";
    assert.equal(verifyBackup(file).ok, false);
  });
  it("detects a changed row count and rejects other formats", () => {
    const file = JSON.parse(JSON.stringify(buildBackup(tables)));
    file.rowCounts.leads = 5;
    assert.equal(verifyBackup(file).ok, false);
    assert.equal(verifyBackup({ format: "other" }).ok, false);
    assert.equal(verifyBackup(null).ok, false);
  });
  it("never exports credential tables", () => {
    for (const name of ["user", "session", "account", "verification"]) {
      assert.equal((BACKUP_TABLES as readonly string[]).includes(name), false);
    }
  });
});
