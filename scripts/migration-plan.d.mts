/** Type declarations for the migration planning helpers. */
export function sortMigrations(names: string[]): string[];

export function pendingMigrations(
  available: string[],
  applied: string[],
): Array<{ name: string; path: string }>;
