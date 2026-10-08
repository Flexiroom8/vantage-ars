create table if not exists company_state (
  id text primary key,
  legal_name text not null,
  trading_name text not null,
  domain text not null,
  jurisdiction text not null,
  timezone text not null,
  currency text not null,
  vat_rate numeric not null,
  author_name text not null,
  author_role text not null,
  constitution_version text not null,
  treasury_cents integer not null default 0,
  receivable_cents integer not null default 0,
  payable_cents integer not null default 0,
  autonomy_level text not null,
  halted boolean not null default false,
  halt_reason text,
  last_audit_hash text not null,
  opened_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists constitution_provisions (
  id text primary key,
  article_id text not null unique,
  title text not null,
  priority integer not null,
  body text not null,
  enforcement text not null,
  machine_checkable boolean not null,
  parameters_json text not null
);

create table if not exists agents (
  id text primary key,
  callsign text not null unique,
  title text not null,
  department text not null,
  spiffe_id text not null unique,
  status text not null,
  autonomy_level text not null,
  summary text not null,
  allowed_actions_json text not null,
  bindings_json text not null,
  authority_json text not null,
  current_task text,
  last_heartbeat timestamptz,
  decisions_count integer not null default 0,
  escalations_count integer not null default 0
);

create table if not exists inbound_items (
  id text primary key,
  channel text not null,
  company_name text not null,
  subject text not null,
  summary text not null,
  intent text not null,
  routed_to text,
  status text not null,
  created_at timestamptz not null default now()
);

create table if not exists leads (
  id text primary key,
  company_name text not null,
  source text not null,
  stage text not null,
  score integer not null default 0,
  summary text not null,
  inbound_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists opportunities (
  id text primary key,
  lead_id text not null,
  company_name text not null,
  stage text not null,
  value_cents integer not null default 0,
  summary text not null,
  handoff_approval_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists campaigns (
  id text primary key,
  name text not null,
  channel text not null,
  status text not null,
  budget_cents integer not null default 0,
  spend_cents integer not null default 0,
  summary text not null,
  created_at timestamptz not null default now()
);

create table if not exists ledger_entries (
  id text primary key,
  kind text not null,
  counterparty text not null,
  amount_cents integer not null,
  vat_cents integer not null default 0,
  status text not null,
  memo text not null,
  related_id text,
  created_at timestamptz not null default now()
);

create table if not exists tickets (
  id text primary key,
  title text not null,
  severity text not null,
  status text not null,
  owner_agent text not null,
  summary text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists documents (
  id text primary key,
  title text not null,
  kind text not null,
  status text not null,
  summary text not null,
  created_at timestamptz not null default now()
);

create table if not exists approvals (
  id text primary key,
  kind text not null,
  title text not null,
  rationale text not null,
  amount_cents integer not null default 0,
  agent_id text not null,
  company_name text,
  status text not null,
  risk_score integer not null default 0,
  constitutional_trace_json text not null,
  action_json text not null,
  resolution_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists decisions (
  id text primary key,
  agent_id text not null,
  action_kind text not null,
  title text not null,
  rationale text not null,
  status text not null,
  confidence numeric not null,
  reversibility text not null,
  amount_cents integer not null default 0,
  constitutional_trace_json text not null,
  observation_json text not null,
  action_json text not null,
  evidence_hash text not null,
  previous_hash text not null,
  record_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists audit_events (
  id text primary key,
  kind text not null,
  title text not null,
  body text not null,
  actor text not null,
  previous_hash text not null,
  record_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists inbound_status_idx on inbound_items (status, created_at desc);
create index if not exists leads_stage_idx on leads (stage, updated_at desc);
create index if not exists opportunities_stage_idx on opportunities (stage, updated_at desc);
create index if not exists approvals_status_idx on approvals (status, created_at desc);
create index if not exists decisions_created_idx on decisions (created_at desc);
create index if not exists audit_created_idx on audit_events (created_at desc);
create index if not exists ledger_created_idx on ledger_entries (created_at desc);
create index if not exists tickets_status_idx on tickets (status, updated_at desc);
