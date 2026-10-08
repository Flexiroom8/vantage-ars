-- Vantage-ARS office workspace schema (PGLite preview / Neon production).
-- Applied by scripts/migrate.mjs and by the dev/preview bootstrap
-- (src/lib/db.ts). Idempotent: re-running is safe.

create table if not exists company_state (
  id text primary key,
  legal_name text not null,
  trading_name text not null,
  domain text not null,
  jurisdiction text not null,
  timezone text not null,
  currency text not null,
  vat_rate numeric not null default 0.15,
  author_name text not null,
  author_role text not null,
  constitution_version text not null,
  treasury_cents bigint not null default 0,
  receivable_cents bigint not null default 0,
  payable_cents bigint not null default 0,
  autonomy_level text not null default 'A3',
  halted boolean not null default false,
  halt_reason text,
  payment_instructions text not null default '',
  last_audit_hash text not null,
  opened_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists constitution_provisions (
  id text primary key,
  article_id text not null,
  title text not null,
  priority integer not null,
  body text not null,
  enforcement text not null,
  machine_checkable boolean not null default false,
  parameters_json text not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists agents (
  id text primary key,
  callsign text not null,
  title text not null,
  department text not null,
  spiffe_id text not null,
  status text not null default 'idle',
  autonomy_level text not null default 'A3',
  summary text not null default '',
  allowed_actions_json text not null default '[]',
  bindings_json text not null default '[]',
  authority_json text not null default '{}',
  current_task text,
  last_heartbeat timestamptz,
  decisions_count integer not null default 0,
  escalations_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists inbound_items (
  id text primary key,
  channel text not null,
  company_name text not null,
  subject text not null,
  summary text not null,
  intent text not null,
  routed_to text,
  status text not null default 'received',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists leads (
  id text primary key,
  company_name text not null,
  source text not null default 'inbound',
  stage text not null default 'engaged',
  score integer not null default 40,
  summary text not null default '',
  inbound_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists opportunities (
  id text primary key,
  lead_id text,
  company_name text not null,
  stage text not null default 'qualified',
  value_cents bigint not null default 0,
  summary text not null default '',
  handoff_approval_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists campaigns (
  id text primary key,
  name text not null,
  channel text not null,
  status text not null default 'planned',
  budget_cents bigint not null default 0,
  spend_cents bigint not null default 0,
  summary text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ledger_entries (
  id text primary key,
  kind text not null,
  counterparty text not null,
  amount_cents bigint not null,
  vat_cents bigint not null default 0,
  status text not null default 'open',
  memo text not null default '',
  related_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tickets (
  id text primary key,
  title text not null,
  severity text not null default 'P2',
  status text not null default 'open',
  owner_agent text,
  summary text not null default '',
  related_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists documents (
  id text primary key,
  title text not null,
  kind text not null,
  status text not null default 'draft',
  summary text not null default '',
  related_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists approvals (
  id text primary key,
  kind text not null,
  title text not null,
  rationale text not null,
  amount_cents bigint not null default 0,
  agent_id text not null,
  company_name text,
  status text not null default 'pending',
  risk_score integer not null default 0,
  constitutional_trace_json text not null default '[]',
  action_json text not null default '{}',
  resolution_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists decisions (
  id text primary key,
  agent_id text not null,
  action_kind text not null,
  title text not null,
  rationale text not null default '',
  status text not null,
  confidence numeric not null default 0,
  reversibility text not null default 'reversible',
  amount_cents bigint not null default 0,
  constitutional_trace_json text not null default '[]',
  observation_json text not null default '{}',
  action_json text not null default '{}',
  evidence_hash text not null default '',
  previous_hash text,
  record_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists audit_events (
  id text primary key,
  kind text not null,
  title text not null,
  body text not null,
  actor text not null,
  previous_hash text,
  record_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists founder_notices (
  id text primary key,
  kind text not null,
  subject text not null,
  status text not null,
  detail text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_leads_inbound on leads(inbound_id);
create index if not exists idx_opportunities_lead on opportunities(lead_id);
create index if not exists idx_approvals_status on approvals(status);
create index if not exists idx_decisions_agent on decisions(agent_id);
create index if not exists idx_tickets_status on tickets(status);
