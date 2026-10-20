import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  SCHEDULE_FORMAT_VERSION,
  buildSchedule,
  dueAt,
  expectedFires,
  manifestHash,
  scheduleHash,
  scheduleRows,
  taskGraphHash,
  type ScheduleEntry,
} from "./schedule.ts";
import { DUTY_CADENCE_MINUTES, DUTY_OWNER, DUTY_TITLES } from "./duties.ts";

const DUTIES: Record<string, number> = { ...DUTY_CADENCE_MINUTES };
const OWNERS: Record<string, string> = { ...DUTY_OWNER };
const TITLES: Record<string, string> = { ...DUTY_TITLES };

const SMALL_DUTIES: Record<string, number> = {
  desk_chat_reply: 10,
  close_discovery: 240,
  signal_draft_campaign: 10080,
};
const SMALL_OWNERS: Record<string, string> = {
  desk_chat_reply: "desk",
  close_discovery: "close",
  signal_draft_campaign: "signal",
};
const SMALL_TITLES: Record<string, string> = {
  desk_chat_reply: "Draft replies to waiting chats",
  close_discovery: "Advance discovery",
  signal_draft_campaign: "Draft this week's campaign",
};

function entry(overrides: Partial<ScheduleEntry> = {}): ScheduleEntry {
  return {
    duty: "desk_chat_reply",
    owner: "desk",
    title: "Draft replies to waiting chats",
    everyMinutes: 10,
    priority: 0,
    ...overrides,
  };
}

describe("the schedule file", () => {
  it("sorts its entries by duty id", () => {
    const file = buildSchedule(SMALL_DUTIES, SMALL_OWNERS, SMALL_TITLES);
    assert.deepEqual(
      file.entries.map((item) => item.duty),
      ["close_discovery", "desk_chat_reply", "signal_draft_campaign"],
    );
  });

  it("carries the owner and the title of every duty", () => {
    const file = buildSchedule(SMALL_DUTIES, SMALL_OWNERS, SMALL_TITLES);
    for (const item of file.entries) {
      assert.equal(item.owner, SMALL_OWNERS[item.duty]);
      assert.equal(item.title, SMALL_TITLES[item.duty]);
      assert.equal(item.everyMinutes, SMALL_DUTIES[item.duty]);
    }
  });

  it("leaves a duty without an owner or a title blank rather than inventing one", () => {
    const file = buildSchedule({ lonely_duty: 60 }, {}, {});
    assert.deepEqual(file.entries, [
      { duty: "lonely_duty", owner: "", title: "", everyMinutes: 60, priority: 0 },
    ]);
  });

  it("ranks urgency from the cadence, tightest interval first", () => {
    const file = buildSchedule(
      { weekly: 10080, daily: 1440, hourly: 60, chatty: 10, chatty_again: 10 },
      {},
      {},
    );
    const priority = new Map(file.entries.map((item) => [item.duty, item.priority]));
    assert.equal(priority.get("chatty"), 0);
    assert.equal(priority.get("chatty_again"), 0, "the same interval shares a priority");
    assert.equal(priority.get("hourly"), 1);
    assert.equal(priority.get("daily"), 2);
    assert.equal(priority.get("weekly"), 3);
  });

  it("gives the same schedule the same version every time", () => {
    const first = buildSchedule(SMALL_DUTIES, SMALL_OWNERS, SMALL_TITLES);
    const second = buildSchedule(SMALL_DUTIES, SMALL_OWNERS, SMALL_TITLES);
    assert.equal(first.version, second.version);
    assert.equal(first.version.startsWith(`${SCHEDULE_FORMAT_VERSION}.`), true);
  });

  it("changes the version when the schedule changes", () => {
    const before = buildSchedule(SMALL_DUTIES, SMALL_OWNERS, SMALL_TITLES);
    const slower = buildSchedule(
      { ...SMALL_DUTIES, desk_chat_reply: 20 },
      SMALL_OWNERS,
      SMALL_TITLES,
    );
    const renamed = buildSchedule(SMALL_DUTIES, SMALL_OWNERS, {
      ...SMALL_TITLES,
      desk_chat_reply: "Answer the waiting chats",
    });
    const rehomed = buildSchedule(
      SMALL_DUTIES,
      { ...SMALL_OWNERS, desk_chat_reply: "foyer" },
      SMALL_TITLES,
    );
    assert.notEqual(before.version, slower.version);
    assert.notEqual(before.version, renamed.version);
    assert.notEqual(before.version, rehomed.version);
  });

  it("changes the schedule hash when an entry changes", () => {
    const before = buildSchedule(SMALL_DUTIES, SMALL_OWNERS, SMALL_TITLES);
    const after = buildSchedule(SMALL_DUTIES, SMALL_OWNERS, {
      ...SMALL_TITLES,
      close_discovery: "Advance the discovery",
    });
    assert.notEqual(scheduleHash(before), scheduleHash(after));
    assert.equal(scheduleHash(before), scheduleHash(before));
  });

  it("builds a schedule for the office's own duty registry", () => {
    const file = buildSchedule(DUTIES, OWNERS, TITLES);
    assert.equal(file.entries.length, Object.keys(DUTIES).length);
    assert.deepEqual(
      file.entries.map((item) => item.duty),
      [...Object.keys(DUTIES)].sort(),
    );
    for (const item of file.entries) {
      assert.ok(item.everyMinutes > 0, `${item.duty} has no cadence`);
      assert.ok(item.owner.length > 0, `${item.duty} has no owner`);
      assert.ok(item.title.length > 0, `${item.duty} has no title`);
    }
  });
});

