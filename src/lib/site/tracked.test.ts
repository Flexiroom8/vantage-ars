import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isTrackedPage, TRACKED_PATHS } from "./tracked.ts";

describe("tracked public pages", () => {
  it("tracks the managed services page", () => {
    assert.equal(isTrackedPage("/services/managed-support"), true);
  });

  it("tracks the status page", () => {
    assert.equal(isTrackedPage("/status"), true);
  });

  it("tracks the email authentication diagnostic", () => {
    assert.equal(isTrackedPage("/tools/email-auth"), true);
  });

  it("normalises a query string and a fragment", () => {
    assert.equal(isTrackedPage("/rates?from=home#managed"), true);
    assert.equal(isTrackedPage("/"), true);
  });

  it("never tracks the office, a quote link or an API route", () => {
    for (const path of ["/office", "/office/revenue", "/q/abc", "/api/health", "/login"]) {
      assert.equal(isTrackedPage(path), false, path);
    }
  });

  it("lists each path once", () => {
    assert.equal(new Set(TRACKED_PATHS).size, TRACKED_PATHS.length);
  });

  it("publishes every tracked page in the sitemap", () => {
    const sitemap = readFileSync(join(process.cwd(), "public/sitemap.xml"), "utf8");
    for (const path of TRACKED_PATHS) {
      const loc = `https://vantage-ars.co.za${path}`;
      assert.ok(sitemap.includes(`<loc>${loc}</loc>`), `${path} is tracked but not in the sitemap`);
    }
  });
});
