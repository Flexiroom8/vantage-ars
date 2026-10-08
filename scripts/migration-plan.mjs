/**
 * Migration planning helpers shared by the dev/preview PGLite bootstrap
 * (src/lib/db.ts) and the CLI migrator (scripts/migrate.mjs).
 *
 * Migrations are plain SQL files in `migrations/`. Their file name is the
 * identity: `<version>-<slug>.sql` (e.g. `0001-workspace.sql`). Applying
 * is idempotent per file because every applied name is recorded in the
 * `_migrations` table, and each file is applied inside a transaction.
 */

/**
 * Sort migration file names into apply order. Version prefix
 * (`0001-`) sorts lexicographically; ties fall back to the full name
 * so the order is total and stable across processes.
 */
export function sortMigrations(names) {
  return [...names].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * Which migrations still need to run.
 *
 * @param {string[]} available file names present in migrations/
 * @param {string[]} applied   names recorded in _migrations
 * @returns {Array<{name: string, path: string}>} pending migrations in order
 */
export function pendingMigrations(available, applied) {
  const done = new Set(applied);
  return sortMigrations(available)
    .filter((name) => !done.has(name))
    .map((name) => ({ name, path: `/migrations/${name}` }));
}
