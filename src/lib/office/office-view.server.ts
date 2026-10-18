/**
 * Read exactly the state the autonomous duties need — no more.
 *
 * `readSnapshot` loads the whole office for the founder's screens. The scheduler
 * runs unattended every few minutes and must not pay for that, so this view
 * issues bounded queries scoped to what duties actually decide on, and carries
 * nothing invented: every field traces to a row.
 */
import { getSql } from "../db";
import { verifyChainLinks } from "./integrity";
import { COMPANY } from "./company";
import type { DutyView } from "./duties";

const LIST_LIMIT = 120;

function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value) return new Date(value).toISOString();
  return new Date(0).toISOString();
}

function text(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function int(value: unknown): number {
  return typeof value === "number" ? value : Number(value ?? 0) || 0;
}

/** Paths the public site actually publishes. Used to check content coverage. */
const PUBLISHED_PATHS = [
  "/",
  "/rates",
  "/work",
  "/support",
  "/terms",
  "/privacy",
  "/services/voip",
  "/services/networking",
  "/services/it-infrastructure",
];

/**
 * @param now reference instant. Defaults to the wall clock. Injectable so a
 * scheduler tick and the planning it drives always agree on "now" — otherwise a
 * duty's cadence and its staleness maths could straddle a minute boundary and
 * disagree about whether work is due.
 */
export async function readDutyView(now: string = new Date().toISOString()): Promise<DutyView> {
  const sql = await getSql();

const [
    companyRow,
    inbound,
    leads,
    opportunities,
    tickets,
    ledger,
    documents,
    approvals,
    agents,
    campaigns,
    siteEvents,
    chatThreads,
    chainRows,
  ] = await Promise.all([
    sql<Record<string, unknown>>`select halted, treasury_cents, receivable_cents, payable_cents, last_audit_hash from company_state where id = ${COMPANY.id}`,
    sql<Record<string, unknown>>`select * from inbound_items where status <> 'filed' order by created_at desc limit ${LIST_LIMIT}`,
    sql<Record<string, unknown>>`select * from leads order by updated_at desc limit ${LIST_LIMIT}`,
    sql<Record<string, unknown>>`select * from opportunities order by updated_at desc limit ${LIST_LIMIT}`,
    sql<Record<string, unknown>>`select * from tickets order by updated_at desc limit ${LIST_LIMIT}`,
    sql<Record<string, unknown>>`select * from ledger_entries order by created_at desc limit ${LIST_LIMIT}`,
    sql<Record<string, unknown>>`select id, title, kind, status, related_id, created_at from documents order by created_at desc limit ${LIST_LIMIT}`,
    sql<Record<string, unknown>>`select id, kind, title, company_name, created_at from approvals where status = 'pending' order by created_at desc limit ${LIST_LIMIT}`,
    sql<Record<string, unknown>>`select id, callsign, status, last_heartbeat from agents order by callsign`,
    sql<Record<string, unknown>>`select * from campaigns order by created_at desc limit ${LIST_LIMIT}`,
    sql<Record<string, unknown>>`select kind, path, occurred_at from site_events where occurred_at > now() - interval '30 days' order by occurred_at desc limit 2000`,
    sql<Record<string, unknown>>`
      select t.id, t.name, t.status, t.updated_at,
             max(m.created_at) as last_message_at,
               count(*) filter (
                 where m.created_at > coalesce(t.updated_at, t.created_at) and m.role = 'customer'
               )::int as unanswered_count
        from chat_threads t
        left join chat_messages m on m.thread_id = t.id
        where t.status = 'open'
        group by t.id
        order by max(m.created_at) desc nulls last
        limit 40
      `,
    // The whole chain, not a window: a fork can hide anywhere. The stored
    // head rides along in the SAME statement on purpose — read separately, a
    // tick committing an append between the two reads made verification fail
    // spuriously while the office was busy, which would have halted the
    // office through SEAL and tripped every health monitor.
    sql<Record<string, unknown>>`
      select chain.id, chain.previous_hash, chain.record_hash, chain.created_at,
             (select last_audit_hash from company_state where id = ${COMPANY.id}) as head_hash
      from (
        select id, previous_hash, record_hash, created_at, kind, 0 as source from audit_events
        union all
        select id, previous_hash, record_hash, created_at, action_kind as kind, 1 as source from decisions
      ) chain
      order by chain.created_at asc
    `,
  ]);

  const company = companyRow[0] ?? {};
  const chain = verifyChainLinks(
    chainRows.map((row) => ({
      id: text(row.id),
      previousHash: text(row.previous_hash),
      recordHash: text(row.record_hash),
      createdAt: iso(row.created_at),
    })),
    text(chainRows.length ? chainRows[0].head_hash : company.last_audit_hash),
  );

  const quoteLinks = await sql<Record<string, unknown>>`
    select distinct on (document_id) document_id, revoked_at, answered_at, expires_at, view_count, created_at, last_viewed_at
    from quote_links
    order by document_id, created_at desc
  `;

  const work = await sql<Record<string, unknown>>`
    select id, agent_id, kind, status, attempts, max_attempts, due_at, last_error
    from work_items
    where status in ('open', 'claimed', 'abandoned')
    order by due_at asc
    limit 200
  `;

  return {
    now,
    halted: company.halted === true,
    inbound: inbound.map((row) => ({
      id: text(row.id),
      channel: text(row.channel),
      companyName: text(row.company_name),
      subject: text(row.subject),
      summary: text(row.summary),
      intent: text(row.intent),
      status: text(row.status),
      createdAt: iso(row.created_at),
    })),
    leads: leads.map((row) => ({
      id: text(row.id),
      companyName: text(row.company_name),
      stage: text(row.stage),
      score: int(row.score),
      summary: text(row.summary),
      inboundId: row.inbound_id ? text(row.inbound_id) : null,
      updatedAt: iso(row.updated_at),
    })),
    opportunities: opportunities.map((row) => ({
      id: text(row.id),
      companyName: text(row.company_name),
      stage: text(row.stage),
      valueCents: int(row.value_cents),
      summary: text(row.summary),
      updatedAt: iso(row.updated_at),
    })),
    quotes: documents
      .filter((row) => text(row.kind) === "quote")
      .map((row) => ({
        id: text(row.id),
        title: text(row.title),
        kind: "quote",
        status: text(row.status),
        relatedId: row.related_id ? text(row.related_id) : null,
        createdAt: iso(row.created_at),
      })),
    tickets: tickets.map((row) => ({
      id: text(row.id),
      title: text(row.title),
      severity: text(row.severity),
      status: text(row.status),
      ownerAgent: text(row.owner_agent),
      summary: text(row.summary),
      relatedId: row.related_id ? text(row.related_id) : null,
      updatedAt: iso(row.updated_at),
    })),
    ledger: ledger.map((row) => ({
      id: text(row.id),
      kind: text(row.kind),
      counterparty: text(row.counterparty),
      amountCents: int(row.amount_cents),
      status: text(row.status),
      relatedId: row.related_id ? text(row.related_id) : null,
      createdAt: iso(row.created_at),
    })),
    documents: documents.map((row) => ({
      id: text(row.id),
      title: text(row.title),
      kind: text(row.kind),
      status: text(row.status),
      relatedId: row.related_id ? text(row.related_id) : null,
      createdAt: iso(row.created_at),
    })),
    campaigns: campaigns.map((row) => ({
      id: text(row.id),
      name: text(row.name),
      channel: text(row.channel),
      status: text(row.status),
      budgetCents: int(row.budget_cents),
      spendCents: int(row.spend_cents),
      summary: text(row.summary),
      createdAt: iso(row.created_at),
    })),
    approvalsPending: approvals.map((row) => ({
      id: text(row.id),
      kind: text(row.kind),
      title: text(row.title),
      companyName: row.company_name ? text(row.company_name) : null,
      createdAt: iso(row.created_at),
    })),
    agents: agents.map((row) => ({
      id: text(row.id),
      callsign: text(row.callsign),
      status: text(row.status),
      lastHeartbeat: row.last_heartbeat ? iso(row.last_heartbeat) : null,
    })),
    siteEvents: siteEvents.map((row) => ({
      kind: text(row.kind),
      path: text(row.path),
      occurredAt: iso(row.occurred_at),
    })),
    chatThreads: chatThreads.map((row) => ({
      id: text(row.id),
      name: text(row.name),
      status: text(row.status),
      updatedAt: iso(row.updated_at),
      lastMessageAt: row.last_message_at ? iso(row.last_message_at) : null,
      unansweredCount: int(row.unanswered_count),
    })),
    quoteLinks: quoteLinks.map((row) => ({
      documentId: text(row.document_id),
      state:
        row.answered_at
          ? "answered"
          : row.revoked_at
            ? "revoked"
            : Date.parse(iso(row.expires_at)) < Date.now()
              ? "expired"
              : "open",
      viewCount: int(row.view_count),
      createdAt: iso(row.created_at),
      lastViewedAt: row.last_viewed_at ? iso(row.last_viewed_at) : null,
    })),
    treasuryCents: int(company.treasury_cents),
    receivableCents: int(company.receivable_cents),
    payableCents: int(company.payable_cents),
    publishedPathCount: PUBLISHED_PATHS.length,
    chainIntact: chain.ok,
    work: work.map((row) => ({
      id: text(row.id),
      agentId: text(row.agent_id),
      kind: text(row.kind),
      status: text(row.status),
      attempts: int(row.attempts),
      maxAttempts: int(row.max_attempts),
      dueAt: iso(row.due_at),
      lastError: row.last_error ? text(row.last_error) : null,
    })),
  };
}

/** Record that an agent did something, so liveness is observable. */
export async function heartbeat(agentId: string, task: string): Promise<void> {
  const sql = await getSql();
  await sql`
    update agents
    set last_heartbeat = now(),
        current_task = ${task.slice(0, 200)},
        status = 'idle'
    where id = ${agentId}
  `;
}

/** Record a real visitor event. Called from public routes; never synthesised. */
export async function recordSiteEvent(input: {
  kind: string;
  path: string;
  referrer?: string | null;
  country?: string | null;
  agentFamily?: string | null;
}): Promise<void> {
  const sql = await getSql();
  await sql`
    insert into site_events (id, kind, path, referrer, country, agent_family)
    values (${crypto.randomUUID()}, ${input.kind.slice(0, 40)}, ${input.path.slice(0, 200)},
            ${input.referrer?.slice(0, 300) ?? null}, ${input.country?.slice(0, 80) ?? null},
            ${input.agentFamily?.slice(0, 120) ?? null})
  `;
}