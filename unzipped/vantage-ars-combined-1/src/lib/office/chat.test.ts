import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { chatName, officeChatReply } from "./chat.ts";

describe("live chat", () => {
  it("answers a price question without making it a quote", () => {
    const reply = officeChatReply("How much is a call out?");
    assert.equal(reply.includes("R690"), true);
    assert.equal(reply.includes("not a written quote"), true);
  });

  it("does not offer a refund or a remote fix", () => {
    assert.equal(officeChatReply("I want a refund").includes("cannot refund"), true);
    assert.equal(officeChatReply("The phones are down").includes("cannot sign in"), true);
  });

  it("rejects an empty name", () => {
    assert.equal(chatName("  "), null);
    assert.equal(chatName("Ada"), "Ada");
  });
});
