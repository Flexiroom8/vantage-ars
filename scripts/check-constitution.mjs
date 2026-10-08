#!/usr/bin/env node
/**
 * Constitutional invariant checker.
 *
 * Verifies the runtime constitution (constitution.json) against
 * the rules the decision engine (src/engine.js) enforces, so a
 * provision edit can never silently drift out of the engine's
 * knowledge:
 *
 *   1. The document is well-formed and versioned.
 *   2. Provision ids are unique and sorted (ART-1 … ART-N).
 *   3. Every provision carries title, text, priority, enforcement.
 *   4. ART-2 exposure parameters exist and are non-negative
 *      integers (the engine compares amounts against them).
 *   5. Every provision the engine treats as a HARD BLOCK exists
 *      in the document, and vice versa: the engine's hard-block
 *      set matches the provisions marked `hard_block`.
 *   6. Protected-characteristic fields used by the engine
 *      (src/engine.js) all appear in ART-3's text, so the
 *      published rule and the enforced rule cannot diverge.
 *
 * Exit code 0 = all invariants hold; 1 = violation found.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const failures = [];
const checks = [];

function check(label, ok, detail = "") {
  checks.push({ label, ok });
  if (!ok) failures.push(detail || label);
}

const constitution = JSON.parse(await readFile(path.join(root, "constitution.json"), "utf8"));

// 1. Well-formed and versioned.
check(
  "document is versioned",
  typeof constitution.version === "string" && /^\d+\.\d+\.\d+$/.test(constitution.version),
  `unexpected version: ${constitution.version}`,
);
check(
  "document has provisions",
  Array.isArray(constitution.provisions) && constitution.provisions.length > 0,
  "provisions array is missing or empty",
);

const provisions = constitution.provisions ?? [];
const ids = provisions.map((p) => p.id);

// 2. Unique, sorted ids.
check(
  "provision ids are unique",
  new Set(ids).size === ids.length,
  `duplicate provision ids: ${ids.filter((id, i) => ids.indexOf(id) !== i).join(", ")}`,
);
check(
  "provision ids are sorted",
  ids.every((id, i) => {
    if (i === 0) return true;
    const previous = ids[i - 1];
    // Compare numerically when ids share a common prefix (ART-2 < ART-10).
    const previousNumber = Number(previous.split("-").pop());
    const currentNumber = Number(id.split("-").pop());
    if (Number.isInteger(previousNumber) && Number.isInteger(currentNumber)) {
      return previousNumber <= currentNumber;
    }
    return previous <= id;
  }),
  "provision ids are not in ascending order",
);

// 3. Required fields.
for (const provision of provisions) {
  check(
    `${provision.id} has required fields`,
    typeof provision.title === "string" && provision.title.length > 0 &&
      typeof provision.text === "string" && provision.text.length > 0 &&
      Number.isInteger(provision.priority) &&
      ["hard_block", "post_action", "advisory"].includes(provision.enforcement),
    `${provision.id} is missing title/text/priority or has an unknown enforcement`,
  );
}

// 4. ART-2 parameters.
const art2 = provisions.find((p) => p.id === "ART-2");
const params = art2?.parameters ?? {};
for (const key of ["max_single_transaction", "max_daily_exposure", "max_counterparty_exposure"]) {
  check(
    `ART-2 parameter ${key}`,
    Number.isInteger(params[key]) && params[key] >= 0,
    `ART-2 parameter ${key} must be a non-negative integer (found ${params[key]})`,
  );
}
check(
  "ART-2 currency is set",
  typeof params.currency === "string" && params.currency.length === 3,
  "ART-2 parameter currency must be a 3-letter code",
);

// 5. Engine hard blocks match `hard_block` provisions.
const engineSource = await readFile(path.join(root, "src", "engine.js"), "utf8");
const hardBlockMatch = engineSource.match(/hardBlocks\s*=\s*new Set\(\[([^\]]*)\]\)/);
const engineHardBlocks = hardBlockMatch
  ? hardBlockMatch[1].split(",").map((token) => token.trim().replaceAll("'", ""))
  : [];
const declaredHardBlocks = provisions
  .filter((p) => p.enforcement === "hard_block")
  .map((p) => p.id);
check(
  "engine hard-block set matches the constitution",
  engineHardBlocks.length > 0 &&
    engineHardBlocks.every((id) => declaredHardBlocks.includes(id)) &&
    declaredHardBlocks.every((id) => engineHardBlocks.includes(id)),
  `engine hard blocks [${engineHardBlocks.join(", ")}] != declared [${declaredHardBlocks.join(", ")}]`,
);

// 6. Protected fields enforced by the engine are named in ART-3.
const art3 = provisions.find((p) => p.id === "ART-3");
const engineProtectedMatch = engineSource.match(/protectedFields\s*=\s*new Set\(\[([^\]]*)\]\)/);
const engineProtected = engineProtectedMatch
  ? engineProtectedMatch[1].split(",").map((token) => token.trim().replaceAll("'", "").replaceAll('"', ""))
  : [];
const art3Body = (art3?.text ?? "").toLowerCase();
for (const field of engineProtected) {
  check(
    `ART-3 covers ${field}`,
    art3Body.includes(field.toLowerCase().replaceAll("_", " ")) ||
      art3Body.includes(field.toLowerCase()),
    `the engine blocks "${field}" but ART-3's text does not name it`,
  );
}

// Report.
for (const { label, ok } of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
}
console.log(`\n${checks.length - failures.length}/${checks.length} checks passed`);
if (failures.length) {
  console.error("\nConstitutional invariant violations:");
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
