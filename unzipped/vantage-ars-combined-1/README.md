# Vantage-ARS office

Founder-controlled, AI-staffed office for Vantage-ARS (vantage-ars.co.za), South Africa.
Author: Juan-louw Greyling <juanlouw.greyling@gmail.com>

Stack: TanStack Start + React 19, Postgres (Neon when `DATABASE_URL` is set, embedded PGLite otherwise), better-auth, pdf-lib for quotes, SMTP for founder notices.

## Run
```sh
npm install
npm run dev        # http://localhost:8080
npm test
npm run typecheck
```

## Environment
| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon Postgres. Unset means local PGLite. |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` | Cloudflare Workers AI for the AI staff (preferred when both are set). Optional `WORKERS_AI_MODEL`. |
| `XAI_API_KEY` | xAI Grok fallback. Force it with `AI_PROVIDER=xai`. With neither provider set, staff report unavailable. |
| `GMAIL_SMTP_USER`, `GMAIL_SMTP_APP_PASSWORD` | Founder notices and customer mail. Environment settings win over the legacy `.grok/gmail-smtp.json` file. |
| `PAYMENT_BANK_NAME`, `PAYMENT_ACCOUNT_NUMBER`, `PAYMENT_BRANCH_CODE`, `PAYMENT_BENEFICIARY`, `PAYMENT_SWIFT` | Bank details on the public site and quotes. Without the first four, pages say details are sent with the quote or invoice. |
| `AUTO_DRAFTS`, `CRON_SECRET` | Daily draft-only run of the front desk. See below. |

Copy `.env.example` as a checklist.

## Public surface
Enquiry form, payment notices and live chat. All three are rate limited per caller, both in memory and in the database (`rate_hits`, migration 0008), and the database check fails open.

## Money
Amounts are integer cents (ZAR). `ledgerVat()` and `vatBreakdown()` in `src/lib/office/invoice.ts` handle none, standard 15%, VAT-included and zero-rated. Customer-facing text never adds VAT unless a treatment says so.

## Rotating the Gmail app password
Only you can do this, in your Google account: Security, 2-Step Verification, App passwords. Delete the old app password, create a new one, put it in `GMAIL_SMTP_APP_PASSWORD` (with `GMAIL_SMTP_USER`) in your host's environment settings, redeploy, then delete `.grok/gmail-smtp.json`. The file is git-ignored and left out of every zip I make.

## Scheduled drafts
`vercel.json` calls `/api/cron/floor` daily at 06:00 UTC (08:00 SAST). It only runs when `AUTO_DRAFTS=on` and the request carries `CRON_SECRET`. It writes follow-up and acknowledgement letters as drafts, starts the free organic campaign and writes technical procedures. It never emails a customer, spends money or quotes. Review and send from the office. Workers AI is not called by this run, so it costs nothing.

## Backup
Governance & audit page: **Download verified backup** exports every business table as JSON with a SHA-256 checksum. It never includes sign-in credentials. It contains customer data, so store it privately. Restore (same page) checks the checksum, refuses anything that is not an office table or has unknown columns, and only adds missing records; it never deletes or overwrites.

## Docs
`docs/business-scope-and-competitive-pricing.md` (scope, rates, department boundaries), `docs/MERGE.md` (what came from where), `legacy/vantage-ars-v3/` (the Cloudflare Worker version, reference only).

## Governance
Agents act only inside their role. Anything that costs money, risks a customer, or can win one goes to the founder for approval. Every decision is recorded in the audit trail.

## Known gaps
See `IMPROVEMENTS.md`.
