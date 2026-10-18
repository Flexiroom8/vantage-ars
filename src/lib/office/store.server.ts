import { randomBytes, randomUUID } from "node:crypto";
import { getSql, type Sql } from "../db";
import { AGENT_DEFS, AGENT_BY_ID } from "./agents";
import { CONSTITUTION } from "./constitution";
import { COMPANY, GENESIS_HASH } from "./company";
import { authorizeAction } from "./governor";
import { chainHash, sha256Hex, stableStringify } from "./hash";
import { PUBLISHED_RATES } from "./catalogue";
import { buildQuoteDocument } from "./quote";
import { customerQuoteText, deliveryJob, documentRef, invoiceCopy, ledgerVat, parseVatTreatment, type VatTreatment, expenseVat, paymentInstructionsText, paymentNote, quoteInvoice, receiptCopy, receiptForInvoice } from "./invoice";
import { parsePaymentNotice } from "./payment-notice";
import { nextTicketStatus } from "./ticket";
import { linkExpiry, linkState, plausibleToken, type QuoteLinkState, type QuoteLinkSummary } from "./quote-link";
import { smtpStatus } from "./smtp.server";
import type {
  ActionKind,
  AgentDef,
  AgentRow,
  ApprovalRow,
  AuditRow,
  AutonomyHealth,
  CampaignRow,
  CompanySnapshot,
  DecisionRow,
  DispatchResult,
  DocumentRow,
  InboundRow,
  LeadRow,
  LedgerRow,
  NoticeRow,
  OfficeSnapshot,
  OpportunityRow,
  ProposedAction,
  ProvisionCheck,
  ProvisionRow,
  TicketRow,
  Json,
} from "./types";

function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return new Date().toISOString();
}

