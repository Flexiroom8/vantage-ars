import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PUBLISHED_RATES, SERVICE_LINES } from "../office/catalogue.ts";
import { SERVICE_PAGES, servicePage } from "./services.ts";

describe("published service catalogue", () => {
  it("keeps every service line paired with one public service page", () => {
    assert.equal(SERVICE_LINES.length, SERVICE_PAGES.length);
    for (const line of SERVICE_LINES) {
      assert.ok(
        SERVICE_PAGES.some((page) => page.title === line.title),
        line.title,
      );
    }
  });

  it("publishes scoped AI automation engagements with real price references", () => {
    const page = servicePage("ai-automation");

    assert.ok(page);
    assert.equal(page.products?.length, 5);
    assert.ok(
      page.rateIds.every((id) => PUBLISHED_RATES.some((rate) => rate.id === id && rate.offered)),
    );
    assert.match(page.approach[2]?.body ?? "", /customer approval/);
    assert.ok(page.excluded.some((item) => item.includes("Third-party model")));
    assert.ok(page.excluded.some((item) => item.includes("scanning a customer system")));
    assert.ok(page.products?.some((product) => product.title === "Read-only AI diagnostics pilot"));
  });
});
