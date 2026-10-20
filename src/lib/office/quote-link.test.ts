import assert from "node:assert/strict";
import { test } from "node:test";
import { linkExpiry, linkState, parseCustomerAnswer, plausibleToken } from "./quote-link.ts";

const now = new Date("2026-10-10T10:00:00Z");
const future = "2026-11-01T00:00:00Z";
const past = "2026-10-01T00:00:00Z";

test("token shape check rejects junk before any lookup", () => {
  assert.equal(plausibleToken("a".repeat(43)), true);
  assert.equal(plausibleToken("short"), false);
  assert.equal(plausibleToken("x".repeat(43) + "'; drop"), false);
  assert.equal(plausibleToken(42), false);
});

test("links expire after 30 days", () => {
  assert.equal(linkExpiry(now).toISOString(), "2026-11-09T10:00:00.000Z");
});

test("link state follows the answer, revocation, document and expiry", () => {
  const open = { expiresAt: future, revokedAt: null, answer: null };
  assert.equal(linkState(open, "approved_unsent", now), "open");
  assert.equal(linkState({ ...open, expiresAt: past }, "approved_unsent", now), "expired");
  assert.equal(linkState({ ...open, revokedAt: past }, "approved_unsent", now), "revoked");
  assert.equal(linkState({ ...open, answer: "accepted" }, "accepted", now), "accepted");
  assert.equal(linkState(open, "declined", now), "declined");
  assert.equal(linkState(open, "superseded", now), "closed");
});

test("customer answer needs a name, and acceptance needs the box ticked", () => {
  assert.equal(
    parseCustomerAnswer({ outcome: "accepted", name: "Ann Lee", agree: false }).ok,
    false,
  );
  assert.equal(parseCustomerAnswer({ outcome: "accepted", name: "A", agree: true }).ok, false);
  assert.equal(parseCustomerAnswer({ outcome: "maybe", name: "Ann Lee" }).ok, false);
  assert.deepEqual(
    parseCustomerAnswer({ outcome: "accepted", name: "  Ann   Lee ", agree: true }),
    {
      ok: true,
      outcome: "accepted",
      name: "Ann Lee",
      note: "",
    },
  );
  const declined = parseCustomerAnswer({
    outcome: "declined",
    name: "Ann Lee",
    note: "Too far out",
  });
  assert.equal(declined.ok && declined.note, "Too far out");
});