describe("the schedule as a table", () => {
  it("renders the interval in words", () => {
    const file = buildSchedule(
      {
        every_ten_minutes: 10,
        every_four_hours: 240,
        every_seven_days: 10080,
        every_day: 1440,
        every_ninety_minutes: 90,
      },
      {},
      {},
    );
    const rendered = new Map(scheduleRows(file).map((row) => [row.duty, row.everyMinutes]));
    assert.equal(rendered.get("every_ten_minutes"), "every 10 minutes");
    assert.equal(rendered.get("every_four_hours"), "every 4 hours");
    assert.equal(rendered.get("every_seven_days"), "every 7 days");
    assert.equal(rendered.get("every_day"), "every 1 day");
    assert.equal(rendered.get("every_ninety_minutes"), "every 90 minutes");
  });

  it("renders how often the duty fires in a day, to two decimals", () => {
    const file = buildSchedule(
      { every_ten_minutes: 10, every_four_hours: 240, every_seven_days: 10080 },
      {},
      {},
    );
    const rendered = new Map(scheduleRows(file).map((row) => [row.duty, row.firesPerDay]));
    assert.equal(rendered.get("every_ten_minutes"), "144.00");
    assert.equal(rendered.get("every_four_hours"), "6.00");
    assert.equal(rendered.get("every_seven_days"), "0.14");
  });

  it("carries the duty, the owner and the title into the row", () => {
    const file = buildSchedule(SMALL_DUTIES, SMALL_OWNERS, SMALL_TITLES);
    const row = scheduleRows(file).find((item) => item.duty === "desk_chat_reply");
    assert.ok(row);
    assert.equal(row.owner, "desk");
    assert.equal(row.title, "Draft replies to waiting chats");
  });

  it("does not print a nonsense rate for a duty with no cadence", () => {
    const file = buildSchedule({ broken: 0 }, {}, {});
    const row = scheduleRows(file)[0];
    assert.equal(row.everyMinutes, "never");
    assert.equal(row.firesPerDay, "0.00");
  });
});

describe("when a duty next fires", () => {
  it("returns the next fire strictly after the given instant", () => {
    const chatty = entry({ everyMinutes: 10 });
    const onTheGrid = dueAt(chatty, "2026-03-14T09:00:00.000Z");
    assert.equal(onTheGrid, "2026-03-14T09:10:00.000Z");
    assert.ok(Date.parse(onTheGrid) > Date.parse("2026-03-14T09:00:00.000Z"));
  });

  it("does not fire again at the instant it already fired", () => {
    const chatty = entry({ everyMinutes: 10 });
    assert.equal(dueAt(chatty, "2026-03-14T09:10:00.000Z"), "2026-03-14T09:20:00.000Z");
  });

  it("rounds a part-finished interval up to the next fire", () => {
    const chatty = entry({ everyMinutes: 10 });
    assert.equal(dueAt(chatty, "2026-03-14T09:00:30.000Z"), "2026-03-14T09:10:00.000Z");
  });

  it("fires a daily duty on the day boundary", () => {
    const daily = entry({ everyMinutes: 1440 });
    assert.equal(dueAt(daily, "2026-03-14T09:00:00.000Z"), "2026-03-15T00:00:00.000Z");
  });

  it("refuses to schedule a duty with no cadence", () => {
    assert.throws(() => dueAt(entry({ everyMinutes: 0 }), "2026-03-14T09:00:00.000Z"));
  });
});

