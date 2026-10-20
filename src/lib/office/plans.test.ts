import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PLANS,
  planById,
  planForRate,
  planIntegrity,
  recurringPlans,
  type PlanCycle,
  type PlanDefinition,
} from "./plans.ts";
import { PUBLISHED_RATES } from "./catalogue.ts";

/**
 * The price on the published card, read independently of the plan list so the
 * test does not simply repeat the module's own arithmetic.
 */
function publishedPriceCents(rateId: string): number {
  const rate = PUBLISHED_RATES.find((item) => item.id === rateId);
  if (!rate) assert.fail(`no published rate line called ${rateId}`);
  const match = rate.price.replace(/,/g, "").match(/R\s*([\d.]+)/);
  if (!match) assert.fail(`cannot read a price out of "${rate.price}"`);
  return Math.round(Number(match[1]) * 100);
}

function plan(id: string): PlanDefinition {
  const found = planById(id);
  if (!found) assert.fail(`no plan called ${id}`);
  return found;
}

const RECURRING: string[] = ["managed-support", "health-watch"];
const ONE_OFF: string[] = [
  "service-report",
  "billing-audit",
  "handover-pack",
  "continuity-plan",
  "sla-review",
];

describe("the productised service list", () => {
  it("has plans in it", () => {
    assert.equal(PLANS.length > 0, true);
    const ids = PLANS.map((item) => item.id);
    assert.equal(new Set(ids).size, ids.length, "two plans share an id");
  });

  it("gives every plan the same id as its published rate line", () => {
    for (const item of PLANS) {
      assert.equal(item.id, item.rateId);
    }
  });

  it("publishes a price for every plan", () => {
    for (const item of PLANS) {
      assert.equal(item.priceCents > 0, true, `${item.id} has no price`);
      assert.equal(Number.isInteger(item.priceCents), true, `${item.id} price is not whole cents`);
    }
  });
});

describe("plan prices and the published rate card", () => {
  it("never sells a plan at a figure the public card no longer shows", () => {
    for (const item of PLANS) {
      assert.equal(
        item.priceCents,
        publishedPriceCents(item.rateId),
        `${item.id} is priced at ${item.priceCents} but the card says ${publishedPriceCents(item.rateId)}`,
      );
    }
  });

  it("points every plan at a rate line that exists and is offered", () => {
    for (const item of PLANS) {
      const rate = PUBLISHED_RATES.find((entry) => entry.id === item.rateId);
      if (!rate) assert.fail(`${item.id} has no published rate line`);
      assert.equal(rate.offered, true, `${item.id} points at a rate that is not offered`);
    }
  });

  it("keeps the rate title and the plan title in step", () => {
    for (const item of PLANS) {
      const rate = PUBLISHED_RATES.find((entry) => entry.id === item.rateId);
      if (!rate) assert.fail(`${item.id} has no published rate line`);
      assert.equal(rate.title, item.title);
    }
  });
});

describe("plan cycles", () => {
  it("bills the managed plans on a schedule", () => {
    for (const id of RECURRING) {
      const item = plan(id);
      assert.notEqual(item.cycle, "once", `${id} should bill on a schedule`);
      assert.equal(["monthly", "quarterly"].includes(item.cycle), true);
    }
  });

  it("charges the written reports once and only once", () => {
    for (const id of ONE_OFF) {
      assert.equal(plan(id).cycle, "once", `${id} should be a one-off`);
    }
  });

  it("lists the recurring plans and only the recurring plans", () => {
    const ids = recurringPlans().map((item) => item.id);
    assert.deepEqual([...ids].sort(), [...RECURRING].sort());
  });

  it("never calls a one-off plan a recurring one", () => {
    for (const item of PLANS) {
      const cycle: PlanCycle = item.cycle;
      if (cycle === "once") assert.equal(recurringPlans().includes(item), false);
      else assert.equal(recurringPlans().includes(item), true);
    }
  });
});

describe("plan integrity", () => {
  it("reports the current card as sound", () => {
    const result = planIntegrity();
    assert.equal(result.ok, true, result.detail);
    assert.equal(result.detail.includes(String(PLANS.length)), true);
  });

  it("counts the recurring plans in the detail line", () => {
    assert.equal(
      planIntegrity().detail.includes(`${recurringPlans().length} of them recurring`),
      true,
    );
  });
});

describe("looking up a plan", () => {
  it("finds a plan by its id", () => {
    assert.equal(planById("managed-support")?.id, "managed-support");
    assert.equal(planById("sla-review")?.id, "sla-review");
  });

  it("misses cleanly on an unknown id", () => {
    assert.equal(planById("no-such-plan"), undefined);
    assert.equal(planById(""), undefined);
  });

  it("finds the plan behind a rate line", () => {
    assert.equal(planForRate("managed-support")?.id, "managed-support");
    assert.equal(planForRate("billing-audit")?.id, "billing-audit");
  });

  it("misses cleanly on a rate line that is not a productised service", () => {
    assert.equal(planForRate("remote-support"), undefined);
    assert.equal(planForRate("third-party"), undefined);
    assert.equal(planForRate("no-such-rate"), undefined);
  });

  it("finds every plan by its own rate line", () => {
    for (const item of PLANS) {
      assert.equal(planForRate(item.rateId)?.id, item.id);
    }
  });
});
