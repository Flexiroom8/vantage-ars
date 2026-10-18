import { createHash } from "node:crypto";

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
}

export function chainHash(previousHash: string, payload: unknown): string {
  return sha256Hex(`${previousHash}:${stableStringify(payload)}`);
}

/** The chain's first parent: 64 zeros. Mirrors `GENESIS_HASH` in company.ts. */
export const GENESIS_HASH_PLACEHOLDER = "0".repeat(64);
