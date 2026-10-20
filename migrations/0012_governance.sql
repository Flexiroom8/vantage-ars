-- 0012_governance.sql
--
-- Three tables that turn the office's decisions into a record a regulator, an
-- auditor or the founder themselves can read years later:
--
--   1. `decision_episodes` — the governed precedent memory. One row per
--      Tier 1–3 human ruling, capturing the MATERIAL CONDITIONS the ruling
--      was made under (action kind, company, amount band, stage, policy
--      version) together with the reason for it and what would have changed
--      it. A later decision on the same terms can be compared with what the
--      founder decided before. A precedent is evidence, never authority:
--      nothing in this table can allow an action.
--
--   2. `gate_records` — the POPIA section 71 record. One row when a legal
--      gate is opened, carrying the five questions and their answers
--      verbatim, and another when the human decision on that gate is
--      recorded. The test is kept, not just its result, so the reasoning can
--      be re-read years later without re-running it.
--
--   3. `decision_receipts` — a signed receipt for every Tier 1–3 execution.
--      The receipt names the decision, the authority that allowed it and the
--      chain head it was signed against, and carries an HMAC over its own
--      payload so a tampered receipt can be detected.
--
-- The approvals table gains the columns the section 71 record needs: the
-- founder's pre-exposure reasoning, the reason code, the evidence that was
-- shown, the policy version in force when the case was opened, and the
-- moments the case was exposed and decided.
--
-- Every statement is idempotent so this file is safe to re-apply.

-- ── Governed precedent memory ────────────────────────────────────────────────

create table if not exists decision_episodes (
  id text primary key,
  action_kind text not null,
  company_name text,
  amount_cents integer not null default 0,
  -- The band the amount sat in when the ruling was made. Rulings are compared
  -- on the band, never on the exact cents.
  amount_band text,
  stage text,
  policy_version text,
  -- approved | rejected
  outcome text not null,
  -- A code from the fixed reason-code taxonomy. Never invented at runtime.
  reason_code text not null,
  reasoning text not null,
  -- What would have changed the decision.
  exception_conditions text,
  -- What actually happened afterwards. Written by a later pass, not by the
  -- decision itself.
  later_outcome text,
  decided_at timestamptz not null default now(),
  decision_id text,
  agent_id text
);

-- "What did the founder decide about this kind of action before?"
create index if not exists decision_episodes_kind_idx
  on decision_episodes (action_kind, decided_at desc);
-- "What did the founder decide about this company before?"
create index if not exists decision_episodes_company_idx
  on decision_episodes (lower(company_name));

-- ── The POPIA section 71 record ──────────────────────────────────────────────

create table if not exists gate_records (
  id text primary key,
  approval_id text not null,
  decision_id text,
  -- The five section 71 answers, as written down at the time.
  questions_json text not null default '[]',
  legal boolean not null default false,
  -- The question that failed, if any.
  failed_question text,
  pre_exposure_reasoning text,
  evidence_shown text,
  policy_version text not null,
  -- When the case was exposed, and when the human decided it.
  exposure_at timestamptz,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

-- "What did the gate say about this approval?"
create index if not exists gate_records_approval_idx on gate_records (approval_id);
create index if not exists gate_records_created_idx on gate_records (created_at desc);

-- ── Signed execution receipts ────────────────────────────────────────────────

create table if not exists decision_receipts (
  id text primary key,
  decision_id text not null,
  action_kind text not null,
  amount_cents integer not null default 0,
  risk_tier text not null,
  delegation_id text,
  -- Who authorised it: the founder, or a named delegation.
  approved_by text,
  approval_id text,
  -- The chain head the receipt was signed against, so a receipt can be tied
  -- to the exact state of the audit chain at the moment of execution.
  chain_head text not null,
  payload_json text not null default '{}',
  -- HMAC-SHA256 over payload_json.
  signature text not null,
  signed_at timestamptz not null default now()
);

create index if not exists decision_receipts_decision_idx on decision_receipts (decision_id);
create index if not exists decision_receipts_signed_idx on decision_receipts (signed_at desc);

-- ── Pre-exposure reasoning on the approval itself ────────────────────────────

-- The founder's reasoning for a section 71 decision, written down BEFORE the
-- action reached the outside world. Without these columns the office could
-- not show that the human was in the loop first.
alter table approvals add column if not exists pre_exposure_reasoning text;
alter table approvals add column if not exists pre_exposure_reason_code text;
alter table approvals add column if not exists evidence_shown text;
alter table approvals add column if not exists policy_version text;
alter table approvals add column if not exists exposure_at timestamptz;
-- The moment the founder decided. `resolved_at` is the older column and says
-- the same thing; this one names the governance moment.
alter table approvals add column if not exists decided_at timestamptz;
