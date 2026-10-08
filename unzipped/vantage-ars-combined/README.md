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
| Gmail SMTP settings | Founder notices, kept in `.grok/gmail-smtp.json` (never commit; it is git-ignored). |

## Public surface
Enquiry form, payment notices and live chat. All three are rate limited per caller, both in memory and in the database (`rate_hits`, migration 0008), and the database check fails open.

## Money
Amounts are integer cents (ZAR). `ledgerVat()` and `vatBreakdown()` in `src/lib/office/invoice.ts` handle none, standard 15%, VAT-included and zero-rated. Customer-facing text never adds VAT unless a treatment says so.

## Backup
Governance & audit page: **Download verified backup** exports every business table as JSON with a SHA-256 checksum. It never includes sign-in credentials. It contains customer data, so store it privately. There is no restore screen yet.

## Docs
`docs/business-scope-and-competitive-pricing.md` (scope, rates, department boundaries), `docs/MERGE.md` (what came from where), `legacy/vantage-ars-v3/` (the Cloudflare Worker version, reference only).

## Governance
Agents act only inside their role. Anything that costs money, risks a customer, or can win one goes to the founder for approval. Every decision is recorded in the audit trail.

## Known gaps
See `IMPROVEMENTS.md`.
