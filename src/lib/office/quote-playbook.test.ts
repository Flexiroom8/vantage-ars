import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PUBLISHED_RATES } from "./catalogue.ts";
import { priceQuote } from "./quote.ts";
import { chooseQuote, quoteScopeLines } from "./quote-playbook.ts";

function choose(summary: string) {
  const choice = chooseQuote({ companyName: "Acme", summary });
  assert.ok(choice, `expected a quote for: ${summary}`);
  return choice;
}

describe("the autonomous quote playbook", () => {
  it("defaults to the paid assessment rather than guessing at a project", () => {
    const choice = choose("We need help with our IT and would like a price.");
    assert.equal(choice.rateId, "assessment");
    assert.equal(choice.location, "remote");
    assert.ok(choice.amountCents > 0);
  });

  it("uses a published product line when the customer names the product", () => {
    const choice = choose("Please quote monthly managed support for our office.");
    assert.equal(choice.rateId, "managed-support");
    assert.equal(choice.location, "remote");
    const priced = priceQuote({
      rateId: "managed-support",
      location: "remote",
      quantity: 1,
    });
    assert.ok(priced.ok);
    assert.equal(choice.amountCents, priced.cents);
  });

  it("prices a named number of network points on site", () => {
    const choice = choose("We need 20 network points installed in the new office.");
    assert.equal(choice.rateId, "network-point");
    assert.equal(choice.location, "onsite");
    assert.equal(choice.quantity, 20);
  });

  it("keeps the published minimums for on-site and after-hours work", () => {
    const onsite = choose("Please come on site to fix the switch.");
    assert.equal(onsite.rateId, "onsite-support");
    assert.equal(onsite.quantity, 2);

    const afterHours = choose("We need after-hours support this weekend.");
    assert.equal(afterHours.rateId, "after-hours");
    assert.equal(afterHours.quantity, 0.25);
  });

  it("diagnoses a VoIP fault instead of promising a repair", () => {
    const choice = choose("Our VoIP phone system is down and calls are dropping.");
    assert.equal(choice.rateId, "voip-diagnosis");
    assert.equal(choice.location, "remote");
  });

  it("only ever selects an offered published rate", () => {
    const summaries = [
      "managed support",
      "health and spend watch",
      "billing and rate audit",
      "handover pack",
      "business continuity plan",
      "SLA review",
      "service report",
      "20 network points",
      "on site survey",
      "after hours",
      "VoIP design",
      "VoIP install",
      "server infrastructure",
      "something vague",
    ];
    for (const summary of summaries) {
      const choice = choose(summary);
      const rate = PUBLISHED_RATES.find((item) => item.id === choice.rateId);
      assert.ok(rate, `${summary} chose an unknown rate`);
      assert.equal(rate.offered, true, `${summary} chose a withheld rate`);
    }
  });

  it("attaches limits, not promises, to the quote", () => {
    const lines = quoteScopeLines(choose("monthly managed support"));
    assert.ok(lines.length >= 2);
    assert.equal(
      lines.some((line) => /guarantee|always|never|within \d+ (hours?|days?)/i.test(line)),
      false,
    );
  });
});
