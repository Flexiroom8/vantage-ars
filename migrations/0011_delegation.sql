-- 0011_delegation.sql
--
-- Three tables that let the founder hand the office a bounded, revocable
-- authority so the business can earn without a human in the loop:
--
--   1. `delegations` — the standing authority itself. One row. The founder
--      sets the action kinds, the published rate lines, the per-action cap and
--      the daily and monthly caps. It is revoked by setting its status, and it
--      takes effect on the very next action.
--
--   2. `subscriptions` — a customer on a recurring plan. This is the recurring
--      revenue book: a plan, a price, a cycle, and the next billing instant.
--
--   3. `billing_cycles` — one row per billing period of a subscription. The
--      unique index on (subscription_id, period_start) is what makes billing
--      idempotent: a cycle can never be invoiced twice, no matter how many
--      ticks, retries or restarts pass over it.
--
-- `delegation_usage` records every action taken under a delegation, so the
-- caps are counted from real rows rather than from memory, and the founder can
-- see exactly what the office did with the authority they gave it.
--
-- Every statement is idempotent so this file is safe to re-apply.

-- ── Delegated authority ───────────────────────────────────────────────────────

create table if not exists delegations (
  id text primary key,
  label text not null,
  -- active | paused | revoked
  status text not null default 'active',
  -- The most any single delegated action may be worth, in cents.
  max_amount_cents integer not null default 500000,
  max_actions_per_day integer not null default 20,
  max_actions_per_month integer not null default 200,
  -- Action kinds from DELEGATABLE_ACTIONS.
  allowed_actions_json text not null default '[]',
  -- Published rate ids the office may charge under this delegation.
  allowed_rate_ids_json text not null default '[]',
  allow_customer_mail boolean not null default false,
  allow_auto_reconcile boolean not null default false,
  require_accepted_quote boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table if not exists delegation_usage (
  id text primary key,
  delegation_id text not null,
  action_kind text not null,
  amount_cents integer not null default 0,
  company_name text,
  -- YYYY-MM-DD and YYYY-MM, so the caps are counted by calendar, not by
  -- rolling window.
  usage_day text not null,
  usage_month text not null,
  created_at timestamptz not null default now()
);

create index if not exists delegation_usage_day_idx
  on delegation_usage (delegation_id, usage_day);
create index if not exists delegation_usage_month_idx
  on delegation_usage (delegation_id, usage_month);

-- ── Recurring revenue ────────────────────────────────────────────────────────

create table if not exists subscriptions (
  id text primary key,
  company_name text not null,
  contact_name text,
  contact_email text,
  -- The productised service this subscription is for.
  plan_id text not null,
  rate_id text not null,
  -- once | monthly | quarterly
  cycle text not null default 'monthly',
  price_cents integer not null,
  -- active | paused | cancelled
  status text not null default 'active',
  opportunity_id text,
  quote_document_id text,
  started_at timestamptz not null default now(),
  next_billing_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The hot path: "which subscriptions are due to bill, oldest first".
create index if not exists subscriptions_due_idx
  on subscriptions (next_billing_at)
  where status = 'active';
create index if not exists subscriptions_company_idx
  on subscriptions (lower(company_name), status);

create table if not exists billing_cycles (
  id text primary key,
  subscription_id text not null,
  company_name text not null,
  plan_id text not null,
  rate_id text not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  amount_cents integer not null,
  -- pending | invoiced | fulfilled | notified | paid | cancelled
  status text not null default 'pending',
  -- The ledger entry raised for this period.
  invoice_id text,
  -- The customer-facing invoice document.
  document_id text,
  -- The service report produced for this period.
  report_document_id text,
  -- The email that carried the report and the invoice to the customer.
  notice_document_id text,
  created_at timestamptz not null default now(),
  fulfilled_at timestamptz,
  notified_at timestamptz,
  paid_at timestamptz
);

-- One invoice per billing period. This is the guarantee that a retried tick
-- cannot bill the same month twice.
create unique index if not exists billing_cycles_period_idx
  on billing_cycles (subscription_id, period_start);
create index if not exists billing_cycles_status_idx on billing_cycles (status, period_start);
create index if not exists billing_cycles_company_idx
  on billing_cycles (lower(company_name), status);
create index if not exists billing_cycles_subscription_idx
  on billing_cycles (subscription_id, created_at desc);

-- The decisions table records which delegation an action ran under, so the
-- founder can trace any single money movement back to the authority that
-- allowed it.
alter table decisions add column if not exists delegation_id text;
create index if not exists decisions_delegation_idx on decisions (delegation_id, created_at desc);

-- ── Customer notices ─────────────────────────────────────────────────────────

-- Every email the office sends to a customer, in full.
--
-- The office is allowed to email a customer only under a founder delegation,
-- and only from a template written in code. The body is stored here so the
-- office can always answer "what did you actually send them?" — and so a
-- customer notice is as auditable as a ledger entry.
create table if not exists customer_notices (
  id text primary key,
  document_id text,
  subscription_id text,
  cycle_id text,
  company_name text,
  template text not null,
  recipient text not null,
  subject text not null,
  body text not null default '',
  -- approved_unsent | sent | not_delivered
  status text not null default 'approved_unsent',
  detail text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists customer_notices_status_idx
  on customer_notices (status, created_at desc);
create index if not exists customer_notices_company_idx
  on customer_notices (lower(company_name), created_at desc);
create index if not exists customer_notices_cycle_idx on customer_notices (cycle_id);

-- A quote remembers which published rate line it came from, so the office can
-- tell a one-off job from the start of a recurring plan without guessing from
-- the wording.
alter table documents add column if not exists rate_id text;
create index if not exists documents_rate_idx on documents (rate_id);