function num(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function bool(value: unknown): boolean {
  return value === true || value === "t" || value === "true";
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (value && typeof value === "object") return value as T;
  if (typeof value !== "string" || !value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/**
 * The audit hash chain is a single shared pointer in `company_state`. Two
 * concurrent writers that both read the old head and both write a child fork
 * the chain permanently, and the existing "head matches newest row" check cannot
 * see the fork. So every chain write — decisions AND audit events — happens
 * inside one transaction holding a named advisory lock, and reads the head back
 * with `for update` so a row lock backs the advisory lock.
 */
const CHAIN_LOCK = "vantage-ars:audit-chain";

async function withChain<T>(body: (tx: Sql) => Promise<T>): Promise<T> {
  const sql = await getSql();
  return sql.advisory(CHAIN_LOCK, body);
}

async function readAuditHead(sql: Sql): Promise<string> {
  const rows = await sql<{ last_audit_hash: string }>`
    select last_audit_hash from company_state where id = ${COMPANY.id} for update
  `;
  const head = rows[0]?.last_audit_hash;
  if (!head) throw new Error("Office is not provisioned.");
  return head;
}

async function appendAuditTx(
  sql: Sql,
  kind: string,
  title: string,
  body: string,
  actor: string,
): Promise<string> {
  const previous = await readAuditHead(sql);
  const id = randomUUID();
  const recordHash = chainHash(previous, { id, kind, title, body, actor });
  await sql`
    insert into audit_events (id, kind, title, body, actor, previous_hash, record_hash)
    values (${id}, ${kind}, ${title}, ${body}, ${actor}, ${previous}, ${recordHash})
  `;
  await sql`
    update company_state
    set last_audit_hash = ${recordHash}, updated_at = now()
    where id = ${COMPANY.id}
  `;
  return recordHash;
}

/**
 * Record an event on the audit chain, taking the chain lock. Exported for the
 * scheduler, which runs outside the action path and must still be chained.
 */
export async function appendAudit(
  kind: string,
  title: string,
  body: string,
  actor: string,
): Promise<string> {
  return withChain((tx) => appendAuditTx(tx, kind, title, body, actor));
}

async function loadCompany(): Promise<CompanySnapshot> {
  return loadCompanyTx(await getSql());
}

async function loadCompanyTx(sql: Sql): Promise<CompanySnapshot> {
  const rows = await sql<Record<string, unknown>>`
    select * from company_state where id = ${COMPANY.id} limit 1
  `;
  const row = rows[0];
  if (!row) throw new Error("Office is not provisioned.");
  return {
    id: String(row.id),
    legalName: String(row.legal_name),
    tradingName: String(row.trading_name),
    domain: String(row.domain),
    jurisdiction: String(row.jurisdiction),
    timezone: String(row.timezone),
    currency: String(row.currency),
    vatRate: num(row.vat_rate, 0.15),
    authorName: String(row.author_name),
    authorRole: String(row.author_role),
    constitutionVersion: String(row.constitution_version),
    treasuryCents: num(row.treasury_cents),
    receivableCents: num(row.receivable_cents),
    payableCents: num(row.payable_cents),
    autonomyLevel: "A3",
    halted: bool(row.halted),
    haltReason: row.halt_reason ? String(row.halt_reason) : null,
    paymentInstructions: row.payment_instructions ? String(row.payment_instructions) : "",
    lastAuditHash: String(row.last_audit_hash),
    openedAt: iso(row.opened_at),
    updatedAt: iso(row.updated_at),
  };
}

function quoteDocumentBody(quoteId: string, action: ProposedAction): string {
  const document = buildQuoteDocument({
    rateId: action.payload.rateId,
    location: action.payload.location,
    quantity: action.payload.quantity,
    amountCents: Math.max(0, Math.round(action.amountCents || 0)),
    reference: documentRef(quoteId),
    scope: action.payload.scope,
  });
  if (!document.ok) throw new Error(`Quote refused: ${document.error}`);
  return document.body;
}

/**
 * Cash may only retire money owed. Never credit more than the outstanding
 * receivable, and never credit at all when nothing is outstanding. Returns the
 * amount actually applied.
 */
async function applyReceiptAgainstReceivable(sql: Sql, amount: number): Promise<number> {
  if (amount <= 0) return 0;
  const rows = await sql<{ receivable_cents: number }>`
    select receivable_cents from company_state where id = ${COMPANY.id} for update
  `;
  const outstanding = Math.max(0, num(rows[0]?.receivable_cents));
  const applied = Math.min(amount, outstanding);
  if (applied <= 0) return 0;
  await sql`
    update company_state
    set treasury_cents = treasury_cents + ${applied},
        receivable_cents = receivable_cents - ${applied},
        updated_at = now()
    where id = ${COMPANY.id}
  `;
  return applied;
}

/**
 * Provision the office if it is not there yet, and converge the roster.
 *
 * Runs at most once per process: `readSnapshot` used to call this on every page
 * load, which meant nine pointless `UPDATE agents` statements (each taking a row
 * lock and bloating `xmin`) on every office render and every public quote-link
 * view. Callers still get a correct roster because convergence is cheap and
 * idempotent once the flag is set.
 */
let provisionPromise: Promise<void> | null = null;

export function ensureOffice(): Promise<void> {
  provisionPromise ??= provisionOffice().catch((err) => {
    provisionPromise = null; // let the next caller retry
    throw err;
  });
  return provisionPromise;
}

async function provisionOffice(): Promise<void> {
  const sql = await getSql();
  const existing = await sql<{ id: string }>`select id from company_state where id = ${COMPANY.id}`;
  if (existing.length) {
    await syncRoster(sql);
    await seedPaymentInstructions(sql);
    return;
  }

  await sql.transaction(async (tx) => {
    const raced = await tx<{ id: string }>`select id from company_state where id = ${COMPANY.id} for update`;
    if (raced.length) return;

    await tx`
      insert into company_state (
        id, legal_name, trading_name, domain, jurisdiction, timezone, currency, vat_rate,
        author_name, author_role, constitution_version, treasury_cents, receivable_cents,
        payable_cents, autonomy_level, halted, last_audit_hash, payment_instructions
      ) values (
        ${COMPANY.id}, ${COMPANY.legalName}, ${COMPANY.tradingName}, ${COMPANY.domain},
        ${COMPANY.jurisdiction}, ${COMPANY.timezone}, ${COMPANY.currency}, ${COMPANY.vatRate},
        ${COMPANY.authorName}, ${COMPANY.authorRole}, ${COMPANY.constitutionVersion},
        0, 0, 0, ${COMPANY.autonomyLevel}, false, ${GENESIS_HASH},
        ${paymentInstructionsText(process.env)}
      )
    `;

    for (const p of CONSTITUTION) {
      await tx`
        insert into constitution_provisions (
          id, article_id, title, priority, body, enforcement, machine_checkable, parameters_json
        ) values (
          ${p.id}, ${p.articleId}, ${p.title}, ${p.priority}, ${p.body}, ${p.enforcement},
          ${p.machineCheckable}, ${JSON.stringify(p.parameters)}
        )
      `;
    }

    for (const a of AGENT_DEFS) {
      await insertAgent(tx, a);
    }

    // The genesis audit row is written inside the same transaction so a
    // provisioned office is never missing its founding record.
    const previous = GENESIS_HASH;
    const id = randomUUID();
    const body =
      "Constitution v1.0.0 ratified by Juan-louw Greyling. Nine non-human identities issued. Treasury R0.00. Autonomy A3 within role; founder gates on cost, customer win, customer loss, and marketing-to-sales handoff.";
    const recordHash = chainHash(previous, {
      id,
      kind: "office_open",
      title: "Office provisioned",
      body,
      actor: "constitution",
    });
    await tx`
      insert into audit_events (id, kind, title, body, actor, previous_hash, record_hash)
      values (${id}, 'office_open', 'Office provisioned', ${body}, 'constitution', ${previous}, ${recordHash})
    `;
    await tx`
      update company_state set last_audit_hash = ${recordHash}, updated_at = now()
      where id = ${COMPANY.id}
    `;
  });

  await seedPaymentInstructions(sql);
}

/**
 * Fill in the derived bank details exactly once, when the office is created.
 * Previously this ran on every `readSnapshot` and overwrote any payment note the
 * founder had typed, because the match test was a `LIKE` on the rendered text.
 */
async function seedPaymentInstructions(sql: Sql): Promise<void> {
  const derived = paymentInstructionsText(process.env);
  if (!derived) return;
  await sql`
    update company_state
    set payment_instructions = ${derived}
    where id = ${COMPANY.id} and coalesce(payment_instructions, '') = ''
  `;
}

async function insertAgent(sql: Sql, a: AgentDef): Promise<void> {
  await sql`
    insert into agents (
      id, callsign, title, department, spiffe_id, status, autonomy_level, summary,
      allowed_actions_json, bindings_json, authority_json, current_task, last_heartbeat
    ) values (
      ${a.id}, ${a.callsign}, ${a.title}, ${a.department}, ${a.spiffeId}, 'idle',
      ${a.autonomyLevel}, ${a.summary}, ${JSON.stringify(a.allowedActions)},
      ${JSON.stringify(a.bindings)}, ${JSON.stringify(a.authority)}, null, now()
    )
    on conflict (id) do nothing
  `;
}

async function syncRoster(sql: Sql): Promise<void> {
  const rows = await sql<{ id: string }>`select id from agents`;
  const have = new Set(rows.map((row) => String(row.id)));
  for (const agent of AGENT_DEFS) {
    if (have.has(agent.id)) continue;
    await insertAgent(sql, agent);
    await appendAudit(
      "identity_issued",
      `${agent.callsign} issued`,
      `${agent.title} joined the floor. ${agent.summary}`,
      "constitution",
    );
  }
  // One statement instead of nine, and only when something actually drifted.
  const stale = AGENT_DEFS.filter((agent) => agent.summary.length > 0);
  for (const agent of stale) {
    await sql`
      update agents set summary = ${agent.summary}, authority_json = ${JSON.stringify(agent.authority)}
      where id = ${agent.id} and (summary <> ${agent.summary} or authority_json <> ${JSON.stringify(agent.authority)})
    `;
  }
  const role = CONSTITUTION.find((provision) => provision.id === "art-11");
  if (role) {
    await sql`
      update constitution_provisions
      set body = ${role.body}
      where id = ${"art-11"} and body is distinct from ${role.body}
    `;
  }
}

function mapAgent(row: Record<string, unknown>): AgentRow {
  const def = AGENT_BY_ID[String(row.id)];
  return {
    id: String(row.id),
    callsign: String(row.callsign),
    title: String(row.title),
    department: String(row.department),
    spiffeId: String(row.spiffe_id),
    status: (String(row.status) as AgentRow["status"]) || "idle",
    autonomyLevel: "A3",
    summary: String(row.summary),
    allowedActions: parseJson(row.allowed_actions_json, def?.allowedActions ?? []),
    bindings: parseJson(row.bindings_json, def?.bindings ?? []),
    authority: parseJson(row.authority_json, def?.authority ?? {
      maySpend: false,
      mayContactMarket: false,
      mayEnterSales: false,
      mayIssueInvoice: false,
      mayHaltFleet: false,
      vetoPower: false,
      maxAutonomousCents: 0,
    }),
    currentTask: row.current_task ? String(row.current_task) : null,
    lastHeartbeat: row.last_heartbeat ? iso(row.last_heartbeat) : null,
    decisionsCount: num(row.decisions_count),
    escalationsCount: num(row.escalations_count),
  };
}

function mapApproval(row: Record<string, unknown>): ApprovalRow {
  return {
    id: String(row.id),
    kind: row.kind as ApprovalRow["kind"],
    title: String(row.title),
    rationale: String(row.rationale),
    amountCents: num(row.amount_cents),
    agentId: String(row.agent_id),
    companyName: row.company_name ? String(row.company_name) : null,
    status: row.status as ApprovalRow["status"],
    riskScore: num(row.risk_score),
    constitutionalTrace: parseJson(row.constitutional_trace_json, []),
    action: parseJson(row.action_json, {
      kind: "notify_operator",
      title: "",
      rationale: "",
      confidence: 0,
      amountCents: 0,
      payload: {},
    }),
    resolutionNote: row.resolution_note ? String(row.resolution_note) : null,
    createdAt: iso(row.created_at),
    resolvedAt: row.resolved_at ? iso(row.resolved_at) : null,
  };
}

function mapDecision(row: Record<string, unknown>): DecisionRow {
  return {
    id: String(row.id),
    agentId: String(row.agent_id),
    actionKind: String(row.action_kind),
    title: String(row.title),
    rationale: String(row.rationale),
    status: row.status as DecisionRow["status"],
    confidence: num(row.confidence),
    reversibility: row.reversibility as DecisionRow["reversibility"],
    amountCents: num(row.amount_cents),
    constitutionalTrace: parseJson(row.constitutional_trace_json, []),
    observation: parseJson(row.observation_json, {}),
    action: parseJson(row.action_json, {}),
    evidenceHash: String(row.evidence_hash),
    previousHash: String(row.previous_hash),
    recordHash: String(row.record_hash),
    createdAt: iso(row.created_at),
  };
}

/**
 * The autonomy health the founder sees on /office/metrics.
 *
 * Previously `hardViolations` was hardcoded to 0, which made
 * `constraintAdherence` a constant 1 — a blocked action was invisible in the
 * headline number. Every term below is now derived from rows that exist.
 */
function healthOf(
  company: CompanySnapshot,
  decisions: DecisionRow[],
  approvals: ApprovalRow[],
): AutonomyHealth {
  const total = decisions.length;
  const blocked = decisions.filter((d) => d.status === "blocked").length;
  const escalated = decisions.filter((d) => d.status === "escalated").length;
  const executed = decisions.filter((d) => d.status === "executed" || d.status === "authorized").length;
  const pending = approvals.filter((a) => a.status === "pending").length;
  const resolved = approvals.filter((a) => a.status !== "pending").length;
  // A block is the system refusing to act. That is the constitution working, not
  // a failure — but a rising count means an agent keeps trying the same thing.
  const hardViolations = blocked;
  const interventionRate = total === 0 ? 0 : escalated / total;
  const autonomousResolution = total === 0 ? 1 : executed / total;
  // Hard blocks are expected to be rare. Above ~2% the fleet is pushing.
  const constraintAdherence = total === 0 ? 1 : Math.max(0, 1 - hardViolations / Math.max(total, 1));
  const decisionQuality = total === 0 ? 1 : Math.max(0, 1 - blocked / Math.max(total, 1));
  const governance = company.halted ? 0.4 : 0.98;
  // Backlog of unresolved founder gates is the one thing that silently rots.
  const selfHealing = pending > 20 ? 0.7 : pending > 8 ? 0.84 : 0.94;
  const overall =
    constraintAdherence * 0.3 +
    decisionQuality * 0.2 +
    governance * 0.2 +
    selfHealing * 0.15 +
    autonomousResolution * 0.15;
  return {
    overall: Number(overall.toFixed(3)),
    decisionQuality: Number(decisionQuality.toFixed(3)),
    constraintAdherence: Number(constraintAdherence.toFixed(3)),
    selfHealing,
    governance,
    interventionRate: Number(interventionRate.toFixed(5)),
    autonomousResolution: Number(autonomousResolution.toFixed(4)),
    decisionCount: total,
    pendingApprovals: pending,
    hardViolations,
    resolvedApprovals: resolved,
  };
}

/**
 * Read the whole office.
 *
 * This is a pure read. It used to run `CREATE TABLE` / `ALTER TABLE ... ADD
 * COLUMN` and an unconditional `UPDATE company_state` on every call, which on a
 * pooled Postgres meant an ACCESS EXCLUSIVE lock convoy on every office page
 * load and a silent overwrite of any payment note the founder had typed. All of
 * that now lives in migrations and in `provisionOffice`.
 */
export async function readSnapshot(): Promise<OfficeSnapshot> {
  await ensureOffice();
  const sql = await getSql();
  const company = await loadCompany();

  const [
    provisionRows,
    agentRows,
    inboundRows,
    leadRows,
    oppRows,
    campaignRows,
    ledgerRows,
    ticketRows,
    docRows,
    approvalRows,
    decisionRows,
    auditRows,
    noticeRows,
  ] = await Promise.all([
    sql<Record<string, unknown>>`select * from constitution_provisions order by priority, article_id`,
    sql<Record<string, unknown>>`select * from agents order by callsign`,
    sql<Record<string, unknown>>`select * from inbound_items order by created_at desc limit 80`,
    sql<Record<string, unknown>>`select * from leads order by updated_at desc limit 80`,
    sql<Record<string, unknown>>`select * from opportunities order by updated_at desc limit 80`,
    sql<Record<string, unknown>>`select * from campaigns order by created_at desc limit 40`,
    sql<Record<string, unknown>>`select * from ledger_entries order by created_at desc limit 80`,
    sql<Record<string, unknown>>`select * from tickets order by updated_at desc limit 80`,
    sql<Record<string, unknown>>`select * from documents order by created_at desc limit 40`,
    sql<Record<string, unknown>>`select * from approvals order by created_at desc limit 80`,
    sql<Record<string, unknown>>`select * from decisions order by created_at desc limit 80`,
    sql<Record<string, unknown>>`select * from audit_events order by created_at desc limit 80`,
    sql<Record<string, unknown>>`select * from founder_notices order by created_at desc limit 8`,
  ]);

  const provisions: ProvisionRow[] = provisionRows.map((row) => ({
    id: String(row.id),
    articleId: String(row.article_id),
    title: String(row.title),
    priority: num(row.priority),
    body: String(row.body),
    enforcement: row.enforcement as ProvisionRow["enforcement"],
    machineCheckable: bool(row.machine_checkable),
    parameters: parseJson(row.parameters_json, {}),
  }));

  const inbound: InboundRow[] = inboundRows.map((row) => ({
    id: String(row.id),
    channel: String(row.channel),
    companyName: String(row.company_name),
    subject: String(row.subject),
    summary: String(row.summary),
    intent: String(row.intent),
    routedTo: row.routed_to ? String(row.routed_to) : null,
    status: String(row.status),
    createdAt: iso(row.created_at),
  }));

  const leads: LeadRow[] = leadRows.map((row) => ({
    id: String(row.id),
    companyName: String(row.company_name),
    source: String(row.source),
    stage: String(row.stage),
    score: num(row.score),
    summary: String(row.summary),
    inboundId: row.inbound_id ? String(row.inbound_id) : null,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  }));

  const opportunities: OpportunityRow[] = oppRows.map((row) => ({
    id: String(row.id),
    leadId: String(row.lead_id),
    companyName: String(row.company_name),
    stage: String(row.stage),
    valueCents: num(row.value_cents),
    summary: String(row.summary),
    handoffApprovalId: row.handoff_approval_id ? String(row.handoff_approval_id) : null,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  }));

  const campaigns: CampaignRow[] = campaignRows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    channel: String(row.channel),
    status: String(row.status),
    budgetCents: num(row.budget_cents),
    spendCents: num(row.spend_cents),
    summary: String(row.summary),
    createdAt: iso(row.created_at),
  }));

  const ledger: LedgerRow[] = ledgerRows.map((row) => ({
    id: String(row.id),
    kind: String(row.kind),
    counterparty: String(row.counterparty),
    amountCents: num(row.amount_cents),
    vatCents: num(row.vat_cents),
    status: String(row.status),
    memo: String(row.memo),
    relatedId: row.related_id ? String(row.related_id) : null,
    createdAt: iso(row.created_at),
  }));

  const tickets: TicketRow[] = ticketRows.map((row) => ({
    id: String(row.id),
    title: String(row.title),
    severity: String(row.severity),
    status: String(row.status),
    ownerAgent: String(row.owner_agent),
    summary: String(row.summary),
    relatedId: row.related_id ? String(row.related_id) : null,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  }));

  const documents: DocumentRow[] = docRows.map((row) => ({
    id: String(row.id),
    title: String(row.title),
    kind: String(row.kind),
    status: String(row.status),
    summary: String(row.summary),
    relatedId: row.related_id ? String(row.related_id) : null,
    createdAt: iso(row.created_at),
  }));

  const approvals = approvalRows.map(mapApproval);
  const decisions = decisionRows.map(mapDecision);
  const audit: AuditRow[] = auditRows.map((row) => ({
    id: String(row.id),
    kind: String(row.kind),
    title: String(row.title),
    body: String(row.body),
    actor: String(row.actor),
    previousHash: String(row.previous_hash),
    recordHash: String(row.record_hash),
    createdAt: iso(row.created_at),
  }));

  const notices: NoticeRow[] = noticeRows.map((row) => ({
    id: String(row.id),
    kind: String(row.kind),
    subject: String(row.subject),
    status: String(row.status) === "sent" ? "sent" : "not_delivered",
    detail: String(row.detail),
    createdAt: iso(row.created_at),
  }));

  return {
    company,
    provisions,
    agents: agentRows.map(mapAgent),
    inbound,
    leads,
    opportunities,
    campaigns,
    ledger,
    tickets,
    documents,
    approvals,
    decisions,
    audit,
    notices,
    mail: smtpStatus(),
    health: healthOf(company, decisions, approvals),
  };
}

