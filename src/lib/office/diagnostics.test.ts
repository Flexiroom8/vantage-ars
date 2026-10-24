import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { diagnosticChecklistForQuote } from "./diagnostics.ts";

describe("customer-led diagnostic checklists", () => {
  it("selects phone checks from the accepted quote rate", () => {
    const result = diagnosticChecklistForQuote({
      rateId: "voip-diagnosis",
      title: "Accepted quote",
    });
    assert.equal(result?.label, "Phone and call checks");
    assert.match(result?.checks.join(" ") ?? "", /handset or extension/);
  });

  it("selects network checks from the issue scope", () => {
    const result = diagnosticChecklistForQuote({
      rateId: "onsite-support",
      title: "Wi-Fi drops in the rear office",
    });
    assert.equal(result?.label, "Network and Wi-Fi checks");
    assert.match(result?.checks.join(" ") ?? "", /Do not unplug equipment/);
  });

  it("does not generate a checklist for unrelated quote scopes", () => {
    assert.equal(
      diagnosticChecklistForQuote({
        rateId: "managed-support",
        title: "Monthly service plan",
        scope: "Quarterly infrastructure review and remote support.",
      }),
      null,
    );
  });
});
