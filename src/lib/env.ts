/**
 * Environment helpers (renamed from `env.server.ts` so the TanStack auth API
 * route can reach the auth server without tripping the client-bundle import
 * protection; content is unchanged). `env()` reads `process.env` and is only
 * ever CALLED in server contexts.
 */
export function env(key: string): string | undefined {
  const v = process.env[key]?.trim();
  return v || undefined;
}

/**
 * Workspace preview vs deployed app. The deployer writes GROK_PROJECT_ID on
 * every publish; the sandbox preview never has it. Single source of truth for
 * the split — gate audience, gate endpoints and connector-token semantics all
 * key off this predicate.
 */
export function isWorkspacePreview(): boolean {
  return !env("GROK_PROJECT_ID");
}
