import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatServiceIntake } from "./service-intake.ts";

describe("service-specific enquiry details", () => {
  it("formats selected service and relevant diagnostics as plain text", () => {
    const result = formatServiceIntake({
      serviceLine: "voip",
      pbxModel: "FreePBX 17",
      sipProvider: "Example Telco",
      startedAt: "Today at 09:30",
    });

    assert.deepEqual(result, {
      ok: true,
      summary:
        "Service line: VoIP & telecoms\nPBX model: FreePBX 17\nSIP provider: Example Telco\nWhen it started: Today at 09:30",
    });
  });

  it("normalizes newlines and rejects unknown service lines or oversized fields", () => {
    assert.deepEqual(formatServiceIntake({ serviceLine: "not-a-service" }), {
      ok: false,
      error: "Choose a service line from the list.",
    });
    assert.deepEqual(
      formatServiceIntake({ serviceLine: "networking", routerModel: "x".repeat(161) }),
      {
        ok: false,
        error: "Router model must be 160 characters or fewer.",
      },
    );
    assert.deepEqual(formatServiceIntake({ serviceLine: "voip", sipProvider: "Example\nTelco" }), {
      ok: true,
      summary: "Service line: VoIP & telecoms\nSIP provider: Example Telco",
    });
  });

  it("does not attach stale equipment fields to another service line", () => {
    assert.deepEqual(
      formatServiceIntake({
        serviceLine: "networking",
        pbxModel: "Old PBX",
        routerModel: "EdgeRouter",
      }),
      { ok: true, summary: "Service line: Networking\nRouter model: EdgeRouter" },
    );
  });
});
