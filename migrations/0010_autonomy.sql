-- 0010_autonomy.sql
--
-- Two things this migration adds:
--
-- 1. The autonomy runtime. `work_items` is the durable queue every agent works
--    from; `agent_runs` is the execution log the founder inspects. `office_state`
--    is a singleton row holding scheduler bookkeeping (last tick, heartbeat,
--    circuit-breaker counters) so the office can run itself across restarts and
--    across serverless instances without keeping state in memory.
--
-- 2. Indexes for the query patterns the office actually runs. The original
--    schema indexed `(status, created_at desc)` but most reads sort by
--    `created_at desc` with no status filter, and several relationship columns
--    were unindexed, forcing sequential scans on every office page load.
--
-- Every statement is idempotent so this file is safe to re-apply.

-- ── Autonomy runtime ──────────────────────────────────────────────────────────

create table if not exists work_items (
  id text primary key,
  agent_id text not null,
  kind text not null,
  reason text not null,
  -- Free-form routing context: ids, due dates, whatever the duty needs.
  payload_json text not null default '{}',
  priority integer not null default 50,
  status text not null default 'open',
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  last_error text,
  dedupe_key text,
  due_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  outcome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The scheduler's hot path: "open items for this agent, most urgent first".
create index if not exists work_items_ready_idx
  on work_items (agent_id, status, due_at)
  where status = 'open';

create index if not exists work_items_status_idx on work_items (status, due_at);
create index if not exists work_items_created_idx on work_items (created_at desc);

-- A recurring duty must produce at most one open item at a time. Partial unique
-- index is what makes the scheduler idempotent across retries and restarts.
create unique index if not exists work_items_dedupe_idx
  on work_items (dedupe_key)
  where dedupe_key is not null and status = 'open';

create table if not exists agent_runs (
  id text primary key,
  agent_id text not null,
  work_item_id text,
  duty text not null,
  status text not null,
  executed integer not null default 0,
  escalated integer not null default 0,
  blocked integer not null default 0,
  briefing text not null default '',
  detail_json text not null default '{}',
  duration_ms integer not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists agent_runs_agent_idx on agent_runs (agent_id, started_at desc);
create index if not exists agent_runs_started_idx on agent_runs (started_at desc);

-- Scheduler bookkeeping. Exactly one row, id = 'vantage-ars'.
create table if not exists office_state (
  id text primary key,
  last_tick_at timestamptz,
  last_tick_detail text,
  consecutive_failures integer not null default 0,
  halted_reason text,
  -- JSON object of per-duty last-run timestamps, so duties keep their own
  -- cadence instead of all firing on the same tick.
  duty_state_json text not null default '{}',
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Real site traffic that marketing can act on. Nothing here is synthesised:
-- rows are written by the public routes when a real visitor arrives.
create table if not exists site_events (
  id text primary key,
  kind text not null,
  path text not null,
  referrer text,
  country text,
  agent_family text,
  weight integer not null default 1,
  occurred_at timestamptz not null default now()
);

create index if not exists site_events_kind_idx on site_events (kind, occurred_at desc);
create index if not exists site_events_occurred_idx on site_events (occurred_at desc);

-- ── Indexes for real query patterns ───────────────────────────────────────────

-- `readSnapshot` orders every table by created_at desc with no status filter.
create index if not exists inbound_created_idx on inbound_items (created_at desc);
create index if not exists leads_updated_idx on leads (updated_at desc);
create index if not exists opportunities_updated_idx on opportunities (updated_at desc);
create index if not exists campaigns_created_idx on campaigns (created_at desc);
create index if not exists documents_created_idx on documents (created_at desc);
create index if not exists approvals_created_idx on approvals (created_at desc);
create index if not exists notices_created_idx on founder_notices (created_at desc);

-- Relationship lookups. `closeOpportunity`, `raiseQuoteInvoice` and
-- `recordInvoiceReceipt` all resolve records by related_id inside JS loops.
create index if not exists documents_related_idx on documents (related_id);
create index if not exists documents_kind_status_idx on documents (kind, status);
create index if not exists tickets_related_idx on tickets (related_id);
create index if not exists tickets_owner_idx on tickets (owner_agent, status);
create index if not exists ledger_related_idx on ledger_entries (related_id);
create index if not exists ledger_kind_related_idx on ledger_entries (kind, related_id);
create index if not exists leads_inbound_idx on leads (inbound_id);
create index if not exists opportunities_lead_idx on opportunities (lead_id);

-- Case-insensitive company matching backs the ART-12 handoff gate and the
-- invoice gate. Expression indexes let `lower(company_name) = $1` use an index.
create index if not exists opportunities_company_lc_idx
  on opportunities (lower(company_name), stage);
create index if not exists approvals_company_lc_idx
  on approvals (lower(company_name), kind, status);

-- Customer quote links: answering resolves the link by opportunity.
create index if not exists quote_links_opportunity_idx on quote_links (opportunity_id);
create index if not exists quote_links_expires_idx on quote_links (expires_at);

-- Chat: `readChat` filters by thread and orders by time; `listChats` correlated-
-- subqueries the newest message per thread.
create index if not exists chat_messages_thread_idx on chat_messages (thread_id, created_at);
create index if not exists chat_threads_updated_idx on chat_threads (updated_at desc);