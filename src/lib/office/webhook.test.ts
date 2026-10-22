import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { founderWebhookPayload, parseFounderWebhookUrl, postFounderWebhook } from "./webhook.ts";
import type { FounderNotice } from "./notice.ts";

const NOTICE: FounderNotice = {
  kind: "enquiry",
  subject: "Vantage-ARS · customer wrote",
  body: "A website enquiry was recorded. No email was sent to the customer.",
};

describe("parseFounderWebhookUrl", () => {
  it("accepts a plain HTTPS URL", () => {
    assert.equal(
      parseFounderWebhookUrl("https://hooks.example.com/vantage")?.hostname,
      "hooks.example.com",
    );
  });

  it("rejects HTTP, credentials, malformed values and emptiness", () => {
    for (const raw of [
      undefined,
      "",
      "http://hooks.example.com/vantage",
      "https://user:pass@hooks.example.com/vantage",
      "not a url",
      "ftp://hooks.example.com/vantage",
    ]) {
      assert.equal(parseFounderWebhookUrl(raw), null, String(raw));
    }
  });
});

describe("founderWebhookPayload", () => {
  it("carries the notice and the source", () => {
    const parsed = JSON.parse(founderWebhookPayload(NOTICE)) as Record<string, string>;
    assert.equal(parsed.subject, NOTICE.subject);
    assert.equal(parsed.kind, "enquiry");
    assert.equal(parsed.source, "vantage-ars");
    assert.equal(parsed.text.includes(NOTICE.body), true);
    assert.equal(parsed.content.includes(NOTICE.body), true);
  });

  it("caps a very long notice", () => {
    const long = founderWebhookPayload({ ...NOTICE, body: "x".repeat(5000) });
    assert.equal(long.length < 6000, true);
    assert.equal(long.includes("…"), true);
  });
});

describe("postFounderWebhook", () => {
  it("does nothing when no URL is configured", async () => {
    const result = await postFounderWebhook(NOTICE, undefined);
    assert.equal(result.ok, false);
  });

  it("posts the notice and reports a non-2xx answer", async () => {
    let seen = "";
    const ok = await postFounderWebhook(
      NOTICE,
      "https://hooks.example.com/x",
      async (url, init) => {
        seen = `${url} ${String(init.body)}`;
        return new Response("ok", { status: 200 });
      },
    );
    assert.equal(ok.ok, true);
    assert.equal(seen.includes("hooks.example.com"), true);
    assert.equal(seen.includes("customer wrote"), true);

    const failed = await postFounderWebhook(
      NOTICE,
      "https://hooks.example.com/x",
      async () => new Response("no", { status: 500 }),
    );
    assert.equal(failed.ok, false);
    assert.equal(failed.detail.includes("500"), true);
  });
});
