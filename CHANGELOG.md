# Changelog

All notable changes to Vantage-ARS.

## 4.2.0 — 2026-10-18

### Added

**Autonomy.** The office now runs itself. A durable `work_items` queue and a
scheduler give every agent named duties on their own cadence, replacing the
single manual "Run the floor" button.

- 23 duties across all 9 identities. Every agent has at least one; none may act
  outside its owner's role. Full table: `docs/autonomy.md`.
- `src/lib/office/duties.ts` — pure planning. Each duty is a function of real
  office state returning work, or nothing. An empty answer is a successful run.
- `src/lib/office/duty-runners.server.ts` — execution, through the same governor
  as any manual dispatch.
- `src/lib/office/scheduler.server.ts` — the tick. Refuses to run while halted,
  with the database down, with the chain broken, or after five failing ticks.
- `src/lib/office/work-queue.server.ts` — deduped by a partial unique index,
  claimed atomically, bounded retries with backoff.
- `AutonomyPanel` on `/office`: scheduler state, every duty and when it is next
  due, the live queue, and what each agent did last.
- `AUTONOMY=on` + `CRON_SECRET` enable unattended runs. The ten-minute tick is
  scheduled by the `office-scheduler` GitHub Actions workflow (Vercel's Hobby
  plan rejects crons more often than daily); `vercel.json` keeps a daily
  `/api/cron/floor` run as a fallback.

**Sales.** `close_quote_followup` drafts a real follow-up once a genuine quote
has waited two days, and says in the letter whether the customer actually opened
the link. `close_stale_proposal` reports proposals with no movement for fourteen
days. `close_win_handoff` flags a won deal with delivery open and no invoice.
`close_discovery` writes a real discovery checklist against a live opportunity.

**Marketing.** `signal_qualify_leads` scores every lead on what the buyer
actually wrote — demand, support, detail, urgency, organisation — and discards
unsolicited outreach outright. `signal_handoff` files a founder-gated sales
handoff only for genuine buying intent. `signal_site_signals` and
`signal_content_brief` work from real recorded page views.

**Real site signals.** `/api/site-signal` records real page views: path,
referrer, country, client hints. Nothing is synthesised and nothing about the
visitor is identified — a POPIA position, not a preference.

**Health.** `GET /api/health` answers "is the business running?" — database and
schema, audit chain, scheduler freshness, queue, mail delivery, money position.
503 when something that matters is wrong. Signs in for the full picture.

**Verification.** `npm run verify:office` boots a real office on a real embedded
Postgres, files the records the public site would really file, runs the real
scheduler, and asserts on what the real agents did. 70 checks, no mocks, no
sample data. It runs in CI.

### Fixed

**Money could be created from nothing.** `record_inbound_payment` credited
treasury unconditionally and then floored the receivable at zero, so a duplicate
receipt created cash. It now applies only against the outstanding receivable,
under lock, in the same transaction as the ledger row.

**Duplicate invoices and receipts.** The guards read the windowed snapshot
(80 ledger rows, 40 documents) rather than the tables. Past that window they
silently stopped protecting the books. They now query the whole table.

**Double execution on a double-click.** Approval resolution read the row, then
updated it non-conditionally, so two clicks both executed. It now claims the row
with `where status = 'pending' returning id` inside the transaction, and honours
a halt.

**The audit chain could fork.** Decisions and audit events each did their own
read-modify-write of the shared head, with no lock. Both now run in one
transaction under a named advisory lock, reading the head `for update`. The
chain covers the observation and evidence hash too.

**Chain verification walked the wrong way.** The walker treated the newest record
as the start, so a healthy office reported as broken and SEAL halted it. Fixed,
with 10 tests covering forks, gaps, moved heads and hash collisions.

