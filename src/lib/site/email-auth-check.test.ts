import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { checkEmailAuth, emailAuthSummary } from "./email-auth-check.ts";

describe("email authentication DNS checker", () => {
  it("checks SPF, DMARC and the customer-supplied DKIM selector", async () => {
    const queried: string[] = [];
    const result = await checkEmailAuth("https://Example.co.za./", "MAIL1", async (name) => {
      queried.push(name);
      if (name === "example.co.za") return ["v=spf1 include:mail.example -all"];
      if (name === "_dmarc.example.co.za") return ["v=DMARC1; p=reject"];
      return ["v=DKIM1; p=public-key"];
    });

    assert.deepEqual(queried.sort(), [
      "_dmarc.example.co.za",
      "example.co.za",
      "mail1._domainkey.example.co.za",
    ]);
    assert.equal(result.spf.state, "found");
    assert.equal(result.dmarc.state, "found");
    assert.equal(result.dkim.state, "found");
    assert.match(emailAuthSummary(result), /does not verify message alignment or delivery/);
  });

  it("deduplicates repeated TXT records and tolerates whitespace", async () => {
    const result = await checkEmailAuth(" example.org ", "selector", async (name) => {
      if (name === "example.org") {
        return [" v=spf1 -all ", '"v=spf1 -all"', "other=record"];
      }
      return [];
    });

    assert.equal(result.spf.state, "found");
    assert.deepEqual(result.spf.records, ["v=spf1 -all"]);
  });

  it("flags missing and duplicate policy records and rejects invalid names", async () => {
    const result = await checkEmailAuth("example.org", "selector", async (name) =>
      name === "example.org" ? ["v=spf1 -all", "v=spf1 ~all", "other=record"] : [],
    );
    assert.equal(result.spf.state, "multiple");
    assert.equal(result.dmarc.state, "missing");
    assert.equal(result.dkim.state, "missing");
    await assert.rejects(
      checkEmailAuth("not a domain", "selector", async () => []),
      /valid domain/,
    );
    await assert.rejects(
      checkEmailAuth("example.org", "", async () => []),
      /DKIM selector/,
    );
  });
});
