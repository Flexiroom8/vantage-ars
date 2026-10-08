import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatZar, vatOn } from "./money.ts";

describe("money", () => {
  it("rounds VAT to whole cents", () => {
    assert.equal(vatOn(10000), 1500);
    assert.equal(vatOn(333), 50);
    assert.equal(vatOn(0), 0);
  });
  it("formats rand amounts from cents", () => {
    assert.match(formatZar(123456).replace(/\s/g, ""), /1.?234[,.]56/);
    assert.match(formatZar(0), /0[,.]00/);
  });
});
