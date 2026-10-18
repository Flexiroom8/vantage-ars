import { sha256Hex, stableStringify } from "./hash.ts";

/**
 * Office backup envelope. Tables are plain row arrays; a SHA-256 over the stable
 * JSON of the tables lets a restore tool (or you) detect a damaged or edited file.
 * Auth tables (user, session, account, verification) are deliberately never exported.
 *
 * `quote_links` is included: without it a restore silently kills every customer
 * quote link that is still open, and those customers can never answer.
 * `rate_hits` is excluded — it is transient throttling state with no business value.
 */
export const BACKUP_TABLES = [
  "company_state",
  "constitution_provisions",
  "agents",
  "inbound_items",
  "leads",
  "opportunities",
  "campaigns",
  "ledger_entries",
  "tickets",
  "documents",
  "approvals",
  "decisions",
  "audit_events",
  "founder_notices",
  "chat_threads",
  "chat_messages",
  "quote_links",
  "work_items",
  "agent_runs",
  "office_state",
] as const;

/** Order matters on restore: parents before children. */
export const BACKUP_RESTORE_ORDER: readonly string[] = [
  "company_state",
  "constitution_provisions",
  "agents",
  "inbound_items",
  "leads",
  "opportunities",
  "campaigns",
  "ledger_entries",
  "tickets",
  "documents",
  "approvals",
  "decisions",
  "audit_events",
  "founder_notices",
  "chat_threads",
  "chat_messages",
  "quote_links",
  "office_state",
  "work_items",
  "agent_runs",
];

export type BackupTables = Record<string, Record<string, unknown>[]>;

export type BackupFile = {
  format: "vantage-ars-backup";
  version: 1;
  exportedAt: string;
  rowCounts: Record<string, number>;
  checksum: string;
  tables: BackupTables;
};

export function buildBackup(tables: BackupTables, exportedAt: string = new Date().toISOString()): BackupFile {
  const rowCounts: Record<string, number> = {};
  for (const [name, rows] of Object.entries(tables)) rowCounts[name] = rows.length;
  return {
    format: "vantage-ars-backup",
    version: 1,
    exportedAt,
    rowCounts,
    checksum: sha256Hex(stableStringify(tables)),
    tables,
  };
}

export function verifyBackup(value: unknown): { ok: true } | { ok: false; error: string } {
  if (!value || typeof value !== "object") return { ok: false, error: "Not a backup file." };
  const file = value as Partial<BackupFile>;
  if (file.format !== "vantage-ars-backup" || file.version !== 1) return { ok: false, error: "Unknown backup format." };
  if (!file.tables || typeof file.tables !== "object" || Array.isArray(file.tables)) {
    return { ok: false, error: "Backup has no tables." };
  }
  for (const [name, rows] of Object.entries(file.tables)) {
    if (!Array.isArray(rows)) return { ok: false, error: `Table ${name} is not a list of rows.` };
    if (file.rowCounts && file.rowCounts[name] !== rows.length) {
      return { ok: false, error: `Row count for ${name} does not match.` };
    }
  }
  if (file.checksum !== sha256Hex(stableStringify(file.tables))) {
    return { ok: false, error: "Checksum mismatch: the backup was changed or damaged." };
  }
  return { ok: true };
}

export const MAX_RESTORE_BYTES = 4_000_000;

export type RestorePlan =
  | { ok: true; tables: { name: string; rows: Record<string, unknown>[] }[] }
  | { ok: false; error: string };

/**
 * Restore only ADDS missing rows. It never deletes or overwrites, so a mistaken or repeated
 * restore cannot destroy current records. Every table must be one we export, and every row
 * key must be a real column of that table, otherwise the whole file is refused before any write.
 */
export function planRestore(value: unknown, columnsByTable: Record<string, string[]>): RestorePlan {
  const verdict = verifyBackup(value);
  if (!verdict.ok) return verdict;
  const file = value as BackupFile;
  const allowed = new Set<string>(BACKUP_TABLES);
  const tables: { name: string; rows: Record<string, unknown>[] }[] = [];
  for (const [name, rows] of Object.entries(file.tables)) {
    if (!allowed.has(name)) return { ok: false, error: `Table ${name} is not part of the office backup.` };
    if (rows.length === 0) continue;
    const columns = new Set(columnsByTable[name] ?? []);
    if (columns.size === 0) return { ok: false, error: `Table ${name} does not exist in this office.` };
    for (const row of rows) {
      if (!row || typeof row !== "object" || Array.isArray(row)) return { ok: false, error: `Table ${name} has a bad row.` };
      for (const key of Object.keys(row)) {
        if (!columns.has(key)) return { ok: false, error: `Table ${name} has an unknown column ${key}.` };
      }
    }
    tables.push({ name, rows });
  }
  return { ok: true, tables };
}
