import type { AuditRow, DecisionRow } from "./types";

export function latestRecordHash(decisions: DecisionRow[], audit: AuditRow[]): string | null {
  const stamps = [
    ...decisions.map((d) => ({ at: d.createdAt, hash: d.recordHash })),
    ...audit.map((a) => ({ at: a.createdAt, hash: a.recordHash })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  return stamps[0]?.hash ?? null;
}

export function headMatches(
  lastAuditHash: string,
  decisions: DecisionRow[],
  audit: AuditRow[],
): boolean {
  const latest = latestRecordHash(decisions, audit);
  if (!latest) return lastAuditHash.length === 64;
  return latest === lastAuditHash;
}