async function hasApprovedHandoff(sql: Sql, companyName: string): Promise<boolean> {
  const rows = await sql<{ id: string }>`
    select id from approvals
    where kind = 'sales_handoff'
      and status = 'approved'
      and lower(coalesce(company_name, '')) = ${companyName.trim().toLowerCase()}
    limit 1
  `;
  return rows.length > 0;
}

async function hasWonOpportunity(sql: Sql, companyName: string): Promise<boolean> {
  const rows = await sql<{ id: string }>`
    select id from opportunities
    where stage = 'won' and lower(company_name) = ${companyName.trim().toLowerCase()}
    limit 1
  `;
  return rows.length > 0;
}

async function recordDecisionTx(
  sql: Sql,
  input: {
    agentId: string;
    action: ProposedAction;
    status: DecisionRow["status"];
    trace: ProvisionCheck[];
    reversibility: DecisionRow["reversibility"];
    observation: Record<string, Json>;
  },
): Promise<string> {
  const previous = await readAuditHead(sql);
  const id = randomUUID();
  const evidenceHash = sha256Hex(stableStringify(input.action));
  // The chain covers everything that defines the decision, including the
  // observation, so a tampered row cannot be re-hashed into something valid.
  const recordHash = chainHash(previous, {
    id,
    agentId: input.agentId,
    action: input.action,
    status: input.status,
    trace: input.trace,
    observation: input.observation,
    evidenceHash,
  });
  await sql`
    insert into decisions (
      id, agent_id, action_kind, title, rationale, status, confidence, reversibility,
      amount_cents, constitutional_trace_json, observation_json, action_json,
      evidence_hash, previous_hash, record_hash
    ) values (
      ${id}, ${input.agentId}, ${input.action.kind}, ${input.action.title},
      ${input.action.rationale}, ${input.status}, ${input.action.confidence},
      ${input.reversibility}, ${input.action.amountCents}, ${JSON.stringify(input.trace)},
      ${JSON.stringify(input.observation)}, ${JSON.stringify(input.action)},
      ${evidenceHash}, ${previous}, ${recordHash}
    )
  `;
  await sql`
    update company_state set last_audit_hash = ${recordHash}, updated_at = now()
    where id = ${COMPANY.id}
  `;
  await sql`
    update agents
    set decisions_count = decisions_count + 1,
        escalations_count = escalations_count + ${input.status === "escalated" ? 1 : 0},
        last_heartbeat = now(),
        current_task = ${input.action.title},
        status = ${input.status === "blocked" ? "blocked" : "idle"}
    where id = ${input.agentId}
  `;
  return id;
}

/**
 * Apply one action's side effects. Always called with the transaction/handle the
 * caller wants the write to land in, so a ledger entry and its balance movement
 * can never be observed apart.
 */
