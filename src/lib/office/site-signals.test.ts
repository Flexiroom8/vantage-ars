import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { referrerSource, summarizeSiteSignals, type SiteSignalEvent } from "./site-signals.ts";

const NOW = "2026-03-31T12:00:00.000Z";

function event(overrides: Partial<SiteSignalEvent> = {}): SiteSignalEvent {
  return {
    kind: "page_view",
    path: "/",
    referrer: null,
    country: "ZA",
    occurredAt: "2026-03-31T10:00:00.000Z",
    ...overrides,
  };
}

describe("site signals", () => {
  it("names direct, a real host, and a bad referrer honestly", () => {
    assert.equal(referrerSource(null), "Direct");
    assert.equal(referrerSource(""), "Direct");
    assert.equal(referrerSource("https://www.google.com/search?q=voip"), "google.com");
    assert.equal(referrerSource("not a url"), "Other");
  });

  it("counts page views by path, source and country", () => {
    const summary = summarizeSiteSignals(
      [
        event({ path: "/rates" }),
        event({ path: "/rates", referrer: "https://www.google.com/" }),
        event({ path: "/services/voip", country: "GB" }),
        event({ kind: "chat", path: "/support", country: "US" }),
      ],
      NOW,
      30,
    );
    assert.equal(summary.totalEvents, 4);
    assert.equal(summary.pageViews, 3);
    assert.equal(summary.countries, 2);
    assert.equal(summary.sources, 2);
    assert.deepEqual(summary.topPages[0], { label: "/rates", count: 2 });
    assert.deepEqual(summary.topSources[0], { label: "Direct", count: 2 });
    assert.deepEqual(summary.topCountries[0], { label: "ZA", count: 2 });
  });

  it("keeps fourteen zero-filled days even when nothing happened", () => {
    const summary = summarizeSiteSignals([], NOW, 30);
    assert.equal(summary.daily.length, 14);
    assert.equal(summary.daily.at(-1)?.date, "2026-03-31");
    assert.equal(
      summary.daily.every((day) => day.count === 0),
      true,
    );
    assert.equal(summary.recent.length, 0);
  });

  it("excludes events outside the window and returns the newest first", () => {
    const summary = summarizeSiteSignals(
      [
        event({ path: "/old", occurredAt: "2026-01-01T10:00:00.000Z" }),
        event({ path: "/new", occurredAt: "2026-03-31T11:00:00.000Z" }),
      ],
      NOW,
      30,
    );
    assert.equal(
      summary.topPages.some((row) => row.label === "/old"),
      false,
    );
    assert.equal(summary.recent[0]?.path, "/new");
  });

  it("caps the range and the lists", () => {
    const events = Array.from({ length: 30 }, (_, index) =>
      event({
        path: `/p${index}`,
        occurredAt: `2026-03-${String(10 + (index % 20)).padStart(2, "0")}T10:00:00.000Z`,
      }),
    );
    const summary = summarizeSiteSignals(events, NOW, 365);
    assert.equal(summary.rangeDays, 90);
    assert.equal(summary.topPages.length <= 8, true);
    assert.equal(summary.recent.length <= 10, true);
  });
});
