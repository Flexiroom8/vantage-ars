/**
 * A tiny read-only view of the company row for the health endpoint.
 *
 * Deliberately separate from `store.server.ts` so `/api/health` does not pull
 * the whole office store (and its audit-chain lock) into an unauthenticated
 * code path. It reads one row and never writes.
 */
import { getSql } from "../db";
import { COMPANY } from "./company";

export type CompanyHealth = {
  tradingName: string;
  halted: boolean;
  haltReason: string | null;
  treasuryCents: number;
  receivableCents: number;
  payableCents: number;
};

export async function loadCompanyForHealth(): Promise<CompanyHealth> {
  const sql = await getSql();
  const rows = await sql<Record<string, unknown>>`
    select trading_name, halted, halt_reason, treasury_cents, receivable_cents, payable_cents
    from company_state where id = ${COMPANY.id} limit 1
  `;
  const row = rows[0];
  if (!row) {
    throw new Error("Office is not provisioned.");
  }
  const n = (value: unknown): number => {
    const parsed = typeof value === "number" ? value : Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  return {
    tradingName: String(row.trading_name),
    halted: row.halted === true,
    haltReason: row.halt_reason ? String(row.halt_reason) : null,
    treasuryCents: n(row.treasury_cents),
    receivableCents: n(row.receivable_cents),
    payableCents: n(row.payable_cents),
  };
}