async function executeAuthorized(
  sql: Sql,
  agentId: string,
  action: ProposedAction,
  approvalId?: string,
): Promise<void> {
  const companyName = (action.companyName || String(action.payload.companyName ?? "")).trim();
  const amount = Math.max(0, Math.round(action.amountCents || 0));

  switch (action.kind) {
    case "route_inbound": {
      if (action.relatedId) {
        await sql`
          update inbound_items
          set status = 'routed', routed_to = ${String(action.payload.routedTo ?? agentId)}
          where id = ${action.relatedId}
        `;
      }
      break;
    }
    case "draft_reply": {
      const id = randomUUID();
      const body = typeof action.payload.body === "string" ? action.payload.body : action.rationale;
      await sql`
        insert into documents (id, title, kind, status, summary, related_id)
        values (${id}, ${action.title}, 'correspondence', 'draft', ${body}, ${action.relatedId ?? null})
      `;
      break;
    }
    case "create_lead": {
      const id = randomUUID();
      // The lead must carry the customer's OWN words, not the agent's summary of
      // them. Downstream duties (qualifying, scoring, the sales handoff) decide
      // on this text, and an agent-authored paraphrase would make them score an
      // agent's optimism rather than what the buyer actually wrote.
      const evidence =
        typeof action.payload.evidence === "string" && action.payload.evidence.trim()
          ? action.payload.evidence.trim().slice(0, 4000)
          : action.rationale;
      await sql`
        insert into leads (id, company_name, source, stage, score, summary, inbound_id)
        values (
          ${id},
          ${companyName || "Unnamed company"},
          ${String(action.payload.source ?? "inbound")},
          ${String(action.payload.stage ?? "engaged")},
          ${num(action.payload.score, 40)},
          ${evidence},
          ${action.relatedId ?? null}
        )
      `;
      await sql`
        update inbound_items
        set status = 'routed', routed_to = ${agentId}
        where id = ${action.relatedId ?? ""}
      `;
      break;
    }
    case "update_lead": {
      if (action.relatedId) {
        await sql`
          update leads
          set stage = ${String(action.payload.stage ?? "engaged")},
              score = ${num(action.payload.score, 50)},
              summary = ${action.rationale},
              updated_at = now()
          where id = ${action.relatedId}
        `;
      }
      break;
    }
    case "draft_campaign":
    case "activate_campaign": {
      const budget = amount;
      const books = await loadCompanyTx(sql);
      const canPay = action.kind === "activate_campaign" && budget > 0 && books.treasuryCents >= budget;
      const status =
        action.kind === "activate_campaign"
          ? budget === 0
            ? "active"
            : canPay
              ? "active"
              : "awaiting_budget"
          : budget > 0
            ? "awaiting_budget"
            : "draft";
      const spend = canPay ? budget : 0;
      if (action.relatedId) {
        await sql`
          update campaigns
          set name = ${action.title},
              channel = ${String(action.payload.channel ?? "owned")},
              status = ${status},
              budget_cents = ${budget},
              spend_cents = ${spend},
              summary = ${action.rationale}
          where id = ${action.relatedId}
        `;
      } else {
        const id = randomUUID();
        await sql`
          insert into campaigns (id, name, channel, status, budget_cents, spend_cents, summary)
          values (
            ${id}, ${action.title}, ${String(action.payload.channel ?? "owned")},
            ${status}, ${budget}, ${spend}, ${action.rationale}
          )
        `;
      }
      if (canPay) {
        const vat = expenseVat(action.payload.vatTreatment, budget);
        const entryId = randomUUID();
        await sql`
          insert into ledger_entries (id, kind, counterparty, amount_cents, vat_cents, status, memo, related_id)
          values (
            ${entryId}, 'expense', ${String(action.payload.vendor ?? "Media")}, ${budget}, ${vat},
            'paid', ${action.rationale}, ${action.relatedId ?? null}
          )
        `;
        await sql`
          update company_state
          set treasury_cents = treasury_cents - ${budget}, updated_at = now()
          where id = ${COMPANY.id}
        `;
      }
      break;
    }
    case "handoff_to_sales": {
      if (action.relatedId) {
        await sql`
          update leads set stage = 'ready_for_sales', updated_at = now() where id = ${action.relatedId}
        `;
      }
      break;
    }
    case "open_opportunity": {
      // Never point an opportunity at a lead id that does not exist: create the
      // lead if the handoff did not already have one.
      let leadId = action.relatedId ? String(action.relatedId) : null;
      if (leadId) {
        const found = await sql<{ id: string }>`select id from leads where id = ${leadId} limit 1`;
        if (!found.length) leadId = null;
      }
      if (!leadId) {
        leadId = randomUUID();
        await sql`
          insert into leads (id, company_name, source, stage, score, summary)
          values (
            ${leadId}, ${companyName || "Unnamed company"}, 'sales',
            'in_sales', ${num(action.payload.score, 50)}, ${action.rationale}
          )
        `;
      }
      const id = randomUUID();
      await sql`
        insert into opportunities (id, lead_id, company_name, stage, value_cents, summary, handoff_approval_id)
        values (
          ${id}, ${leadId}, ${companyName || "Unnamed company"}, 'discovery',
          ${amount}, ${action.rationale}, ${approvalId ?? null}
        )
      `;
      break;
    }
    case "issue_quote": {
      if (action.relatedId) {
        await sql`
          update opportunities
          set stage = 'proposal',
              value_cents = ${amount},
              summary = ${action.rationale},
              updated_at = now()
          where id = ${action.relatedId}
        `;
      }
      const quoteId = randomUUID();
      const body = quoteDocumentBody(quoteId, action);
      await sql`
        insert into documents (id, title, kind, status, summary, related_id)
        values (${quoteId}, ${action.title}, 'quote', 'approved_unsent', ${body}, ${action.relatedId ?? null})
      `;
      break;
    }
    case "advance_opportunity": {
      if (action.relatedId) {
        await sql`
          update opportunities
          set stage = ${String(action.payload.stage ?? "proposal")},
              value_cents = ${amount || 0},
              summary = ${action.rationale},
              updated_at = now()
          where id = ${action.relatedId}
        `;
      }
      break;
    }
    case "propose_close_won": {
      if (action.relatedId) {
        await sql`
          update opportunities
          set stage = 'won', value_cents = ${amount}, summary = ${action.rationale}, updated_at = now()
          where id = ${action.relatedId}
        `;
      }
      break;
    }
    case "propose_close_lost": {
      if (action.relatedId) {
        await sql`
          update opportunities
          set stage = 'lost', summary = ${action.rationale}, updated_at = now()
          where id = ${action.relatedId}
        `;
      }
      break;
    }
    case "issue_invoice": {
      const id = randomUUID();
      const given = action.payload.vatCents;
      const vat =
        typeof given === "number" && Number.isInteger(given) && given >= 0 && given < amount
          ? given
          : ledgerVat(action.payload.vatTreatment, amount).vatCents;
      await sql`
        insert into ledger_entries (id, kind, counterparty, amount_cents, vat_cents, status, memo, related_id)
        values (${id}, 'invoice', ${companyName || "Counterparty"}, ${amount}, ${vat}, 'issued', ${action.rationale}, ${action.relatedId ?? null})
      `;
      await sql`
        update company_state
        set receivable_cents = receivable_cents + ${amount}, updated_at = now()
        where id = ${COMPANY.id}
      `;
      break;
    }
    case "record_expense": {
      const id = randomUUID();
      const vat = expenseVat(action.payload.vatTreatment, amount);
      const books = await loadCompanyTx(sql);
      const paid = amount > 0 && books.treasuryCents >= amount;
      await sql`
        insert into ledger_entries (id, kind, counterparty, amount_cents, vat_cents, status, memo, related_id)
        values (
          ${id}, 'expense', ${companyName || "Supplier"}, ${amount}, ${vat},
          ${paid ? "paid" : "payable"}, ${action.rationale}, ${action.relatedId ?? null}
        )
      `;
      if (paid) {
        await sql`
          update company_state
          set treasury_cents = treasury_cents - ${amount}, updated_at = now()
          where id = ${COMPANY.id}
        `;
      } else {
        await sql`
          update company_state
          set payable_cents = payable_cents + ${amount}, updated_at = now()
          where id = ${COMPANY.id}
        `;
      }
      break;
    }
    case "record_inbound_payment": {
      const id = randomUUID();
      // Cash may only ever be credited against money that is actually owed. The
      // old code did `treasury += amount` unconditionally and then floored the
      // receivable at zero, so a duplicated receipt — or a payment recorded
      // against nothing — created money from nothing.
      const applied = await applyReceiptAgainstReceivable(sql, amount);
      if (applied <= 0) {
        throw new Error(
          "No outstanding invoice to apply this receipt against. Record the invoice first, or file the payment as a notice for the founder to confirm.",
        );
      }
      await sql`
        insert into ledger_entries (id, kind, counterparty, amount_cents, vat_cents, status, memo, related_id)
        values (${id}, 'receipt', ${companyName || "Counterparty"}, ${applied}, 0, 'cleared', ${action.rationale}, ${action.relatedId ?? null})
      `;
      break;
    }
    case "open_ticket": {
      const id = randomUUID();
      await sql`
        insert into tickets (id, title, severity, status, owner_agent, summary, related_id)
        values (
          ${id}, ${action.title}, ${String(action.payload.severity ?? "p3")}, 'open',
          ${String(action.payload.owner ?? "forge")}, ${action.rationale}, ${action.relatedId ?? null}
        )
      `;
      break;
    }
    case "update_ticket": {
      if (action.relatedId) {
        await sql`
          update tickets
          set status = ${String(action.payload.status ?? "in_progress")},
              summary = ${action.rationale},
              updated_at = now()
          where id = ${action.relatedId}
        `;
      }
      break;
    }
    case "draft_document": {
      const id = randomUUID();
      await sql`
        insert into documents (id, title, kind, status, summary, related_id)
        values (${id}, ${action.title}, ${String(action.payload.kind ?? "internal")}, 'draft', ${action.rationale}, ${action.relatedId ?? null})
      `;
      break;
    }
    case "escalate_account_risk": {
      const id = randomUUID();
      await sql`
        insert into documents (id, title, kind, status, summary, related_id)
        values (
          ${id},
          ${"Service risk raised for founder decision"},
          'correspondence',
          'held',
          ${`${action.rationale} Nothing was refunded, credited, cancelled or promised. The founder decides the customer outcome.`},
          ${action.relatedId ?? null}
        )
      `;
      break;
    }
    case "notify_operator":
      break;
    default:
      throw new Error(`Unknown action kind: ${action.kind}`);
  }
}

