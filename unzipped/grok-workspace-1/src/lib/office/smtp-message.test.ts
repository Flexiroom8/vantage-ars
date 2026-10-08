import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { smtpData } from "./smtp-message.ts";

describe("smtp message", () => {
  it("keeps the subject on one line and dot-stuffs the body", () => {
    const data = smtpData({
      from: "juanlouw.greyling@gmail.com",
      to: "juanlouw.greyling@gmail.com",
      subject: "Vantage-ARS\nBcc: other@example.com",
      body: ".hidden\nSecond line",
    });
    assert.equal(data.includes("\nBcc:"), false);
    assert.equal(data.includes("Subject: Vantage-ARS Bcc: other@example.com"), true);
    assert.equal(data.includes("\r\n..hidden\r\n"), true);
    assert.equal(data.includes("other@example.com\r\nTo:"), false);
  });
});