describe("the fires a duty owes", () => {
  it("counts six fires for a ten-minute duty over an hour", () => {
    const fires = expectedFires(
      entry({ everyMinutes: 10 }),
      "2026-03-14T09:00:00.000Z",
      "2026-03-14T10:00:00.000Z",
    );
    assert.equal(fires.length, 6);
    assert.equal(fires[0], "2026-03-14T09:00:00.000Z");
    assert.equal(fires[5], "2026-03-14T09:50:00.000Z");
  });

  it("counts seven fires for a daily duty over a week", () => {
    const fires = expectedFires(
      entry({ everyMinutes: 1440 }),
      "2026-03-14T09:00:00.000Z",
      "2026-03-21T09:00:00.000Z",
    );
    assert.equal(fires.length, 7);
    assert.equal(fires[0], "2026-03-15T00:00:00.000Z");
    assert.equal(fires[6], "2026-03-21T00:00:00.000Z");
  });

  it("counts the start and does not count the end", () => {
    const fires = expectedFires(
      entry({ everyMinutes: 10 }),
      "2026-03-14T09:00:00.000Z",
      "2026-03-14T10:00:00.000Z",
    );
    assert.equal(fires.includes("2026-03-14T09:00:00.000Z"), true, "the start is a fire");
    assert.equal(fires.includes("2026-03-14T10:00:00.000Z"), false, "the end is not a fire");
  });

  it("owes nothing when the window is empty or backwards", () => {
    const chatty = entry({ everyMinutes: 10 });
    assert.deepEqual(
      expectedFires(chatty, "2026-03-14T09:00:00.000Z", "2026-03-14T09:00:00.000Z"),
      [],
    );
    assert.deepEqual(
      expectedFires(chatty, "2026-03-14T10:00:00.000Z", "2026-03-14T09:00:00.000Z"),
      [],
    );
  });

  it("hands back the fires in order", () => {
    const fires = expectedFires(
      entry({ everyMinutes: 10 }),
      "2026-03-14T09:00:00.000Z",
      "2026-03-14T10:00:00.000Z",
    );
    const stamps = fires.map((iso) => Date.parse(iso));
    for (let index = 1; index < stamps.length; index += 1) {
      assert.ok(stamps[index] > stamps[index - 1], "fires are not in order");
    }
  });
});

describe("content hashes", () => {
  const manifest = [
    { duty: "desk_chat_reply", scheduledAt: "2026-03-14T09:00:00.000Z" },
    { duty: "close_discovery", scheduledAt: "2026-03-14T09:10:00.000Z" },
  ];

  it("gives a manifest the same hash every time", () => {
    assert.equal(manifestHash(manifest), manifestHash([...manifest]));
  });

  it("treats a manifest as a sequence, so order matters", () => {
    const reversed = [...manifest].reverse();
    assert.notEqual(manifestHash(manifest), manifestHash(reversed));
  });

  it("changes the manifest hash when a fire changes", () => {
    const moved = [{ ...manifest[0], scheduledAt: "2026-03-14T09:05:00.000Z" }, manifest[1]];
    assert.notEqual(manifestHash(manifest), manifestHash(moved));
  });

  const graph = [
    { duty: "desk_chat_reply", agentId: "desk", kind: "draft_chat_reply", priority: 24 },
    { duty: "close_discovery", agentId: "close", kind: "advance_discovery", priority: 20 },
  ];

  it("gives the task graph the same hash every time", () => {
    assert.equal(taskGraphHash(graph), taskGraphHash([...graph]));
  });

  it("treats the task graph as a set, so order does not matter", () => {
    const shuffled = [graph[1], graph[0]];
    assert.equal(taskGraphHash(graph), taskGraphHash(shuffled));
  });

  it("changes the task graph hash when the work changes", () => {
    const reprioritised = [{ ...graph[0], priority: 25 }, graph[1]];
    const reassigned = [{ ...graph[0], agentId: "foyer" }, graph[1]];
    const rekinded = [{ ...graph[0], kind: "draft_reply" }, graph[1]];
    assert.notEqual(taskGraphHash(graph), taskGraphHash(reprioritised));
    assert.notEqual(taskGraphHash(graph), taskGraphHash(reassigned));
    assert.notEqual(taskGraphHash(graph), taskGraphHash(rekinded));
  });

  it("keeps the two hashes apart: a manifest is ordered, a graph is not", () => {
    assert.notEqual(manifestHash(manifest), taskGraphHash(graph));
  });
});