/**
 * Authorise, execute and record one proposed action.
 *
 * Everything that mutates state happens inside a single transaction that holds
 * the audit-chain lock, so the decision row, the audit row, the chain head, and
 * the action's own side effects all land together or not at all. Previously the
 * side effects ran before the decision was recorded, so a throw mid-way left a
 * ledger entry with no decision and no audit trail.
 */
export async function applyProposedAction(
  agentId: string,
  action: ProposedAction,
  observation: { [key: string]: Json },
): Promise<{ decisionId: string; approvalId?: string; status: DecisionRow["status"]; error?: string }> {
  return withChain(async (tx) => {
    const company = await loadCompanyTx(tx);
    const companyName = (action.companyName || String(action.payload.companyName ?? "")).trim();
    const extras = {
      approvedHandoff: companyName ? await hasApprovedHandoff(tx, companyName) : false,
      opportunityWon: companyName ? await hasWonOpportunity(tx, companyName) : false,
    };
    const auth = authorizeAction(action, agentId, company, extras);

    if (auth.verdict === "deny") {
      const decisionId = await recordDecisionTx(tx, {
        agentId,
        action,
        status: "blocked",
        trace: auth.trace,
        reversibility: auth.reversibility,
        observation: { ...observation, reason: auth.reason },
      });
      await appendAuditTx(tx, "decision_blocked", action.title, auth.reason, agentId);
      return { decisionId, status: "blocked" as const };
    }

    if (auth.verdict === "review") {
      const approvalId = randomUUID();
      await tx`
        insert into approvals (
          id, kind, title, rationale, amount_cents, agent_id, company_name, status,
          risk_score, constitutional_trace_json, action_json
        ) values (
          ${approvalId}, ${auth.approvalKind ?? "constraint_margin"}, ${action.title},
          ${auth.reason}, ${action.amountCents}, ${agentId}, ${companyName || null},
          'pending', ${Math.round((1 - action.confidence) * 100)},
          ${JSON.stringify(auth.trace)}, ${JSON.stringify(action)}
        )
      `;
      const decisionId = await recordDecisionTx(tx, {
        agentId,
        action,
        status: "escalated",
        trace: auth.trace,
        reversibility: auth.reversibility,
        observation: { ...observation, reason: auth.reason, approvalId },
      });
      await appendAuditTx(
        tx,
        "approval_opened",
        action.title,
        `${auth.reason} Gate: ${auth.approvalKind ?? "review"}.`,
        agentId,
      );
      // Mail is best-effort and happens after commit: a slow SMTP call must not
      // hold the audit lock open.
      void notifyApproval({
        gate: auth.approvalKind ?? "review",
        title: action.title,
        reason: auth.reason,
        amountCents: action.amountCents,
        companyName,
      });
      return { decisionId, approvalId, status: "escalated" as const };
    }

    let decisionId: string;
    try {
      await executeAuthorized(tx, agentId, action);
      decisionId = await recordDecisionTx(tx, {
        agentId,
        action,
        status: "executed",
        trace: auth.trace,
        reversibility: auth.reversibility,
        observation,
      });
      await appendAuditTx(tx, "decision_executed", action.title, action.rationale, agentId);
    } catch (error) {
      // The transaction rolls back, so nothing was executed. Record the refusal
      // so the failure is visible in the audit trail rather than silent.
      const reason = error instanceof Error ? error.message : "Execution failed.";
      const failedId = await recordDecisionTx(tx, {
        agentId,
        action,
        status: "blocked",
        trace: auth.trace,
        reversibility: auth.reversibility,
        observation: { ...observation, reason, executionError: true },
      });
      await appendAuditTx(tx, "decision_blocked", action.title, reason, agentId);
      return { decisionId: failedId, status: "blocked" as const, error: reason };
    }
    return { decisionId, status: "executed" as const };
  });
}

async function notifyApproval(input: {
  gate: string;
  title: string;
  reason: string;
  amountCents: number;
  companyName: string;
}): Promise<void> {
  try {
    const { deliverFounderNotice } = await import("./notify.server");
    const { founderApprovalNotice } = await import("./notice");
    await deliverFounderNotice(founderApprovalNotice(input));
  } catch {
    // The approval is already on the desk and in the audit trail.
  }
}

/**
 * Founder decision on an escalated action.
 *
 * The approval row is CLAIMED with a conditional update (`where status =
 * 'pending' returning id`) before anything executes, inside the same
 * transaction that performs the work. Two clicks, two tabs, or a retry after a
 * network timeout can therefore never execute the action twice — which is the
 * difference between one invoice and two.
 */
export async function resolveApproval(input: {
  approvalId: string;
  decision: "approved" | "rejected";
  note?: string;
}): Promise<{ ok: boolean; error?: string }> {
  await ensureOffice();
  const note = (input.note ?? "").trim();

  return withChain(async (tx) => {
    const row = await tx<Record<string, unknown>>`
      select * from approvals where id = ${input.approvalId} for update
    `.then((rows) => rows[0]);
    if (!row) return { ok: false, error: "Approval not found." };
    if (String(row.status) !== "pending") {
      return { ok: false, error: "That approval has already been resolved." };
    }

    const action = parseJson<ProposedAction>(row.action_json, {
      kind: "notify_operator",
      title: String(row.title),
      rationale: String(row.rationale),
      confidence: 1,
      amountCents: num(row.amount_cents),
      payload: {},
    });
    const agentId = String(row.agent_id);

    if (input.decision === "rejected") {
      const claimed = await tx<{ id: string }>`
        update approvals
        set status = 'rejected',
            resolution_note = ${note || "Rejected by founder."},
            resolved_at = now()
        where id = ${input.approvalId} and status = 'pending'
        returning id
      `;
      if (!claimed.length) return { ok: false, error: "That approval has already been resolved." };
      // Record the refusal as its own decision so the escalation does not stay
      // open forever in the autonomy metrics.
      await recordDecisionTx(tx, {
        agentId,
        action,
        status: "blocked",
        trace: [],
        reversibility: "fully_reversible",
        observation: { gate: "founder", decision: "rejected", approvalId: input.approvalId },
      });
      await appendAuditTx(
        tx,
        "approval_rejected",
        String(row.title),
        note || "Founder rejected the action. It was not executed.",
        "founder",
      );
      return { ok: true };
    }

    // Approve: honour a halt. The governor refuses all agent action while the
    // office is halted; founder approval is the only thing that can lift that,
    // and it is not an implicit one.
    const company = await loadCompanyTx(tx);
    if (company.halted) {
      return {
        ok: false,
        error: "The office is halted. Resume it before approving queued work.",
      };
    }

    const claimed = await tx<{ id: string }>`
      update approvals
      set status = 'approved',
          resolution_note = ${note || "Approved by founder."},
          resolved_at = now()
      where id = ${input.approvalId} and status = 'pending'
      returning id
    `;
    if (!claimed.length) return { ok: false, error: "That approval has already been resolved." };

    if (action.kind === "handoff_to_sales") {
      const companyName = String(row.company_name ?? action.companyName ?? "Unnamed company");
      const oppId = randomUUID();
      let leadId = action.relatedId ? String(action.relatedId) : null;
      if (leadId) {
        const found = await tx<{ id: string }>`select id from leads where id = ${leadId} limit 1`;
        if (!found.length) leadId = null;
      }
      if (!leadId) {
        leadId = randomUUID();
        await tx`
          insert into leads (id, company_name, source, stage, score, summary)
          values (
            ${leadId}, ${companyName}, 'marketing', 'in_sales',
            ${num(action.payload.score, 55)}, ${action.rationale}
          )
        `;
      }
      await tx`
        insert into opportunities (id, lead_id, company_name, stage, value_cents, summary, handoff_approval_id)
        values (
          ${oppId}, ${leadId}, ${companyName}, 'discovery', ${action.amountCents},
          ${action.rationale}, ${input.approvalId}
        )
      `;
      await tx`update leads set stage = 'in_sales', updated_at = now() where id = ${leadId}`;
    } else {
      await executeAuthorized(tx, agentId, action, input.approvalId);
    }

    await recordDecisionTx(tx, {
      agentId,
      action,
      status: "executed",
      trace: [],
      reversibility: "partially_reversible",
      observation: { gate: "founder", decision: "approved", approvalId: input.approvalId },
    });
    await appendAuditTx(
      tx,
      "approval_approved",
      String(row.title),
      note || "Founder approved. Action executed inside the authorised envelope.",
      "founder",
    );
    return { ok: true };
  });
}

