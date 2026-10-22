import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { GUIDES, guideBySlug } from "./guides.ts";
import { servicePage } from "./services.ts";

describe("the public guides", () => {
  it("has a unique, readable record for every guide", () => {
    const slugs = GUIDES.map((guide) => guide.slug);
    assert.equal(new Set(slugs).size, slugs.length, "two guides share a slug");
    assert.equal(GUIDES.length >= 4, true);
    for (const guide of GUIDES) {
      assert.match(guide.slug, /^[a-z0-9-]+$/);
      assert.equal(guide.title.length > 10, true, `${guide.slug} has no real title`);
      assert.equal(guide.sections.length >= 3, true, `${guide.slug} has too few sections`);
      assert.equal(guide.readingMinutes > 0, true, `${guide.slug} has no reading time`);
      assert.match(guide.updated, /^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("links only to published service pages", () => {
    for (const guide of GUIDES) {
      for (const slug of guide.relatedServices) {
        assert.equal(servicePage(slug) !== undefined, true, `${guide.slug} links to ${slug}`);
      }
    }
  });

  it("finds a guide by slug and misses cleanly", () => {
    assert.equal(guideBySlug("wifi-drops")?.slug, "wifi-drops");
    assert.equal(guideBySlug("no-such-guide"), undefined);
    assert.equal(guideBySlug(""), undefined);
  });
});
