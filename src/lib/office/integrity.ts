import type { AuditRow, DecisionRow } from "./types";

export function latestRecordHash(decisions: DecisionRow[], audit: AuditRow[]): string | null {
  const stamps = [
    ...decisions.map((d) => ({ at: d.createdAt, hash: d.recordHash })),
    ...audit.map((a) => ({ at: a.createdAt, hash: a.recordHash })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  return stamps[0]?.hash ?? null;
}

/**
 * Weak head check: does `company_state.last_audit_hash` equal the newest record
 * hash inside the window the caller loaded?
 *
 * This is necessary but NOT sufficient. It cannot see a fork (two rows both
 * claiming the same parent) and it cannot see a row outside the window. Use
 * `verifyChainLinks` for the real answer; SEAL uses that one.
 */
export function headMatches(
  lastAuditHash: string,
  decisions: DecisionRow[],
  audit: AuditRow[],
): boolean {
  const latest = latestRecordHash(decisions, audit);
  if (!latest) return lastAuditHash.length === 64;
  return latest === lastAuditHash;
}

export type ChainLink = {
  id: string;
  previousHash: string;
  recordHash: string;
  createdAt: string;
};

export type ChainVerdict = {
  ok: boolean;
  checked: number;
  /** Number of records inspected. 0 means nothing to verify yet. */
  brokenAt: string | null;
  detail: string;
};

/**
 * Walk the chain and confirm it is a single unbroken line from genesis to the
 * stored head.
 *
 * A chain row says "my parent hashed to `previous_hash`, and I hash to
 * `record_hash`". So:
 *   - the **head** is the one record nobody claims as a parent;
 *   - the **tail** is the record whose `previous_hash` is genesis and which
 *     nothing else claims as a parent — in practice the genesis row itself.
 *
 * Walking BACKWARD from the head via `record_hash -> record` is the only
 * ordering that does not depend on `created_at`, which ties at millisecond
 * resolution and cannot be trusted to break a tie between two writes in the
 * same transaction.
 *
 * Three failures are distinguished, because they mean different things:
 *   - **fork**: two records claim the same parent. Something appended outside
 *     the lock. This is the serious one.
 *   - **gap**: a record's parent hash is not any row's hash. A row is missing.
 *   - **head mismatch**: the walk reached genesis intact but the stored head is
 *     different, so the head pointer was moved by hand.
 *
 * Callers pass the FULL history, not a window: a fork can hide anywhere.
 */
export function verifyChainLinks(records: ChainLink[], headHash: string): ChainVerdict {
  if (!records.length) {
    return { ok: true, checked: 0, brokenAt: null, detail: "No chained records yet." };
  }

  // parent hash -> the records claiming it
  const claimants = new Map<string, ChainLink[]>();
  // record hash -> the record itself
  const byHash = new Map<string, ChainLink>();
  for (const record of records) {
    const siblings = claimants.get(record.previousHash) ?? [];
    siblings.push(record);
    claimants.set(record.previousHash, siblings);
    // A duplicate record_hash is itself a collision worth reporting.
    if (byHash.has(record.recordHash)) {
      return {
        ok: false,
        checked: records.length,
        brokenAt: record.createdAt,
        detail: `Two records share the hash ${record.recordHash.slice(0, 12)}.`,
      };
    }
    byHash.set(record.recordHash, record);
  }

  for (const [parent, children] of claimants) {
    if (children.length > 1) {
      return {
        ok: false,
        checked: records.length,
        brokenAt: children[1].createdAt,
        detail: `The chain forks: ${children.length} records claim ${parent.slice(0, 12)} as their parent.`,
      };
    }
  }

  const heads = records.filter((record) => !claimants.has(record.recordHash));
  if (heads.length !== 1) {
    return {
      ok: false,
      checked: records.length,
      brokenAt: heads[1]?.createdAt ?? heads[0]?.createdAt ?? null,
      detail: `Expected exactly one chain head, found ${heads.length}.`,
    };
  }

  const ordered: ChainLink[] = [];
  let cursor: ChainLink | undefined = heads[0];
  while (cursor) {
    ordered.push(cursor);
    cursor = byHash.get(cursor.previousHash);
  }
  ordered.reverse(); // oldest first

  if (ordered.length !== records.length) {
    return {
      ok: false,
      checked: ordered.length,
      brokenAt: null,
      detail: `${records.length - ordered.length} record(s) are not reachable from the head — the chain has a gap.`,
    };
  }

  if (heads[0].recordHash !== headHash) {
    return {
      ok: false,
      checked: ordered.length,
      brokenAt: heads[0].createdAt,
      detail: `The newest record hashes to ${heads[0].recordHash.slice(0, 12)} but the stored head is ${headHash.slice(0, 12)}.`,
    };
  }

  for (let i = 1; i < ordered.length; i += 1) {
    if (ordered[i].previousHash !== ordered[i - 1].recordHash) {
      return {
        ok: false,
        checked: i,
        brokenAt: ordered[i].createdAt,
        detail: `Record ${ordered[i].id} claims parent ${ordered[i].previousHash.slice(0, 12)} but the record before it hashes to ${ordered[i - 1].recordHash.slice(0, 12)}.`,
      };
    }
  }

  return {
    ok: true,
    checked: ordered.length,
    brokenAt: null,
    detail: `${ordered.length} records verified, back to genesis.`,
  };
}
