import { randomUUID } from "node:crypto";
import { getSql } from "@/lib/db";
import { AGENT_DEFS, AGENT_BY_ID } from "./agents";
import { CONSTITUTION } from "./constitution";
import { COMPANY, GENESIS_HASH } from "./company";
import { authorizeAction } from "./governor";
import { chainHash, sha256Hex, stableStringify } from "./hash";
import { vatOn } from "./money";
import { PUBLISHED_RATES } from "./catalogue";
import { deliveryJob, documentRef, invoiceCopy, ledgerVat, parseVatTreatment, type VatTreatment, paymentInstructionsText, paymentNote, quoteInvoice, receiptCopy, receiptForInvoice } from "./invoice";
import { parsePaymentNotice } from "./payment-notice";
import { nextTicketStatus } from "./ticket";
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

async function appendAudit(
  kind: string,
  title: string,
  body: string,
  actor: string,
): Promise<string> {
  const sql = await getSql();
  const company = await loadCompany();
  const id = randomUUID();
  const recordHash = chainHash(company.lastAuditHash, { id, kind, title, body, actor });
  await sql`
    insert into audit_events (id, kind, title, body, actor, previous_hash, record_hash)
    values (${id}, ${kind}, ${title}, ${body}, ${actor}, ${company.lastAuditHash}, ${recordHash})
  `;
  await sql`
    update company_state
    set last_audit_hash = ${recordHash}, updated_at = now()
    where id = ${COMPANY.id}
  `;
  return recordHash;
}

