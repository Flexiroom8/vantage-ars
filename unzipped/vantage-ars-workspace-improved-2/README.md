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
| `XAI_API_KEY` | Reasoning model for AI staff. Unset means staff report unavailable. |
| Gmail SMTP settings | Founder notices, kept in `.grok/gmail-smtp.json` (never commit; it is git-ignored). |

## Public surface
Enquiry form, payment notices and live chat. All three are rate limited per caller, both in memory and in the database (`rate_hits`, migration 0008), and the database check fails open.

## Money
Amounts are integer cents (ZAR). `ledgerVat()` and `vatBreakdown()` in `src/lib/office/invoice.ts` handle none, standard 15%, VAT-included and zero-rated. Customer-facing text never adds VAT unless a treatment says so.

## Governance
Agents act only inside their role. Anything that costs money, risks a customer, or can win one goes to the founder for approval. Every decision is recorded in the audit trail.

## Known gaps
See `IMPROVEMENTS.md`.
