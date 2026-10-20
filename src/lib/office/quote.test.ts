import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { priceQuote } from "./quote.ts";

describe("published quotes", () => {
  it("prices remote labour from the 30-minute minimum", () => {
    const half = priceQuote({ rateId: "remote-support", location: "remote", quantity: 0.5 });
    assert.equal(half.ok, true);
    if (half.ok) assert.equal(half.cents, 34500);
    const below = priceQuote({ rateId: "remote-support", location: "remote", quantity: 0.25 });
    assert.equal(below.ok, false);
  });

  it("enforces the two-hour on-site minimum", () => {
    const short = priceQuote({ rateId: "onsite-support", location: "onsite", quantity: 1 });
    assert.equal(short.ok, false);
    const two = priceQuote({ rateId: "onsite-support", location: "onsite", quantity: 2 });
    assert.equal(two.ok, true);
    if (two.ok) assert.equal(two.cents, 161000);
  });

  it("prices a network point from the published labour figure", () => {
    const points = priceQuote({ rateId: "network-point", location: "onsite", quantity: 3 });
    assert.equal(points.ok, true);
    if (points.ok) assert.equal(points.cents, 241500);
  });

  it("refuses a retainer and a ranged estimate", () => {
    assert.equal(priceQuote({ rateId: "retainer", location: "remote", quantity: 1 }).ok, false);
    assert.equal(
      priceQuote({ rateId: "network-setup", location: "remote", quantity: 1 }).ok,
      false,
    );
  });
});
