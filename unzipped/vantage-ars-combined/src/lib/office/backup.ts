import { sha256Hex, stableStringify } from "./hash.ts";

/**
 * Office backup envelope. Tables are plain row arrays; a SHA-256 over the stable
 * JSON of the tables lets a restore tool (or you) detect a damaged or edited file.
 * Auth tables (user, session, account, verification) are deliberately never exported.
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
] as const;

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