**DML ran on the read path.** `readSnapshot` executed `CREATE TABLE`, three
`ALTER TABLE ... ADD COLUMN` and an unconditional `UPDATE` on every page load —
an ACCESS EXCLUSIVE lock convoy on a pooled Postgres, and a silent overwrite of
any payment note the founder had typed. All moved to migrations and to a one-time
provision step.

**Duty side effects ran before the decision was recorded**, so a throw mid-way
left a ledger entry with no decision and no audit row. Everything is now one
transaction.

**Quotes were grounded in the wrong thing.** The governor checked the amount
against the rate card but let the customer-facing *text* come from agent prose.
The document body is now generated from `QUOTE_SPECS`; extra scope lines are
accepted only if they contain no promise language, no discount and no figure
other than the published one.

**Chat locked itself out.** A 4-second poll is 900 requests/hour against a
120/hour limit, so both chat desks throttled themselves after eight minutes.
Polling now pauses on hidden tabs, backs off when idle, and the founder's desk
uses an authenticated read with its own budget.

**Password reset was unreachable.** `/forgot-password` and `/reset-password`
existed but were missing from the committed route tree, so both the link on the
sign-in door and the link inside the reset email were dead. The tree is
regenerated and CI catches drift.

**Reload loop.** With `VITE_AUTH_ENABLED=false` the sign-in door redirected to
`/office`, which was locked, which rendered the door again. The door now explains
the state and offers the one action that fixes it.

**Halt button and treasury display.** The halt button called `haltOffice()` with
no arguments and always failed; the treasury read a field that does not exist and
always showed R0.00. Both fixed, and halt state is read from the server instead
of local state.

**Opaque references.** A document reference was 8 hex characters — 32 bits, with
birthday collisions around 77k documents. Now 50 bits in an alphabet that
survives being read over the phone.

**Leads carried the agent's words.** Reception filed leads with its own one-line
summary, so marketing scored an agent's optimism rather than what the buyer wrote.
Leads now carry the customer's own text.

**Idle agents were reported as broken.** Liveness flagged any agent without a
recent heartbeat, so a quiet office produced nine alerts a day. It now reports an
agent only when it has work waiting, or has genuinely never run.

**Federated buttons rendered when OAuth was off.** The sign-in door showed Google
and X regardless of `GROK_OAUTH`, offering buttons that could only fail.

**Reset forms.** Mojibake in user-visible strings, no `noindex`, inconsistent
layout, and a required search param that cost a redirect on every load.

### Changed

- `.env.example` now exists. It was referenced by nine places and did not exist.
- `BACKUP_TABLES` includes `quote_links` and the autonomy tables. A restore used
  to silently kill every open customer quote link.
- Restore is transactional and measures bytes, not UTF-16 code units.
- The pool is configured (size, timeouts, TLS) and the Neon boot path fails
  loudly when the schema is missing instead of producing "relation does not exist"
  deep inside a request.
- Migration `0010` adds the autonomy tables and 22 indexes for the queries the
  office actually runs.
- `ensureOffice` runs once per process instead of on every page load.
- Health metrics are derived from rows. `constraintAdherence` was hardcoded to
  `1`, so a blocked action never showed up in the headline number.
- Accessibility: `aria-current` on navigation, a skip link, a labelled dialog,
  textual (not colour-only) agent status, `th` scope, `role="alert"` on chat and
  enquiry errors.

### Removed

- 16 committed `.wrangler` miniflare SQLite artefacts — machine-local state that
  could contain KV/D1/R2 data. Now git-ignored, with a CI check.
- `src/components/office/format.ts`, a stray duplicate with a broken import that
  blocked `tsc`.

### Known limitations

- The autonomy duties decide from office records, not from a language model. That
  is deliberate: it is why they run without `CLOUDFLARE_API_TOKEN`, and why a
  model outage cannot stop the business.
- The model-driven dispatch panel (`/office` → brief an agent) still needs a
  reasoning provider configured.
- On Vercel, `DATABASE_URL` must point at Postgres. PGLite cannot persist in a
  serverless filesystem.