async function loadCompany(): Promise<CompanySnapshot> {
  const sql = await getSql();
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

export async function ensureOffice(): Promise<void> {
  const sql = await getSql();
  const existing = await sql<{ id: string }>`select id from company_state where id = ${COMPANY.id}`;
  if (existing.length) {
    await syncRoster();
    return;
  }

  await sql`
    insert into company_state (
      id, legal_name, trading_name, domain, jurisdiction, timezone, currency, vat_rate,
      author_name, author_role, constitution_version, treasury_cents, receivable_cents,
      payable_cents, autonomy_level, halted, last_audit_hash
    ) values (
      ${COMPANY.id}, ${COMPANY.legalName}, ${COMPANY.tradingName}, ${COMPANY.domain},
      ${COMPANY.jurisdiction}, ${COMPANY.timezone}, ${COMPANY.currency}, ${COMPANY.vatRate},
      ${COMPANY.authorName}, ${COMPANY.authorRole}, ${COMPANY.constitutionVersion},
      0, 0, 0, ${COMPANY.autonomyLevel}, false, ${GENESIS_HASH}
    )
  `;

  for (const p of CONSTITUTION) {
    await sql`
      insert into constitution_provisions (
        id, article_id, title, priority, body, enforcement, machine_checkable, parameters_json
      ) values (
        ${p.id}, ${p.articleId}, ${p.title}, ${p.priority}, ${p.body}, ${p.enforcement},
        ${p.machineCheckable}, ${JSON.stringify(p.parameters)}
      )
    `;
  }

  for (const a of AGENT_DEFS) {
    await insertAgent(a);
  }

  await appendAudit(
    "office_open",
    "Office provisioned",
    "Constitution v1.0.0 ratified by Juan-louw Greyling. Nine non-human identities issued. Treasury R0.00. Autonomy A3 within role; founder gates on cost, customer win, customer loss, and marketing-to-sales handoff.",
    "constitution",
  );
}

async function insertAgent(a: AgentDef): Promise<void> {
  const sql = await getSql();
  await sql`
    insert into agents (
      id, callsign, title, department, spiffe_id, status, autonomy_level, summary,
      allowed_actions_json, bindings_json, authority_json, current_task, last_heartbeat
    ) values (
      ${a.id}, ${a.callsign}, ${a.title}, ${a.department}, ${a.spiffeId}, 'idle',
      ${a.autonomyLevel}, ${a.summary}, ${JSON.stringify(a.allowedActions)},
      ${JSON.stringify(a.bindings)}, ${JSON.stringify(a.authority)}, null, now()
    )
  `;
}

async function syncRoster(): Promise<void> {
  const sql = await getSql();
  const rows = await sql<{ id: string }>`select id from agents`;
  const have = new Set(rows.map((row) => String(row.id)));
  for (const agent of AGENT_DEFS) {
    if (have.has(agent.id)) continue;
    await insertAgent(agent);
    await appendAudit(
      "identity_issued",
      `${agent.callsign} issued`,
      `${agent.title} joined the floor. ${agent.summary}`,
      "constitution",
    );
  }
  for (const agent of AGENT_DEFS) {
    await sql`update agents set summary = ${agent.summary} where id = ${agent.id} and summary <> ${agent.summary}`;
  }
  const role = CONSTITUTION.find((provision) => provision.id === "art-11");
  if (role) {
    await sql`
      update constitution_provisions
      set body = ${role.body}
      where id = ${"art-11"} and body not like ${"%Customer service%"}
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
  const hardViolations = 0;
  const interventionRate = total === 0 ? 0 : escalated / total;
  const autonomousResolution = total === 0 ? 1 : executed / total;
  const constraintAdherence = hardViolations === 0 ? 1 : 0;
  const decisionQuality = total === 0 ? 1 : Math.max(0, 1 - blocked / Math.max(total, 1));
  const governance = company.halted ? 0.4 : 0.98;
  const selfHealing = pending > 20 ? 0.7 : 0.94;
  const overall =
    constraintAdherence * 0.3 +
    decisionQuality * 0.2 +
    governance * 0.2 +
    selfHealing * 0.15 +
    autonomousResolution * 0.15;
  return {
    overall: Number(overall.toFixed(3)),
    decisionQuality: Number(decisionQuality.toFixed(3)),
    constraintAdherence,
    selfHealing,
    governance,
    interventionRate: Number(interventionRate.toFixed(5)),
    autonomousResolution: Number(autonomousResolution.toFixed(4)),
    decisionCount: total,
    pendingApprovals: pending,
    hardViolations,
  };
}

export async function readSnapshot(): Promise<OfficeSnapshot> {
  await ensureOffice();
  const sql = await getSql();
  await sql`
    create table if not exists founder_notices (
      id text primary key,
      kind text not null,
      subject text not null,
      status text not null,
      detail text not null,
      created_at timestamptz not null default now()
    )
  `;
  await sql`alter table documents add column if not exists related_id text`;
  await sql`alter table tickets add column if not exists related_id text`;
  await sql`alter table company_state add column if not exists payment_instructions text not null default ''`;
  await sql`
    update company_state
    set payment_instructions = ${paymentInstructionsText()}
    where id = ${COMPANY.id}
      and (
        coalesce(payment_instructions, '') = ''
        or payment_instructions like ${"%beneficiary Vantage-ARS.%"}
      )
  `;
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

async function hasApprovedHandoff(companyName: string): Promise<boolean> {
  const sql = await getSql();
  const rows = await sql<{ id: string }>`
    select id from approvals
    where kind = 'sales_handoff'
      and status = 'approved'
      and lower(coalesce(company_name, '')) = ${companyName.toLowerCase()}
    limit 1
  `;
  return rows.length > 0;
}

async function hasWonOpportunity(companyName: string): Promise<boolean> {
  const sql = await getSql();
  const rows = await sql<{ id: string }>`
    select id from opportunities
    where stage = 'won' and lower(company_name) = ${companyName.toLowerCase()}
    limit 1
  `;
  return rows.length > 0;
}

async function recordDecision(input: {
  agentId: string;
  action: ProposedAction;
  status: DecisionRow["status"];
  trace: ProvisionCheck[];
  reversibility: DecisionRow["reversibility"];
  observation: Record<string, Json>;
}): Promise<string> {
  const sql = await getSql();
  const company = await loadCompany();
  const id = randomUUID();
  const evidenceHash = sha256Hex(stableStringify(input.action));
  const recordHash = chainHash(company.lastAuditHash, {
    id,
    agentId: input.agentId,
    action: input.action,
    status: input.status,
    trace: input.trace,
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
      ${evidenceHash}, ${company.lastAuditHash}, ${recordHash}
    )
  `;
  await sql`
    update company_state set last_audit_hash = ${recordHash}, updated_at = now() where id = ${COMPANY.id}
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

async function executeAuthorized(agentId: string, action: ProposedAction, approvalId?: string): Promise<void> {
  const sql = await getSql();
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
        insert into documents (id, title, kind, status, summary)
        values (${id}, ${action.title}, 'correspondence', 'draft', ${body})
      `;
      break;
    }
    case "create_lead": {
      const id = randomUUID();
      await sql`
        insert into leads (id, company_name, source, stage, score, summary, inbound_id)
        values (
          ${id},
          ${companyName || "Unnamed company"},
          ${String(action.payload.source ?? "inbound")},
          ${String(action.payload.stage ?? "engaged")},
          ${num(action.payload.score, 40)},
          ${action.rationale},
          ${action.relatedId ?? null}
        )
      `;
      if (action.relatedId) {
        await sql`
          update inbound_items
          set status = 'routed', routed_to = ${agentId}
          where id = ${action.relatedId}
        `;
      }
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
      const company = await loadCompany();
      const canPay = action.kind === "activate_campaign" && budget > 0 && company.treasuryCents >= budget;
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
        const vat = vatOn(budget, COMPANY.vatRate);
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
      const leadId = String(action.relatedId ?? randomUUID());
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
      const drafted = typeof action.payload.body === "string" ? action.payload.body : action.rationale;
      const body = `${drafted} Reference: ${documentRef(quoteId)}.`;
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
      const vat = vatOn(amount, COMPANY.vatRate);
      const books = await loadCompany();
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
      await sql`
        insert into ledger_entries (id, kind, counterparty, amount_cents, vat_cents, status, memo, related_id)
        values (${id}, 'receipt', ${companyName || "Counterparty"}, ${amount}, 0, 'cleared', ${action.rationale}, ${action.relatedId ?? null})
      `;
      await sql`
        update company_state
        set treasury_cents = treasury_cents + ${amount},
            receivable_cents = greatest(receivable_cents - ${amount}, 0),
            updated_at = now()
        where id = ${COMPANY.id}
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
        insert into documents (id, title, kind, status, summary)
        values (${id}, ${action.title}, ${String(action.payload.kind ?? "internal")}, 'draft', ${action.rationale})
      `;
      break;
    }
    case "escalate_account_risk": {
      const id = randomUUID();
      await sql`
        insert into documents (id, title, kind, status, summary)
        values (
          ${id},
          ${"Service risk cleared"},
          'correspondence',
          'held',
          ${"Founder cleared the desk to continue. No refund, credit, or cancellation is booked by this action."}
        )
      `;
      break;
    }
    case "notify_operator":
      break;
    default:
      break;
  }
}

