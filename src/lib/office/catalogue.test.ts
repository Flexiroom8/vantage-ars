import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PUBLISHED_RATES, rateAmount, rateAmountLabel } from "./catalogue.ts";

describe("published rate amounts", () => {
  it("reads the first figure from a simple price line", () => {
    assert.equal(rateAmountLabel("remote-support"), "R690");
    assert.equal(rateAmount("remote-support"), 690);
  });

  it("keeps a thousands separator intact in the label", () => {
    assert.equal(rateAmountLabel("after-hours"), "R1,035");
    assert.equal(rateAmount("after-hours"), 1035);
  });

  it("reads the first figure from a range", () => {
    assert.equal(rateAmountLabel("network-setup"), "R1,380");
    assert.equal(rateAmount("network-setup"), 1380);
  });

  it("returns nothing for a line with no figure", () => {
    assert.equal(rateAmountLabel("third-party"), "");
    assert.equal(rateAmount("third-party"), 0);
  });

  it("returns nothing for an unknown rate", () => {
    assert.equal(rateAmountLabel("does-not-exist"), "");
    assert.equal(rateAmount("does-not-exist"), 0);
  });

  it("agrees with every published figure it can parse", () => {
    for (const rate of PUBLISHED_RATES) {
      const label = rateAmountLabel(rate.id);
      if (/R\d/.test(rate.price)) {
        assert.notEqual(label, "", rate.id);
        assert.ok(rate.price.includes(label), `${rate.id}: ${label} not in ${rate.price}`);
      }
    }
  });
});

describe("published rate machine values", () => {
  it("strips the currency mark and thousands separators", async () => {
    const { ratePriceValue } = await import("./catalogue.ts");
    assert.equal(ratePriceValue("remote-support"), "690");
    assert.equal(ratePriceValue("after-hours"), "1035");
    assert.equal(ratePriceValue("third-party"), null);
  });
});