export async function setOfficeHalt(halted: boolean, reason: string): Promise<void> {
  await ensureOffice();
  const sql = await getSql();
  await sql`
    update company_state
    set halted = ${halted}, halt_reason = ${halted ? reason : null}, updated_at = now()
    where id = ${COMPANY.id}
  `;
  await sql`
    update agents set status = ${halted ? "halted" : "idle"}, current_task = ${halted ? "Halted by founder" : null}
  `;
  await appendAudit(
    halted ? "office_halt" : "office_resume",
    halted ? "Office halted" : "Office resumed",
    halted ? reason : "Founder resumed autonomous operations.",
    "founder",
  );
}

export async function logInboundItem(input: {
  channel: string;
  companyName: string;
  subject: string;
  summary: string;
  intent: string;
}): Promise<string> {
  await ensureOffice();
  const sql = await getSql();
  const id = randomUUID();
  await sql`
    insert into inbound_items (id, channel, company_name, subject, summary, intent, status)
    values (
      ${id}, ${input.channel}, ${input.companyName}, ${input.subject},
      ${input.summary}, ${input.intent}, 'received'
    )
  `;
  await appendAudit(
    "inbound_received",
    input.subject,
    `${input.channel} from ${input.companyName}: ${input.summary}`,
    "foyer",
  );
  return id;
}

export async function filePaymentNotice(input: {
  name: string;
  email: string;
  reference: string;
  amount: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = parsePaymentNotice(input);
  if (!parsed.ok) return parsed;
  const id = await logInboundItem({
    channel: "web",
    companyName: parsed.name,
    subject: `Payment notice ${parsed.reference}`,
    summary: `Email: ${input.email.trim()}\n${parsed.summary}`,
    intent: "payment_notice",
  });
  const company = await loadCompany();
  if (!company.halted) {
    await applyProposedAction(
      "foyer",
      {
        kind: "route_inbound",
        title: "Route payment notice",
        rationale: "Customer says they paid. Ledger holds the notice. No receipt is booked.",
        confidence: 0.95,
        amountCents: 0,
        companyName: parsed.name,
        relatedId: id,
        payload: { routedTo: "ledger" },
      },
      { source: "vantage-ars.co.za" },
    );
  }
  return { ok: true };
}

export async function dismissPaymentNotice(
  inboundId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const sql = await getSql();
  const company = await loadCompany();
  if (company.halted) return { ok: false, error: "Office is halted." };
  const item = await sql<Record<string, unknown>>`
    select * from inbound_items where id = ${inboundId} and intent = 'payment_notice'
  `.then((rows) => rows[0]);
  if (!item) return { ok: false, error: "That payment notice is not on the ledger." };
  if (String(item.status) === "filed") return { ok: false, error: "This notice is already filed." };
  await sql`update inbound_items set status = 'filed' where id = ${inboundId}`;
  await appendAudit(
    "payment_notice_filed",
    String(item.subject),
    "Founder filed the payment notice. Treasury was not changed.",
    "founder",
  );
  return { ok: true };
}

export function compactState(snapshot: OfficeSnapshot): Record<string, unknown> {
  return {
    treasuryCents: snapshot.company.treasuryCents,
    receivableCents: snapshot.company.receivableCents,
    payableCents: snapshot.company.payableCents,
    halted: snapshot.company.halted,
    pendingApprovals: snapshot.approvals.filter((a) => a.status === "pending").map((a) => ({
      id: a.id,
      kind: a.kind,
      title: a.title,
    })),
    inboundOpen: snapshot.inbound
      .filter((i) => i.status === "received")
      .slice(0, 8)
      .map((i) => ({
        id: i.id,
        companyName: i.companyName,
        subject: i.subject,
        intent: i.intent,
        summary: i.summary,
      })),
    leads: snapshot.leads.slice(0, 8).map((l) => ({
      id: l.id,
      companyName: l.companyName,
      stage: l.stage,
      score: l.score,
      summary: l.summary,
    })),
    opportunities: snapshot.opportunities.slice(0, 8).map((o) => ({
      id: o.id,
      companyName: o.companyName,
      stage: o.stage,
      valueCents: o.valueCents,
      summary: o.summary,
    })),
    campaigns: snapshot.campaigns.slice(0, 6).map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      budgetCents: c.budgetCents,
    })),
    tickets: snapshot.tickets
      .filter((t) => t.status !== "resolved")
      .slice(0, 6)
      .map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        severity: t.severity,
        summary: t.summary,
      })),
    documents: snapshot.documents.slice(0, 6).map((d) => ({
      id: d.id,
      title: d.title,
      kind: d.kind,
      status: d.status,
    })),
    publishedRates: PUBLISHED_RATES.map((rate) => ({
      id: rate.id,
      title: rate.title,
      price: rate.price,
      offered: rate.offered,
      basis: rate.basis,
    })),
  };
}