export async function applyProposedAction(
  agentId: string,
  action: ProposedAction,
  observation: { [key: string]: Json },
): Promise<{ decisionId: string; approvalId?: string; status: DecisionRow["status"] }> {
  const company = await loadCompany();
  const companyName = (action.companyName || String(action.payload.companyName ?? "")).trim();
  const extras = {
    approvedHandoff: companyName ? await hasApprovedHandoff(companyName) : false,
    opportunityWon: companyName ? await hasWonOpportunity(companyName) : false,
  };
  const auth = authorizeAction(action, agentId, company, extras);

  if (auth.verdict === "deny") {
    const decisionId = await recordDecision({
      agentId,
      action,
      status: "blocked",
      trace: auth.trace,
      reversibility: auth.reversibility,
      observation: { ...observation, reason: auth.reason },
    });
    await appendAudit("decision_blocked", action.title, auth.reason, agentId);
    return { decisionId, status: "blocked" };
  }

  if (auth.verdict === "review") {
    const sql = await getSql();
    const approvalId = randomUUID();
    await sql`
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
    const decisionId = await recordDecision({
      agentId,
      action,
      status: "escalated",
      trace: auth.trace,
      reversibility: auth.reversibility,
      observation: { ...observation, reason: auth.reason, approvalId },
    });
    await appendAudit(
      "approval_opened",
      action.title,
      `${auth.reason} Gate: ${auth.approvalKind ?? "review"}.`,
      agentId,
    );
    try {
      const { deliverFounderNotice } = await import("./notify.server");
      const { founderApprovalNotice } = await import("./notice");
      await deliverFounderNotice(
        founderApprovalNotice({
          gate: auth.approvalKind ?? "review",
          title: action.title,
          reason: auth.reason,
          amountCents: action.amountCents,
          companyName,
        }),
      );
    } catch {
      // The approval is already on the desk.
    }
    return { decisionId, approvalId, status: "escalated" };
  }

  await executeAuthorized(agentId, action);
  const decisionId = await recordDecision({
    agentId,
    action,
    status: "executed",
    trace: auth.trace,
    reversibility: auth.reversibility,
    observation,
  });
  await appendAudit("decision_executed", action.title, action.rationale, agentId);
  return { decisionId, status: "executed" };
}

export async function resolveApproval(input: {
  approvalId: string;
  decision: "approved" | "rejected";
  note?: string;
}): Promise<{ ok: boolean; error?: string }> {
  await ensureOffice();
  const sql = await getSql();
  const rows = await sql<Record<string, unknown>>`
    select * from approvals where id = ${input.approvalId} limit 1
  `;
  const row = rows[0];
  if (!row) return { ok: false, error: "Approval not found." };
  if (String(row.status) !== "pending") return { ok: false, error: "Approval already resolved." };

  const action = parseJson<ProposedAction>(row.action_json, {
    kind: "notify_operator",
    title: String(row.title),
    rationale: String(row.rationale),
    confidence: 1,
    amountCents: num(row.amount_cents),
    payload: {},
  });
  const agentId = String(row.agent_id);
  const note = (input.note ?? "").trim();

  if (input.decision === "rejected") {
    await sql`
      update approvals
      set status = 'rejected', resolution_note = ${note || "Rejected by founder."}, resolved_at = now()
      where id = ${input.approvalId}
    `;
    await appendAudit(
      "approval_rejected",
      String(row.title),
      note || "Founder rejected the action. It was not executed.",
      "founder",
    );
    return { ok: true };
  }

  if (action.kind === "handoff_to_sales") {
    const companyName = String(row.company_name ?? action.companyName ?? "Unnamed company");
    const oppId = randomUUID();
    const leadId = String(action.relatedId ?? randomUUID());
    await sql`
      insert into opportunities (id, lead_id, company_name, stage, value_cents, summary, handoff_approval_id)
      values (
        ${oppId}, ${leadId}, ${companyName}, 'discovery', ${action.amountCents},
        ${action.rationale}, ${input.approvalId}
      )
    `;
    if (action.relatedId) {
      await sql`update leads set stage = 'in_sales', updated_at = now() where id = ${action.relatedId}`;
    }
  } else {
    await executeAuthorized(agentId, action, input.approvalId);
  }

  await sql`
    update approvals
    set status = 'approved', resolution_note = ${note || "Approved by founder."}, resolved_at = now()
    where id = ${input.approvalId}
  `;
  await appendAudit(
    "approval_approved",
    String(row.title),
    note || "Founder approved. Action executed inside the authorised envelope.",
    "founder",
  );
  return { ok: true };
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
  const snapshot = await readSnapshot();
  if (!snapshot.company.halted) {
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
  const snapshot = await readSnapshot();
  if (snapshot.company.halted) return { ok: false, error: "Office is halted." };
  const item = snapshot.inbound.find((row) => row.id === inboundId && row.intent === "payment_notice");
  if (!item) return { ok: false, error: "That payment notice is not on the ledger." };
  if (item.status === "filed") return { ok: false, error: "This notice is already filed." };
  const sql = await getSql();
  await sql`update inbound_items set status = 'filed' where id = ${item.id}`;
  await appendAudit(
    "payment_notice_filed",
    item.subject,
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
  const snapshot = await readSnapshot();
  if (snapshot.company.halted) return { ok: false, error: "Office is halted." };
  const opportunity = snapshot.opportunities.find((item) => item.id === input.opportunityId);
  if (!opportunity) return { ok: false, error: "That opportunity is not on the pipeline." };
  if (opportunity.stage === "won" || opportunity.stage === "lost") {
    return { ok: false, error: "This opportunity is already closed." };
  }
  const quote = snapshot.documents.find(
    (item) => item.kind === "quote" && item.status === "approved_unsent" && item.relatedId === opportunity.id,
  );
  if (!quote) return { ok: false, error: "Approve a quote before recording the customer's answer." };
  if (input.outcome === "won" && opportunity.valueCents <= 0) {
    return { ok: false, error: "There is no approved figure to accept." };
  }
  const sql = await getSql();
  const won = input.outcome === "won";
  const note = won
    ? "Founder recorded the customer's acceptance. The quote was not emailed from here."
    : "Founder recorded that the customer declined. No email was sent.";
  await sql`
    update opportunities
    set stage = ${won ? "won" : "lost"},
        summary = ${`${note} ${opportunity.summary}`},
        updated_at = now()
    where id = ${opportunity.id}
  `;
  await sql`
    update documents
    set status = ${won ? "accepted" : "declined"}
    where id = ${quote.id}
  `;
  if (won) {
    const existing = snapshot.tickets.some((item) => item.relatedId === opportunity.id);
    if (!existing) {
      const job = deliveryJob(opportunity.companyName, quote.summary);
      const ticketId = randomUUID();
      await sql`
        insert into tickets (id, title, severity, status, owner_agent, summary, related_id)
        values (${ticketId}, ${job.title}, 'p3', 'open', 'forge', ${job.summary}, ${opportunity.id})
      `;
    }
  }
  await appendAudit(won ? "customer_accepted" : "customer_declined", opportunity.companyName, note, "founder");
  return { ok: true };
}

export async function raiseQuoteInvoice(
  opportunityId: string,
  vatTreatment: VatTreatment = "none",
): Promise<{ ok: true } | { ok: false; error: string }> {
  const snapshot = await readSnapshot();
  if (snapshot.company.halted) return { ok: false, error: "Office is halted." };
  const opportunity = snapshot.opportunities.find((item) => item.id === opportunityId);
  if (!opportunity || opportunity.stage !== "won") {
    return { ok: false, error: "Invoice only after you record that the customer accepted." };
  }
  const treatment = parseVatTreatment(vatTreatment);
  const figure = quoteInvoice(opportunity.valueCents, treatment);
  if (!figure.ok) return figure;
  const already = snapshot.ledger.some((row) => row.kind === "invoice" && row.relatedId === opportunity.id);
  if (already) return { ok: false, error: "An invoice is already on the books for this job." };
  const result = await applyProposedAction(
    "ledger",
    {
      kind: "issue_invoice",
      title: `Invoice · ${opportunity.companyName}`,
      rationale: figure.memo,
      confidence: 0.95,
      amountCents: figure.cents,
      companyName: opportunity.companyName,
      relatedId: opportunity.id,
      payload: { vatTreatment: treatment, vatCents: figure.vatCents },
    },
    { source: "ledger-desk" },
  );
  if (result.status !== "executed") return { ok: false, error: "The invoice was not raised." };
  const docId = randomUUID();
  const text = invoiceCopy(opportunity.companyName, figure.cents, documentRef(docId), {
    treatment,
    netCents: figure.netCents,
    vatCents: figure.vatCents,
  });
  const existing = snapshot.documents.some(
    (item) => item.kind === "invoice" && item.relatedId === opportunity.id,
  );
  if (!existing) {
    const sql = await getSql();
    await sql`
      insert into documents (id, title, kind, status, summary, related_id)
      values (
        ${docId},
        ${`Invoice · ${opportunity.companyName}`},
        'invoice',
        'approved_unsent',
        ${text},
        ${opportunity.id}
      )
    `;
  }
  return { ok: true };
}

export async function recordInvoiceReceipt(
  invoiceId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const snapshot = await readSnapshot();
  if (snapshot.company.halted) return { ok: false, error: "Office is halted." };
  const invoice = snapshot.ledger.find((row) => row.id === invoiceId && row.kind === "invoice");
  if (!invoice || invoice.status !== "issued") {
    return { ok: false, error: "That invoice is not awaiting payment." };
  }
  const figure = receiptForInvoice(invoice.amountCents);
  if (!figure.ok) return figure;
  const already = snapshot.ledger.some((row) => row.kind === "receipt" && row.relatedId === invoice.id);
  if (already) return { ok: false, error: "A receipt is already recorded for this invoice." };
  const result = await applyProposedAction(
    "ledger",
    {
      kind: "record_inbound_payment",
      title: `Receipt · ${invoice.counterparty}`,
      rationale: figure.memo,
      confidence: 0.95,
      amountCents: figure.cents,
      companyName: invoice.counterparty,
      relatedId: invoice.id,
      payload: {},
    },
    { source: "ledger-desk" },
  );
  if (result.status !== "executed") return { ok: false, error: "The receipt was not recorded." };
  const sql = await getSql();
  await sql`update ledger_entries set status = 'paid' where id = ${invoice.id} and kind = 'invoice'`;
  const text = receiptCopy(invoice.counterparty, figure.cents, {
    treatment: invoice.vatCents > 0 ? "included" : "none",
    netCents: figure.cents - invoice.vatCents,
    vatCents: invoice.vatCents,
  });
  const haveReceipt = snapshot.documents.some((item) => item.kind === "receipt" && item.relatedId === invoice.id);
  if (!haveReceipt) {
    await sql`
      insert into documents (id, title, kind, status, summary, related_id)
      values (
        ${randomUUID()},
        ${`Receipt · ${invoice.counterparty}`},
        'receipt',
        'recorded',
        ${text},
        ${invoice.id}
      )
    `;
  }
  await appendAudit("payment_received", invoice.counterparty, figure.memo, "founder");
  return { ok: true };
}

export async function setTicketStatus(
  ticketId: string,
  status: "in_progress" | "resolved",
): Promise<{ ok: true } | { ok: false; error: string }> {
  const snapshot = await readSnapshot();
  if (snapshot.company.halted) return { ok: false, error: "Office is halted." };
  const ticket = snapshot.tickets.find((item) => item.id === ticketId);
  if (!ticket) return { ok: false, error: "That ticket is not on the floor." };
  const next = status === "resolved" ? "resolved" : "in_progress";
  const allowed = nextTicketStatus(ticket.status, next);
  if (!allowed.ok) return allowed;
  const sql = await getSql();
  await sql`update tickets set status = ${next}, updated_at = now() where id = ${ticket.id}`;
  const note =
    next === "resolved"
      ? "Founder marked the work resolved. The customer was not emailed."
      : "Founder started the work. The customer was not emailed.";
  await appendAudit(next === "resolved" ? "ticket_resolved" : "ticket_started", ticket.title, note, "founder");
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
  for (const name of BACKUP_TABLES) {
    // Names come from a fixed list in backup.ts, never from user input.
    tables[name] = await sql.query<Record<string, unknown>>(`select * from ${name}`);
  }
  return JSON.stringify(buildBackup(tables));
}
