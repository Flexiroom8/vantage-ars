import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BUDGET_LEVELS,
  CAPSULE_BUDGET_CENTS,
  DAILY_BUDGET_CENTS,
  FIRE_BUDGET_CENTS,
  MONTHLY_BUDGET_CENTS,
  admit,
  budgetRules,
  costPerTask,
  estimateCost,
  formatRefusal,
  type BudgetRule,
  type BudgetState,
} from "./cost.ts";

const RATE = { input: 1000, output: 2000 };

function state(overrides: Partial<BudgetState> = {}): BudgetState {
  return {
    spentTodayCents: 0,
    spentThisMonthCents: 0,
    spentThisFireCents: 0,
    callsThisFire: 0,
    callsToday: 0,
    callsThisMonth: 0,
    ...overrides,
  };
}

/** A call that costs exactly `cents`. */
function estimateOf(cents: number): { inputTokens: number; outputTokens: number } {
  return { inputTokens: cents * 1000, outputTokens: 0 };
}

describe("estimating a call", () => {
  it("is exact for whole-rand figures", () => {
    assert.equal(estimateCost({ inputTokens: 1_000_000, outputTokens: 0 }, RATE), 1000);
    assert.equal(estimateCost({ inputTokens: 0, outputTokens: 1_000_000 }, RATE), 2000);
    assert.equal(estimateCost({ inputTokens: 1_000_000, outputTokens: 1_000_000 }, RATE), 3000);
  });

  it("rounds up rather than charging the office less than the call cost", () => {
    // 1 token at 1000 cents per million tokens is a thousandth of a cent.
    assert.equal(estimateCost({ inputTokens: 1, outputTokens: 0 }, RATE), 1);
    assert.equal(estimateCost({ inputTokens: 0, outputTokens: 1 }, RATE), 1);
    assert.equal(estimateCost({ inputTokens: 1_500_000, outputTokens: 0 }, RATE), 1500);
  });

  it("never charges less than the true fraction of a cent", () => {
    for (let tokens = 1; tokens < 40; tokens += 1) {
      const cost = estimateCost({ inputTokens: tokens, outputTokens: 0 }, RATE);
      const true_ = (tokens * RATE.input) / 1_000_000;
      assert.ok(cost >= true_, `${cost} under-charges ${true_}`);
      assert.ok(cost < true_ + 1, `${cost} over-charges ${true_}`);
    }
  });

  it("charges nothing for a call that costs nothing", () => {
    assert.equal(estimateCost({ inputTokens: 0, outputTokens: 0 }, RATE), 0);
  });

  it("refuses to charge for a negative or nonsensical estimate", () => {
    assert.equal(estimateCost({ inputTokens: -100, outputTokens: -100 }, RATE), 0);
  });
});

describe("the default envelope", () => {
  it("is the four levels, narrowest first", () => {
    assert.deepEqual([...BUDGET_LEVELS], ["capsule", "fire", "daily", "monthly"]);
    assert.deepEqual(
      budgetRules().map((rule) => rule.level),
      ["capsule", "fire", "daily", "monthly"],
    );
  });

  it("spends the agreed envelope", () => {
    const ceilings = new Map(budgetRules().map((rule) => [rule.level, rule.ceilingCents]));
    assert.equal(ceilings.get("capsule"), 200);
    assert.equal(ceilings.get("fire"), 1500);
    assert.equal(ceilings.get("daily"), 12000);
    assert.equal(ceilings.get("monthly"), 250000);
    assert.equal(CAPSULE_BUDGET_CENTS, 200);
    assert.equal(FIRE_BUDGET_CENTS, 1500);
    assert.equal(DAILY_BUDGET_CENTS, 12000);
    assert.equal(MONTHLY_BUDGET_CENTS, 250000);
  });

  it("hands out a fresh envelope every time", () => {
    const rules = budgetRules();
    rules[0].ceilingCents = 1;
    assert.equal(budgetRules()[0].ceilingCents, CAPSULE_BUDGET_CENTS);
  });
});

