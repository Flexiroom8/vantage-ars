#!/usr/bin/env node
/**
 * Auth invariant checker.
 *
 * Static checks over the auth modules so a refactor cannot
 * break the deployment's safety properties:
 *
 *   1. The Better Auth server (src/lib/auth/server.ts) is never
 *      imported from client code — it pulls in `pg`, the preview
 *      secret and server-only internals.
 *   2. Session cookies use the `__Host-` prefix (the middleware
 *      sets `useSecureCookies: false` and names cookies itself).
 *   3. Local email/password sign-in is opt-in (default off), so
 *      the shipped app fails closed until a deployer enables it.
 *   4. No literal secrets in the auth sources (only env lookups
 *      and the documented preview fallbacks may appear).
 *   5. The popup completion page posts only to its own origin
 *      (client.ts waits for a same-origin message).
 *
 * Exit code 0 = all invariants hold; 1 = violation found.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const authDir = path.join(root, "src", "lib", "auth");
const failures = [];
const checks = [];

function check(label, ok, detail = "") {
  checks.push({ label, ok });
  if (!ok) failures.push(detail || label);
}

async function read(rel) {
  return readFile(path.join(root, rel), "utf8");
}

const serverSource = await read("src/lib/auth/server.ts");
const clientSource = await read("src/lib/auth/client.ts");
const popupSource = await read("src/lib/auth/popup.server.ts");
const emailPasswordSource = await read("src/lib/auth/email-password.ts");

// 1. Client code never imports the auth server module.
const clientImportsServer =
  /from\s+["']\.\.\/auth\/server["']|from\s+["']\.\/server["']|from\s+["']@\/lib\/auth\/server["']/.test(clientSource) ||
  /import\s+["']\.\.\/auth\/server["']/.test(clientSource);
check(
  "client never imports the auth server module",
  !clientImportsServer,
  "src/lib/auth/client.ts imports src/lib/auth/server.ts (server-only module)",
);

// Scan every non-server auth file for imports of the server module.
import { readdir } from "node:fs/promises";
const authFiles = await readdir(authDir);
for (const file of authFiles) {
  if (file.endsWith(".server.ts") || file === "server.ts" || !file.endsWith(".ts")) continue;
  const source = await read(path.join("src/lib/auth", file));
  const importsServer = /from\s+["']\.\/server["']/.test(source);
  check(
    `${file} does not import the auth server`,
    !importsServer,
    `src/lib/auth/${file} imports the server-only module`,
  );
}

// 2. Cookie names use the __Host- prefix.
check(
  "session cookie uses the __Host- prefix",
  /SESSION_TOKEN_COOKIE\s*=\s*["']__Host-/.test(serverSource),
  "SESSION_TOKEN_COOKIE must start with __Host-",
);
check(
  "useSecureCookies is disabled so __Host- names apply",
  /useSecureCookies:\s*false/.test(serverSource),
  "server.ts must set advanced.useSecureCookies = false when naming __Host- cookies itself",
);

// 3. Email/password is opt-in.
check(
  "email/password sign-in is opt-in (default off)",
  /default\s*(:|=)\s*false|enabled\s*=\s*false|EMAIL_AND_PASSWORD.*false/i.test(emailPasswordSource) ||
    /VITE_EMAIL_AND_PASSWORD/.test(emailPasswordSource),
  "src/lib/auth/email-password.ts must gate local sign-in behind an explicit env flag",
);

// 4. No hardcoded secrets (long base64/hex literals assigned to secret-ish names).
const secretPattern = /(?:secret|token|password|clientSecret)\s*[:=]\s*["'][A-Za-z0-9+/_=-]{24,}["']/gi;
for (const [label, source] of [
  ["server.ts", serverSource],
  ["client.ts", clientSource],
  ["popup.server.ts", popupSource],
  ["email-password.ts", emailPasswordSource],
]) {
  const hit = source.match(secretPattern);
  check(
    `${label} has no hardcoded secrets`,
    !hit,
    `src/lib/auth/${label} contains a literal secret-looking value: ${hit?.[0]?.slice(0, 60)}`,
  );
}

// 5. Popup posts the token only to its own origin.
check(
  "popup completion posts to its own origin only",
  /postMessage\([^,]+,\s*window\.location\.origin\)/.test(popupSource),
  "popup.server.ts must postMessage with window.location.origin as the targetOrigin",
);
check(
  "client only accepts popup messages from its own origin",
  /event\.origin\s*!==\s*origin/.test(clientSource),
  "client.ts must reject popup messages whose origin differs from the app origin",
);

// Report.
for (const { label, ok } of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
}
console.log(`\n${checks.length - failures.length}/${checks.length} checks passed`);
if (failures.length) {
  console.error("\nAuth invariant violations:");
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
