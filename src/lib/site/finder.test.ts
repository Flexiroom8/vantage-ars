import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  FINDER_HORIZONS,
  FINDER_IMPACTS,
  FINDER_TOPICS,
  recommendService,
  type FinderHorizon,
  type FinderImpact,
  type FinderTopic,
} from "./finder.ts";
import { guideBySlug } from "./guides.ts";
import { servicePage } from "./services.ts";

const TOPICS = FINDER_TOPICS.map((item) => item.id);
const IMPACTS = FINDER_IMPACTS.map((item) => item.id);
const HORIZONS = FINDER_HORIZONS.map((item) => item.id);

describe("the public service finder", () => {
  it("offers every topic, impact and horizon exactly once", () => {
    assert.equal(new Set(TOPICS).size, TOPICS.length);
    assert.equal(new Set(IMPACTS).size, IMPACTS.length);
    assert.equal(new Set(HORIZONS).size, HORIZONS.length);
    assert.equal(TOPICS.includes("unsure"), true);
    assert.equal(IMPACTS.includes("down"), true);
    assert.equal(HORIZONS.includes("ongoing"), true);
  });

  it("always recommends published services and existing guides", () => {
    for (const topic of TOPICS) {
      for (const impact of IMPACTS) {
        for (const horizon of HORIZONS) {
          const result = recommendService({ topic, impact, horizon });
          assert.equal(
            servicePage(result.primarySlug) !== undefined,
            true,
            `${topic}/${impact}/${horizon} has no primary page`,
          );
          if (result.secondarySlug) {
            assert.equal(
              servicePage(result.secondarySlug) !== undefined,
              true,
              `${topic}/${impact}/${horizon} has no secondary page`,
            );
          }
          for (const slug of result.guideSlugs) {
            assert.equal(guideBySlug(slug) !== undefined, true, `${slug} is not a guide`);
          }
          assert.equal(result.checklist.length >= 4, true);
          assert.equal(result.headline.length > 10, true);
          assert.equal(result.rationale.length > 20, true);
        }
      }
    }
  });

  it("starts ongoing work on managed support and keeps the technical line", () => {
    const result = recommendService({ topic: "phones", impact: "degraded", horizon: "ongoing" });
    assert.equal(result.primarySlug, "managed-support");
    assert.equal(result.secondarySlug, "voip");
    assert.equal(result.guideSlugs.includes("one-way-audio"), true);
  });

  it("keeps the technical line first for a one-off job", () => {
    const result = recommendService({ topic: "backup", impact: "planning", horizon: "one_off" });
    assert.equal(result.primarySlug, "backup-recovery");
    assert.equal(result.guideSlugs[0], "backup-is-not-recovery");
    assert.equal(result.urgency, "planned");
  });

  it("marks an interrupted service without promising a response time", () => {
    const result = recommendService({ topic: "network", impact: "down", horizon: "one_off" });
    assert.equal(result.urgency, "now");
    assert.match(result.headline, /stopped/);
    const text = JSON.stringify(result).toLowerCase();
    for (const forbidden of ["guarantee", "uptime", "sla", "24/7", "within "]) {
      assert.equal(text.includes(forbidden), false, `finder promised ${forbidden}`);
    }
  });

  it("is typed by the exported option ids", () => {
    const topic: FinderTopic = "cloud";
    const impact: FinderImpact = "planning";
    const horizon: FinderHorizon = "unsure";
    const result = recommendService({ topic, impact, horizon });
    assert.equal(result.primarySlug, "cloud-email");
    assert.equal(result.secondarySlug, "managed-support");
  });
});
