# The autonomous office

This is how Vantage-ARS runs itself, and — more importantly — what stops it
doing anything it must not.

## The idea

The office is nine agents with fixed roles and no memory. It does not "decide to
be busy". Instead it keeps its own to-do list in Postgres, and a scheduler that
runs every ten minutes asks each agent a single question: **given what is
actually on the books, is there a real thing worth doing?**

An empty answer is a successful run. Most of the time, the honest answer is that
nothing needed doing, and the office says so rather than manufacturing activity.

```
                 ┌──────────────┐
   GET           │  /api/cron   │  Bearer CRON_SECRET, AUTONOMY=on
   /api/cron ───▶│    /floor    │  every 10 minutes
   /floor        └──────┬───────┘
                        │
                 ┌──────▼───────┐
                 │  refuse to   │  halted?  DB down?  chain broken?
                 │  run blind   │  5 failing ticks in a row?
                 └──────┬───────┘
                        │  no
                 ┌──────▼───────────┐
      26 duties → │      PLAN        │  pure function of the real office state
                 └──────┬───────────┘  returns work, or nothing
                        │
                 ┌──────▼───────────┐
                 │  work_items      │  deduped by a partial unique index
                 │  (the queue)     │  claimed atomically, backoff on failure
                 └──────┬───────────┘
                        │
                 ┌──────▼───────────┐
                 │      EXECUTE     │  every action through the governor
                 └──────┬───────────┘
                        │
                 ┌──────▼───────────┐
                 │  audit chain     │  one transaction, one lock, one head
                 └──────────────────┘
```

## The duties

Twenty-three duties, every agent has at least one, and none of them can act
outside its owner's role.

| Agent | Duty | Cadence | What it does with real records |
|---|---|---|---|
| VANTAGE | `vantage_liveness` | 30m | Reports an agent that has work waiting and is not working, or has never run |
| VANTAGE | `vantage_backlog` | 60m | Reports a stuck queue and anything abandoned after retries |
| VANTAGE | `vantage_briefing` | 24h | One factual daily summary for the founder: books, pipeline, queue, last day's activity — every figure from a record |
| FOYER | `foyer_intake` | 10m | Classifies unrouted enquiries into a lead or a service ticket |
| FOYER | `foyer_stale_intake` | 60m | Escalates an enquiry nobody answered after four hours |
| SIGNAL | `signal_site_signals` | 12h | Reads real recorded page views and says what they mean |
| SIGNAL | `signal_content_brief` | 24h | Briefs the next owned-site piece, or names pages with no traffic |
| SIGNAL | `signal_draft_campaign` | 168h | Drafts one owned-channel campaign per week for nurtured leads not yet in sales. Activation is a founder approval. |
| SIGNAL | `signal_prospect` | 24h | Flags repeat visits to buying pages as a `Prospect ·` lead. No contact is invented. |
| SIGNAL | `signal_qualify_leads` | 3h | Scores every lead on what the buyer actually wrote |
| SIGNAL | `signal_handoff` | 2h | Files a founder-gated sales handoff for genuine buying intent |
| CLOSE | `close_discovery` | 4h | Writes a real discovery checklist against a live opportunity |
| CLOSE | `close_quote_followup` | 12h | Drafts a follow-up once a real quote has waited two days |
| CLOSE | `close_stale_proposal` | 24h | Reports a proposal with no movement for fourteen days |
| CLOSE | `close_win_handoff` | 1h | Flags a won deal with delivery open and no invoice |
| DESK | `desk_acknowledge` | 30m | Drafts an acknowledgement for an unanswered service request |
| DESK | `desk_sla_watch` | 2h | Escalates tickets past their severity's time limit |
| DESK | `desk_chat_reply` | 15m | Drafts a reply to a chat that has been waiting |
| FORGE | `forge_diagnose` | 30m | Writes a procedure against an open fault. Never marks it fixed |
| FORGE | `forge_knowledge` | 24h | Turns a resolved fault's procedure into knowledge-base text |
| LEDGER | `ledger_chase_invoice` | 24h | Drafts a reminder for an invoice unpaid after seven days |
| LEDGER | `ledger_payment_notices` | 2h | Puts an unconfirmed payment notice in front of the founder |
| LEDGER | `ledger_payables` | 24h | Reports money owed out, for the founder to schedule |
| KEEP | `keep_records` | 12h | Reports a won deal with no quote, invoice or receipt filed |
| SEAL | `seal_chain_verify` | 12h | **Halts the office** if the audit chain does not verify |
| SEAL | `seal_scope_audit` | 24h | Reports escalations that suggest an agent is unsure of its role |

## What autonomy is allowed to do

Every duty action goes through the same constitutional governor as a manual
dispatch. The standing boundary:

**Agents may** — file leads, open tickets, write drafts, advance records the
founder has already authorised, score, and file internal briefs.

**Agents may not** — email a customer, spend money, win or lose a customer, issue
an invoice, or publish anything. Each of those is an escalation, and every
escalation is a founder approval with the constitutional trace attached.

Letters to customers are **drafted**, never sent. `scripts/verify-office.mjs`
asserts exactly this.

## What stops it

Five independent brakes, any one of which is sufficient:

1. **Halt.** The founder can halt from the office shell or the API. No duty
   plans anything while halted, and a halted office refuses queued approvals.
2. **Database health.** A tick refuses to run if the database is unreachable or
   the schema is missing, rather than planning work it cannot record.
3. **The audit chain.** SEAL verifies the whole hash chain every twelve hours. A
   failure halts the office and alerts the founder, because an office that cannot
   prove what it did must not keep acting.
4. **A circuit breaker.** Five consecutive failing ticks and the scheduler
   refuses to act again until someone looks.
5. **The governor.** Role separation, published pricing, dignity,
   non-discrimination, confidence floors, and the founder gates on cost, customer
   win, customer loss and marketing-to-sales handoff — applied to every single
   action, autonomous or not.

## Idempotency

The scheduler runs on a timer that retries, on multiple serverless instances,
and can be triggered by hand at the same moment. Three mechanisms make that safe:

- A **partial unique index** on `work_items.dedupe_key where status = 'open'`
  means a recurring duty can never stack two open items for the same record. The
  database rejects the duplicate, not a check-then-insert race.
- Work is **claimed atomically** (`update ... where status = 'open'`), so two
  ticks cannot run the same item.
- Money guards query the **whole table**, never the windowed snapshot the UI
  renders from. The old code checked "is there already an invoice for this
  opportunity?" against the 80 most recent ledger rows, so past 80 rows it
  stopped protecting the books.

`scripts/verify-office.mjs` runs four extra ticks and asserts that no invoice is
booked twice and no quote is duplicated.

## Money

- Amounts are integer cents throughout. No float arithmetic on money.
- A receipt may only retire money that is actually owed. Crediting more than the
  outstanding receivable is impossible, because the balance update and the
  ledger row happen in one transaction that reads the receivable under lock.
- An invoice is bound to a won opportunity. A quote's figure is generated from
  `QUOTE_SPECS`, never from anything an agent wrote.

## Running it

```sh
AUTONOMY=on CRON_SECRET=$(openssl rand -hex 32)   # in the host environment
```

Then either press **Run the floor** on `/office` — the same code path — or wait
for the schedule. `/api/health` reports whether it is actually running:

```sh
curl -s https://www.vantage-ars.co.za/api/health | jq '.scheduler, .problems'
```

## Proving it works

```sh
npm run verify:office
```

This boots the real application modules against a real embedded Postgres, files
the records the public site would really file, runs the real scheduler, and
asserts on what the real agents actually did — 67 checks, no mocks, no fixtures.