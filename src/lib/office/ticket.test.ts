import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { nextTicketStatus } from "./ticket.ts";

describe("ticket status", () => {
  it("starts an open ticket and then resolves it", () => {
    assert.equal(nextTicketStatus("open", "in_progress").ok, true);
    assert.equal(nextTicketStatus("in_progress", "resolved").ok, true);
  });

  it("does not skip ahead or reopen", () => {
    assert.equal(nextTicketStatus("open", "resolved").ok, false);
    assert.equal(nextTicketStatus("resolved", "in_progress").ok, false);
    assert.equal(nextTicketStatus("in_progress", "in_progress").ok, false);
  });
});