describe("admitting a call", () => {
  it("admits a call that fits every level", () => {
    const verdict = admit(budgetRules(), estimateOf(10), RATE, state());
    assert.equal(verdict.admitted, true);
    assert.equal(verdict.level, null);
    assert.equal(verdict.arithmetic.shortfallCents, 0);
  });

  it("refuses at the capsule when a single call is too expensive", () => {
    const verdict = admit(budgetRules(), estimateOf(300), RATE, state());
    assert.equal(verdict.admitted, false);
    assert.equal(verdict.level, "capsule");
    assert.deepEqual(verdict.arithmetic, {
      limitCents: 200,
      spentCents: 0,
      projectedCents: 300,
      shortfallCents: 100,
    });
  });

  it("refuses at the fire when the agent has burned its fire budget", () => {
    const verdict = admit(
      budgetRules(),
      estimateOf(200),
      RATE,
      state({ spentThisFireCents: 1400 }),
    );
    assert.equal(verdict.admitted, false);
    assert.equal(verdict.level, "fire");
    assert.deepEqual(verdict.arithmetic, {
      limitCents: 1500,
      spentCents: 1400,
      projectedCents: 1600,
      shortfallCents: 100,
    });
  });

  it("refuses at the daily budget when the day is spent", () => {
    const verdict = admit(budgetRules(), estimateOf(200), RATE, state({ spentTodayCents: 11900 }));
    assert.equal(verdict.admitted, false);
    assert.equal(verdict.level, "daily");
    assert.deepEqual(verdict.arithmetic, {
      limitCents: 12000,
      spentCents: 11900,
      projectedCents: 12100,
      shortfallCents: 100,
    });
  });

  it("refuses at the monthly budget when the month is spent", () => {
    const verdict = admit(
      budgetRules(),
      estimateOf(200),
      RATE,
      state({ spentThisMonthCents: 249900 }),
    );
    assert.equal(verdict.admitted, false);
    assert.equal(verdict.level, "monthly");
    assert.deepEqual(verdict.arithmetic, {
      limitCents: 250000,
      spentCents: 249900,
      projectedCents: 250100,
      shortfallCents: 100,
    });
  });

  it("refuses at the first level that is exceeded, not the widest", () => {
    const verdict = admit(
      budgetRules(),
      estimateOf(200),
      RATE,
      state({ spentTodayCents: 13000, spentThisMonthCents: 260000 }),
    );
    assert.equal(verdict.level, "daily");
  });

  it("never reports a negative shortfall", () => {
    for (const spend of [0, 100, 11999, 12000, 250000]) {
      const verdict = admit(
        budgetRules(),
        estimateOf(200),
        RATE,
        state({ spentTodayCents: spend, spentThisMonthCents: spend }),
      );
      assert.ok(verdict.arithmetic.shortfallCents >= 0);
    }
  });

  it("treats a level with no rule as no limit at all", () => {
    const rules: BudgetRule[] = [{ level: "capsule", ceilingCents: 200 }];
    const verdict = admit(
      rules,
      estimateOf(200),
      RATE,
      state({ spentTodayCents: 999_999, spentThisMonthCents: 999_999 }),
    );
    assert.equal(verdict.admitted, true);
    assert.equal(verdict.level, null);
  });

  it("treats a rule of zero as a hard zero, not as no limit", () => {
    const rules: BudgetRule[] = [{ level: "capsule", ceilingCents: 0 }];
    const verdict = admit(rules, estimateOf(1), RATE, state());
    assert.equal(verdict.admitted, false);
    assert.equal(verdict.level, "capsule");
    assert.deepEqual(verdict.arithmetic, {
      limitCents: 0,
      spentCents: 0,
      projectedCents: 1,
      shortfallCents: 1,
    });
  });

  it("admits a call that costs nothing even under a hard zero", () => {
    const rules: BudgetRule[] = [{ level: "capsule", ceilingCents: 0 }];
    const verdict = admit(rules, { inputTokens: 0, outputTokens: 0 }, RATE, state());
    assert.equal(verdict.admitted, true);
  });
});

describe("the refusal", () => {
  it("names the limit, the spend, the projection and the shortfall", () => {
    const verdict = admit(
      budgetRules(),
      estimateOf(200),
      RATE,
      state({ spentThisFireCents: 1400 }),
    );
    const message = formatRefusal(verdict);
    assert.equal(message.includes("1500 cents"), true, "the limit is missing");
    assert.equal(message.includes("1400 cents have been spent"), true, "the spend is missing");
    assert.equal(message.includes("1600 cents"), true, "the projection is missing");
    assert.equal(message.includes("100 cents over"), true, "the shortfall is missing");
    assert.equal(message.includes("fire"), true, "the level is missing");
  });

  it("says plainly that the call was not made", () => {
    const verdict = admit(budgetRules(), estimateOf(300), RATE, state());
    assert.equal(formatRefusal(verdict).includes("The call was not made."), true);
  });

  it("leaks nothing but the arithmetic", () => {
    const verdict = admit(budgetRules(), estimateOf(300), RATE, state());
    const message = formatRefusal(verdict);
    assert.equal(message.toLowerCase().includes("token"), false);
    assert.equal(message.includes("300000"), false);
  });

  it("says so when there is no refusal", () => {
    const verdict = admit(budgetRules(), estimateOf(10), RATE, state());
    const message = formatRefusal(verdict);
    assert.equal(message.includes("No refusal."), true);
    assert.equal(message.includes("10 cents"), true);
  });
});

describe("cost per completed task", () => {
  it("divides the task's cost by the number of completed attempts", () => {
    const rows = costPerTask([
      { taskId: "task-1", costCents: 30, completed: false },
      { taskId: "task-1", costCents: 40, completed: false },
      { taskId: "task-1", costCents: 50, completed: true },
    ]);
    assert.deepEqual(
      rows.map((row) => row.costPerCompletedTaskCents),
      [0, 0, 120],
    );
  });

  it("gives a task with no completion a zero rather than a flattering average", () => {
    const rows = costPerTask([
      { taskId: "task-2", costCents: 30, completed: false },
      { taskId: "task-2", costCents: 40, completed: false },
    ]);
    assert.deepEqual(
      rows.map((row) => row.costPerCompletedTaskCents),
      [0, 0],
    );
  });

  it("keeps each task's cost to itself", () => {
    const rows = costPerTask([
      { taskId: "task-a", costCents: 100, completed: true },
      { taskId: "task-b", costCents: 900, completed: true },
    ]);
    assert.deepEqual(
      rows.map((row) => row.costPerCompletedTaskCents),
      [100, 900],
    );
  });

  it("carries the row's own facts through unchanged", () => {
    const rows = costPerTask([{ taskId: "task-a", costCents: 100, completed: true }]);
    assert.deepEqual(rows, [
      { taskId: "task-a", costCents: 100, completed: true, costPerCompletedTaskCents: 100 },
    ]);
  });

  it("reports nothing for no work at all", () => {
    assert.deepEqual(costPerTask([]), []);
  });
});
