import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/** Every file-based route must declare the path matching its filename. */
const EXPECTED: Record<string, string> = {
  "index.tsx": '"/"',
  "login.tsx": '"/login"',
  "office.tsx": '"/office"',
  "privacy.tsx": '"/privacy"',
  "q.$token.tsx": '"/q/$token"',
  "rates.tsx": '"/rates"',
  "services.$slug.tsx": '"/services/$slug"',
  "support.tsx": '"/support"',
  "terms.tsx": '"/terms"',
  "work.tsx": '"/work"',
};

describe("route files declare their own path", () => {
  for (const [file, path] of Object.entries(EXPECTED)) {
    it(`${file} declares createFileRoute(${path})`, () => {
      const source = readFileSync(join(here, file), "utf8");
      assert.ok(
        source.includes(`createFileRoute(${path})`),
        `${file} should contain createFileRoute(${path})`,
      );
    });
  }

  it("site-frame exports PublicFrame and declares no route", () => {
    const source = readFileSync(
      join(here, "../components/public/site-frame.tsx"),
      "utf8",
    );
    assert.ok(source.includes("export function PublicFrame"));
    assert.ok(!source.includes("createFileRoute"));
  });

  it("ui button exports Button and contains no CSS", () => {
    const source = readFileSync(join(here, "../components/ui/button.tsx"), "utf8");
    assert.ok(source.includes("export { Button"));
    assert.ok(!source.includes("@import"));
  });
});
