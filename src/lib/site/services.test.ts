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

  it("keeps customer-facing service prices tied to their published rate lines", () => {
    const prices = [
      ["VoIP & telecoms", "voip-diagnosis", "From R690 / hour"],
      ["Networking", "network-setup", "R1,380–R3,450"],
      ["IT infrastructure", "infra-assessment", "From R690 / hour"],
      ["Managed services", "managed-support", "R2,750 / month"],
      ["Cloud & email", "cloud-admin", "From R690 / hour"],
      ["Security & continuity", "security-baseline", "From R1,725"],
      ["Backup & recovery", "backup-review", "From R1,380"],
    ] as const;

    for (const [title, rateId, displayPrice] of prices) {
      const line = SERVICE_LINES.find((item) => item.title === title);
      const rate = PUBLISHED_RATES.find((item) => item.id === rateId);
      assert.ok(line, `missing service line: ${title}`);
      assert.ok(rate, `missing published rate: ${rateId}`);
      assert.equal(line.price, displayPrice, title);
      assert.ok(line.price.includes(rate.price.replace(/ remote$/, "")), title);
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
