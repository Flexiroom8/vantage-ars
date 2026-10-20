import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  addMonths,
  annualEquivalentCents,
  cycleLabel,
  cycleLengthDays,
  cycleMonths,
  cycleShortLabel,
  cycleWindow,
  monthlyEquivalentCents,
  nextCycleStart,
} from "./subscription.ts";

/** Midday UTC, so the Africa/Johannesburg date rendering cannot shift a day. */
const START = "2026-03-01T12:00:00.000Z";
const END = "2026-03-31T12:00:00.000Z";

describe("month arithmetic", () => {
  it("adds a whole month", () => {
    assert.equal(addMonths(START, 1), "2026-04-01T12:00:00.000Z");
  });

  it("clamps the day to the end of a shorter month", () => {
    assert.equal(addMonths("2026-01-31T12:00:00.000Z", 1), "2026-02-28T12:00:00.000Z");
    assert.equal(addMonths("2026-03-31T12:00:00.000Z", 1), "2026-04-30T12:00:00.000Z");
  });

  it("clamps to 29 February in a leap year", () => {
    assert.equal(addMonths("2028-01-31T12:00:00.000Z", 1), "2028-02-29T12:00:00.000Z");
  });

  it("keeps the day when the target month is long enough", () => {
    assert.equal(addMonths("2026-03-15T12:00:00.000Z", 1), "2026-04-15T12:00:00.000Z");
    assert.equal(addMonths("2026-04-15T12:00:00.000Z", 1), "2026-05-15T12:00:00.000Z");
  });

  it("crosses a year boundary", () => {
    assert.equal(addMonths("2026-11-15T12:00:00.000Z", 3), "2027-02-15T12:00:00.000Z");
    assert.equal(addMonths("2026-12-31T12:00:00.000Z", 1), "2027-01-31T12:00:00.000Z");
  });

  it("keeps the time of day", () => {
    assert.equal(addMonths("2026-03-01T09:30:15.500Z", 2), "2026-05-01T09:30:15.500Z");
  });

  it("returns the same instant when asked for no months", () => {
    assert.equal(addMonths(START, 0), START);
  });
});

describe("the billing cycle", () => {
  it("knows how long each cycle is", () => {
    assert.equal(cycleMonths("monthly"), 1);
    assert.equal(cycleMonths("quarterly"), 3);
    assert.equal(cycleMonths("once"), 0);
  });

  it("knows how long a cycle runs for in days", () => {
    assert.equal(cycleLengthDays("monthly"), 30);
    assert.equal(cycleLengthDays("quarterly"), 91);
    assert.equal(cycleLengthDays("once"), 0);
  });

  it("starts a monthly cycle exactly one month later", () => {
    assert.equal(nextCycleStart(START, "monthly"), addMonths(START, 1));
    assert.equal(nextCycleStart(START, "monthly"), "2026-04-01T12:00:00.000Z");
  });

  it("starts a quarterly cycle exactly three months later", () => {
    assert.equal(nextCycleStart(START, "quarterly"), addMonths(START, 3));
    assert.equal(nextCycleStart(START, "quarterly"), "2026-06-01T12:00:00.000Z");
  });

  it("does not move a one-off", () => {
    assert.equal(nextCycleStart(START, "once"), START);
  });
});

describe("the billing window", () => {
  it("covers exactly one month for a monthly plan", () => {
    const window = cycleWindow(START, "monthly");
    assert.equal(window.start, START);
    assert.equal(window.end, addMonths(START, 1));
    assert.equal(window.end, "2026-04-01T12:00:00.000Z");
  });

  it("covers exactly three months for a quarterly plan", () => {
    const window = cycleWindow(START, "quarterly");
    assert.equal(window.start, START);
    assert.equal(window.end, addMonths(START, 3));
    assert.equal(window.end, "2026-06-01T12:00:00.000Z");
  });

  it("does not stretch a one-off", () => {
    const window = cycleWindow(START, "once");
    assert.equal(window.start, START);
    assert.equal(window.end, START);
  });
});

describe("cycle labels", () => {
  it("names both ends of the period", () => {
    const label = cycleLabel(START, END);
    assert.equal(label.includes("March 2026"), true);
    assert.equal(label.includes("1 March 2026"), true);
    assert.equal(label.includes("31 March 2026"), true);
  });

  it("shortens a period inside one month to a range", () => {
    const short = cycleShortLabel(START, END);
    assert.equal(short.length > 0, true);
    assert.equal(short.includes("March 2026"), true);
    assert.equal(short.includes("1"), true);
    assert.equal(short.includes("31"), true);
    assert.equal(short.includes(" to "), false);
  });

  it("gives a readable label for every kind of period", () => {
    const labels = [
      cycleShortLabel(START, END),
      cycleShortLabel(START, addMonths(START, 3)),
      cycleShortLabel(START, addMonths(START, 1)),
    ];
    for (const label of labels) {
      assert.equal(label.trim().length > 0, true);
      assert.equal(label.includes("undefined"), false);
      assert.equal(label.includes("Invalid"), false);
    }
  });

  it("says so plainly when a date cannot be read", () => {
    assert.equal(cycleShortLabel("not-a-date", END), "this period");
  });
});

describe("the money a cycle is worth", () => {
  it("spreads a quarterly price over its three months", () => {
    assert.equal(monthlyEquivalentCents(90000, "quarterly"), 30000);
  });

  it("keeps a monthly price as the monthly price", () => {
    assert.equal(monthlyEquivalentCents(99000, "monthly"), 99000);
  });

  it("gives a one-off no monthly value at all", () => {
    assert.equal(monthlyEquivalentCents(69000, "once"), 0);
  });

  it("gives a one-off no annual value at all", () => {
    assert.equal(annualEquivalentCents(69000, "once"), 0);
  });

  it("values a year of a monthly plan at twelve months of it", () => {
    assert.equal(annualEquivalentCents(99000, "monthly"), 1188000);
  });

  it("values a year of a quarterly plan as four of its quarters", () => {
    assert.equal(annualEquivalentCents(90000, "quarterly"), 360000);
    assert.equal(annualEquivalentCents(90000, "quarterly"), 4 * 90000);
  });

  it("keeps the annual figure and the monthly figure in step", () => {
    const monthly = monthlyEquivalentCents(90000, "quarterly");
    const annual = annualEquivalentCents(90000, "quarterly");
    assert.equal(annual, 12 * monthly);
    assert.equal(
      annualEquivalentCents(99000, "monthly"),
      12 * monthlyEquivalentCents(99000, "monthly"),
    );
  });
});