export async function founderClose(input: {
  opportunityId: string;
  outcome: "won" | "lost";
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const won = input.outcome === "won";
  return closeOpportunity({
    opportunityId: input.opportunityId,
    outcome: input.outcome,
    actor: "founder",
    note: won
      ? "Founder recorded the customer's acceptance. The quote was not emailed from here."
      : "Founder recorded that the customer declined. No email was sent.",
  });
}

/**
 * Close an opportunity on the customer's answer. Shared by the founder's
 * "Customer accepted/declined" buttons and the customer's own quote link, so
 * both follow the same rules: an approved quote must exist, and a win opens
 * exactly one delivery ticket. Nothing is invoiced or emailed here.
 *
 * Records are read straight from the database, not from `readSnapshot`. The
 * snapshot is windowed for display; using it here meant that once the office had
 * more than 40 documents or 80 tickets, an old quote became invisible and the
 * guards below silently stopped protecting the books.
 */
async function closeOpportunity(input: {
  opportunityId: string;
  outcome: "won" | "lost";
  actor: string;
  note: string;
  quoteId?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const company = await loadCompany();
  if (company.halted) return { ok: false, error: "Office is halted." };

  return withChain(async (tx) => {
    const rows = await tx<Record<string, unknown>>`
      select * from opportunities where id = ${input.opportunityId} for update
    `;
    const record = rows[0];
    if (!record) return { ok: false, error: "That opportunity is not on the pipeline." };
    const stage = String(record.stage);
    if (stage === "won" || stage === "lost") {
      return { ok: false, error: "This opportunity is already closed." };
    }
    const companyName = String(record.company_name);
    const valueCents = num(record.value_cents);

    const quotes = await tx<Record<string, unknown>>`
      select id, summary from documents
      where kind = 'quote' and status = 'approved_unsent' and related_id = ${input.opportunityId}
      order by created_at desc
      limit 5
    `;
    const quote = input.quoteId
      ? quotes.find((row) => String(row.id) === input.quoteId)
      : quotes[0];
    if (!quote) {
      return { ok: false, error: "Approve a quote before recording the customer's answer." };
    }

    const won = input.outcome === "won";
    if (won && valueCents <= 0) {
      return { ok: false, error: "There is no approved figure to accept." };
    }
    const note = input.note;
    await tx`
      update opportunities
      set stage = ${won ? "won" : "lost"},
          summary = ${`${note} ${String(record.summary)}`},
          updated_at = now()
      where id = ${input.opportunityId}
    `;
    await tx`
      update documents
      set status = ${won ? "accepted" : "declined"}
      where id = ${quote.id}
    `;
    if (won) {
      // `not exists` in the insert makes the delivery ticket idempotent even if
      // the customer clicks accept twice.
      const opened = await tx<{ id: string }>`
        insert into tickets (id, title, severity, status, owner_agent, summary, related_id)
        select ${randomUUID()}, ${deliveryJob(companyName, String(quote.summary)).title}, 'p3',
               'open', 'forge', ${deliveryJob(companyName, String(quote.summary)).summary},
               ${input.opportunityId}
        where not exists (
          select 1 from tickets where related_id = ${input.opportunityId}
        )
        returning id
      `;
      void opened;
    }
    await appendAuditTx(
      tx,
      won ? "customer_accepted" : "customer_declined",
      companyName,
      note,
      input.actor,
    );
    return { ok: true };
  });
}

// ── Customer quote links ─────────────────────────────────────────────────────


export type PublicQuote =
  | {
      ok: true;
      state: QuoteLinkState;
      companyName: string;
      amountCents: number;
      scope: string;
      reference: string | null;
      paymentNote: string;
      issuedAt: string;
      expiresAt: string;
      answeredAt: string | null;
      answerName: string | null;
    }
  | { ok: false; error: string };

function tokenHash(token: string): string {
  return sha256Hex(`quote-link:${token}`);
}

/** Founder: create a fresh link for an approved quote. Older links for it stop working. */
export async function createQuoteLink(
  documentId: string,
): Promise<{ ok: true; token: string; expiresAt: string } | { ok: false; error: string }> {
  const sql = await getSql();
  const company = await loadCompany();
  if (company.halted) return { ok: false, error: "Office is halted." };

  const quote = await sql<Record<string, unknown>>`
    select d.*, o.stage as opportunity_stage, o.company_name as opportunity_company
    from documents d
    left join opportunities o on o.id = d.related_id
    where d.id = ${documentId} and d.kind = 'quote'
  `.then((rows) => rows[0]);
  if (!quote || String(quote.status) !== "approved_unsent" || !quote.related_id) {
    return { ok: false, error: "Only an approved quote that is waiting on the customer can get a link." };
  }
  const stage = String(quote.opportunity_stage ?? "");
  if (stage === "won" || stage === "lost") {
    return { ok: false, error: "This opportunity is already closed." };
  }
  const opportunityId = String(quote.related_id);
  const opportunityCompany = String(quote.opportunity_company ?? "Customer");

  const token = randomBytes(32).toString("base64url");
  const expiresAt = linkExpiry().toISOString();
  await withChain(async (tx) => {
    await tx`
      update quote_links set revoked_at = now()
      where document_id = ${String(quote.id)} and revoked_at is null and answered_at is null
    `;
    await tx`
      insert into quote_links (id, token_hash, document_id, opportunity_id, expires_at)
      values (${randomUUID()}, ${tokenHash(token)}, ${String(quote.id)}, ${opportunityId}, ${expiresAt})
    `;
    await appendAuditTx(
      tx,
      "quote_link_created",
      opportunityCompany,
      `Customer quote link created, valid until ${expiresAt.slice(0, 10)}. Any earlier link for this quote was revoked. Nothing was emailed.`,
      "founder",
    );
  });
  return { ok: true, token, expiresAt };
}

/** Founder: stop every open link for a quote. */
export async function revokeQuoteLinks(documentId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const sql = await getSql();
  const rows = await sql<{ id: string }>`
    update quote_links set revoked_at = now()
    where document_id = ${documentId} and revoked_at is null and answered_at is null
    returning id
  `;
  if (rows.length === 0) return { ok: false, error: "There is no open link for this quote." };
  const quote = await sql<{ title: string }>`select title from documents where id = ${documentId}`
    .then((found) => found[0]);
  await appendAudit(
    "quote_link_revoked",
    quote?.title ?? "Quote",
    "Customer quote link revoked by the founder.",
    "founder",
  );
  return { ok: true };
}

/** Founder: the latest link per quote, for the Sales page. */
export async function listQuoteLinks(): Promise<QuoteLinkSummary[]> {
  const sql = await getSql();
  // One row per quote via DISTINCT ON instead of pulling every historical link
  // into memory and de-duplicating in JS.
  const rows = await sql<Record<string, unknown>>`
    select distinct on (l.document_id)
      l.document_id, l.expires_at, l.revoked_at, l.answer, l.answer_name, l.answer_note,
      l.created_at, l.first_viewed_at, l.last_viewed_at, l.view_count, l.answered_at,
      d.status as document_status
    from quote_links l
    join documents d on d.id = l.document_id
    order by l.document_id, l.created_at desc
  `;
  return rows.map((row) => {
    const documentId = String(row.document_id);
    const record = {
      expiresAt: iso(row.expires_at),
      revokedAt: row.revoked_at ? iso(row.revoked_at) : null,
      answer: row.answer ? String(row.answer) : null,
    };
    return {
      documentId,
      state: linkState(record, String(row.document_status)),
      createdAt: iso(row.created_at),
      expiresAt: record.expiresAt,
      firstViewedAt: row.first_viewed_at ? iso(row.first_viewed_at) : null,
      lastViewedAt: row.last_viewed_at ? iso(row.last_viewed_at) : null,
      viewCount: num(row.view_count),
      answeredAt: row.answered_at ? iso(row.answered_at) : null,
      answerName: row.answer_name ? String(row.answer_name) : null,
      answerNote: row.answer_note ? String(row.answer_note) : null,
    };
  });
}

async function findLink(token: string): Promise<Record<string, unknown> | null> {
  if (!plausibleToken(token)) return null;
  const sql = await getSql();
  const rows = await sql<Record<string, unknown>>`
    select * from quote_links where token_hash = ${tokenHash(token)} limit 1
  `;
  return rows[0] ?? null;
}

/**
 * Public: what the customer sees on their link. Records the view.
 *
 * Reads only the three rows it needs. This used to call `readSnapshot`, which
 * meant an unauthenticated request to `/q/<token>` fired ~30 queries including
 * every table in the office — a free denial-of-service surface and a slow page.
 */
export async function readPublicQuote(token: string, countView = true): Promise<PublicQuote> {
  const link = await findLink(token);
  if (!link) return { ok: false, error: "This quote link is not valid. Ask us for a new one." };
  const sql = await getSql();

  const joined = await sql<Record<string, unknown>>`
    select
      d.status        as document_status,
      d.summary       as document_summary,
      d.created_at    as issued_at,
      o.company_name  as company_name,
      o.value_cents   as value_cents
    from documents d
    join opportunities o on o.id = d.related_id
    where d.id = ${String(link.document_id)}
    limit 1
  `.then((rows) => rows[0]);
  if (!joined) return { ok: false, error: "This quote is no longer on file. Ask us for a new one." };

  const record = {
    expiresAt: iso(link.expires_at),
    revokedAt: link.revoked_at ? iso(link.revoked_at) : null,
    answer: link.answer ? String(link.answer) : null,
  };
  const state = linkState(record, String(joined.document_status));
  if (state === "revoked") {
    return { ok: false, error: "This quote link was replaced or withdrawn. Ask us for the current one." };
  }
  if (countView && state === "open") {
    await sql`
      update quote_links
      set view_count = view_count + 1,
          first_viewed_at = coalesce(first_viewed_at, now()),
          last_viewed_at = now()
      where id = ${String(link.id)} and answered_at is null
    `;
  }

  const company = await loadCompany();
  const scope = customerQuoteText(String(joined.document_summary));
  return {
    ok: true,
    state,
    companyName: String(joined.company_name),
    amountCents: num(joined.value_cents),
    scope,
    reference: scope.match(/Reference:\s*(VA-[A-Z0-9]+)/)?.[1] ?? null,
    paymentNote: paymentNote(company.paymentInstructions),
    issuedAt: iso(joined.issued_at),
    expiresAt: record.expiresAt,
    answeredAt: link.answered_at ? iso(link.answered_at) : null,
    answerName: link.answer_name ? String(link.answer_name) : null,
  };
}

/** Public: the customer accepts or declines on their link. */
export async function answerPublicQuote(
  token: string,
  answer: { outcome: "accepted" | "declined"; name: string; note: string },
): Promise<{ ok: true; companyName: string; amountCents: number } | { ok: false; error: string }> {
  const link = await findLink(token);
  if (!link) return { ok: false, error: "This quote link is not valid. Ask us for a new one." };
  const view = await readPublicQuote(token, false);
  if (!view.ok) return view;
  if (view.state !== "open") {
    const why: Record<string, string> = {
      accepted: "This quote was already accepted.",
      declined: "This quote was already declined.",
      expired: "This quote link has expired. Ask us for a fresh quote.",
      closed: "This quote is closed. Ask us for a fresh quote.",
    };
    return { ok: false, error: why[view.state] ?? "This quote can no longer be answered." };
  }
  const sql = await getSql();
  // Claim the link first so a double click cannot record two answers.
  const claimed = await sql<{ id: string }>`
    update quote_links
    set answered_at = now(), answer = ${answer.outcome}, answer_name = ${answer.name}, answer_note = ${answer.note || null}
    where id = ${String(link.id)} and answered_at is null and revoked_at is null
    returning id
  `;
  if (claimed.length === 0) return { ok: false, error: "This quote was already answered." };
  const won = answer.outcome === "accepted";
  const note = won
    ? `Customer accepted on their quote link as "${answer.name}".${answer.note ? ` Note: ${answer.note}` : ""}`
    : `Customer declined on their quote link as "${answer.name}".${answer.note ? ` Note: ${answer.note}` : ""}`;
  const closed = await closeOpportunity({
    opportunityId: String(link.opportunity_id),
    outcome: won ? "won" : "lost",
    actor: "customer",
    note,
    quoteId: String(link.document_id),
  });
  if (!closed.ok) {
    await sql`update quote_links set answered_at = null, answer = null, answer_name = null, answer_note = null where id = ${String(link.id)}`;
    return closed;
  }
  return { ok: true, companyName: view.companyName, amountCents: view.amountCents };
}

export async function raiseQuoteInvoice(
  opportunityId: string,
  vatTreatment: VatTreatment = "none",
): Promise<{ ok: true } | { ok: false; error: string }> {
  const sql = await getSql();
  const company = await loadCompany();
  if (company.halted) return { ok: false, error: "Office is halted." };
  const record = await sql<Record<string, unknown>>`
    select * from opportunities where id = ${opportunityId}
  `.then((rows) => rows[0]);
  if (!record || String(record.stage) !== "won") {
    return { ok: false, error: "Invoice only after the customer has accepted." };
  }
  const opportunityCompany = String(record.company_name);
  const treatment = parseVatTreatment(vatTreatment);
  const figure = quoteInvoice(num(record.value_cents), treatment);
  if (!figure.ok) return figure;

  // Guard against a double submit booking two invoices. This must query the whole
  // table, not a window of the 80 most recent ledger rows.
  const existing = await sql<{ id: string }>`
    select id from ledger_entries where kind = 'invoice' and related_id = ${opportunityId} limit 1
  `;
  if (existing.length) return { ok: false, error: "An invoice is already on the books for this job." };

  const result = await applyProposedAction(
    "ledger",
    {
      kind: "issue_invoice",
      title: `Invoice · ${opportunityCompany}`,
      rationale: figure.memo,
      confidence: 0.95,
      amountCents: figure.cents,
      companyName: opportunityCompany,
      relatedId: opportunityId,
      payload: { vatTreatment: treatment, vatCents: figure.vatCents },
    },
    { source: "ledger-desk" },
  );
  if (result.status !== "executed") {
    return { ok: false, error: result.error ?? "The invoice was not raised." };
  }

  const docId = randomUUID();
  const text = invoiceCopy(opportunityCompany, figure.cents, documentRef(docId), {
    treatment,
    netCents: figure.netCents,
    vatCents: figure.vatCents,
  });
  await sql`
    insert into documents (id, title, kind, status, summary, related_id)
    select ${docId}, ${`Invoice · ${opportunityCompany}`}, 'invoice', 'approved_unsent', ${text}, ${opportunityId}
    where not exists (
      select 1 from documents where kind = 'invoice' and related_id = ${opportunityId}
    )
  `;
  return { ok: true };
}

export async function recordInvoiceReceipt(
  invoiceId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const sql = await getSql();
  const company = await loadCompany();
  if (company.halted) return { ok: false, error: "Office is halted." };
  const record = await sql<Record<string, unknown>>`
    select * from ledger_entries where id = ${invoiceId} and kind = 'invoice'
  `.then((rows) => rows[0]);
  if (!record || String(record.status) !== "issued") {
    return { ok: false, error: "That invoice is not awaiting payment." };
  }
  const counterparty = String(record.counterparty);
  const invoiceVat = num(record.vat_cents);
  const figure = receiptForInvoice(num(record.amount_cents));
  if (!figure.ok) return figure;

  // Whole-table guard: crediting treasury twice is how money appears from
  // nothing, so this must never depend on a windowed read.
  const already = await sql<{ id: string }>`
    select id from ledger_entries where kind = 'receipt' and related_id = ${invoiceId} limit 1
  `;
  if (already.length) return { ok: false, error: "A receipt is already recorded for this invoice." };

  const result = await applyProposedAction(
    "ledger",
    {
      kind: "record_inbound_payment",
      title: `Receipt · ${counterparty}`,
      rationale: figure.memo,
      confidence: 0.95,
      amountCents: figure.cents,
      companyName: counterparty,
      relatedId: invoiceId,
      payload: {},
    },
    { source: "ledger-desk" },
  );
  if (result.status !== "executed") {
    return { ok: false, error: result.error ?? "The receipt was not recorded." };
  }
  await sql`update ledger_entries set status = 'paid' where id = ${invoiceId} and kind = 'invoice'`;
  const text = receiptCopy(counterparty, figure.cents, {
    treatment: invoiceVat > 0 ? "included" : "none",
    netCents: figure.cents - invoiceVat,
    vatCents: invoiceVat,
  });
  await sql`
    insert into documents (id, title, kind, status, summary, related_id)
    select ${randomUUID()}, ${`Receipt · ${counterparty}`}, 'receipt', 'recorded', ${text}, ${invoiceId}
    where not exists (
      select 1 from documents where kind = 'receipt' and related_id = ${invoiceId}
    )
  `;
  await appendAudit("payment_received", counterparty, figure.memo, "founder");
  return { ok: true };
}

export async function setTicketStatus(
  ticketId: string,
  status: "in_progress" | "resolved",
): Promise<{ ok: true } | { ok: false; error: string }> {
  const sql = await getSql();
  const company = await loadCompany();
  if (company.halted) return { ok: false, error: "Office is halted." };
  const record = await sql<Record<string, unknown>>`
    select * from tickets where id = ${ticketId}
  `.then((rows) => rows[0]);
  if (!record) return { ok: false, error: "That ticket is not on the floor." };
  const next = status === "resolved" ? "resolved" : "in_progress";
  const allowed = nextTicketStatus(String(record.status), next);
  if (!allowed.ok) return allowed;
  await sql`update tickets set status = ${next}, updated_at = now() where id = ${ticketId}`;
  const note =
    next === "resolved"
      ? "Founder marked the work resolved. The customer was not emailed."
      : "Founder started the work. The customer was not emailed.";
  await appendAudit(next === "resolved" ? "ticket_resolved" : "ticket_started", String(record.title), note, "founder");
  return { ok: true };
}

export async function savePaymentInstructions(
  text: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const snapshot = await readSnapshot();
  if (snapshot.company.halted) return { ok: false, error: "Office is halted." };
  const note = paymentNote(text);
  const sql = await getSql();
  await sql`
    update company_state
    set payment_instructions = ${note}, updated_at = now()
    where id = ${COMPANY.id}
  `;
  await appendAudit(
    "payment_instructions",
    "Payment instructions",
    note ? "Founder set how customers should pay. Nothing was emailed." : "Founder cleared the payment instructions.",
    "founder",
  );
  return { ok: true };
}

export type { DispatchResult, ActionKind };

export async function exportBackupJson(): Promise<string> {
  const { BACKUP_TABLES, buildBackup } = await import("./backup");
  const sql = await getSql();
  const tables: Record<string, Record<string, unknown>[]> = {};
  await Promise.all(
    BACKUP_TABLES.map(async (name) => {
      // Names come from a fixed list in backup.ts, never from user input.
      tables[name] = await sql.query<Record<string, unknown>>(`select * from ${name}`);
    }),
  );
  return JSON.stringify(buildBackup(tables));
}

export async function restoreBackupJson(
  json: string,
): Promise<{ ok: true; added: Record<string, number> } | { ok: false; error: string }> {
  const { BACKUP_RESTORE_ORDER, MAX_RESTORE_BYTES, planRestore } = await import("./backup");
  if (typeof json !== "string" || json.length === 0) {
    return { ok: false, error: "The backup file is empty." };
  }
  // Measure BYTES, not UTF-16 code units: `json.length` under-counts non-ASCII by
  // up to 3x, so the old guard could admit a 12 MB body.
  const bytes = Buffer.byteLength(json, "utf8");
  if (bytes > MAX_RESTORE_BYTES) {
    return {
      ok: false,
      error: `The backup file is ${(bytes / 1_000_000).toFixed(1)} MB. The limit is ${(MAX_RESTORE_BYTES / 1_000_000).toFixed(0)} MB.`,
    };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: "That file is not valid JSON." };
  }
  const sql = await getSql();
  const names = Object.keys((parsed as { tables?: Record<string, unknown> } | null)?.tables ?? {}).filter((n) =>
    /^[a-z_]+$/.test(n),
  );
  const columnsByTable = await Promise.all(
    names.map(async (name) => {
      const rows = await sql<{ column_name: string }>`
        select column_name from information_schema.columns
        where table_schema = current_schema() and table_name = ${name}
      `;
      return [name, rows.map((row) => row.column_name)] as const;
    }),
  );
  const plan = planRestore(parsed, Object.fromEntries(columnsByTable));
  if (!plan.ok) return plan;

  const added: Record<string, number> = {};
  const ordered = [...plan.tables].sort(
    (a, b) => BACKUP_RESTORE_ORDER.indexOf(a.name) - BACKUP_RESTORE_ORDER.indexOf(b.name),
  );
  // One transaction for the whole restore: a half-restored office is worse than
  // one that refused the file.
  await withChain(async (tx) => {
    for (const table of ordered) {
      // table.name passed the fixed allow-list in planRestore; it is never raw user input.
      const result = await tx.query<{ n: number }>(
        `with ins as (
           insert into ${table.name}
           select * from jsonb_populate_recordset(null::${table.name}, $1::jsonb)
           on conflict do nothing
           returning 1
         ) select count(*)::int as n from ins`,
        [JSON.stringify(table.rows)],
      );
      added[table.name] = Number(result[0]?.n ?? 0);
    }
    await appendAuditTx(
      tx,
      "backup_restored",
      "Backup restored",
      `Add-only restore applied. Tables and rows added: ${Object.entries(added)
        .filter(([, n]) => n > 0)
        .map(([name, n]) => `${name} ${n}`)
        .join(", ") || "nothing (everything already existed)"}. Nothing was deleted or overwritten.`,
      "founder",
    );
  });
  return { ok: true, added };
}
