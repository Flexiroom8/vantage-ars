# Vantage-ARS workspace: improvement pass (2026-10-05)

Author: Juan-louw Greyling <juanlouw.greyling@gmail.com>

## Applied (from vantage-ars-patch, verified)
- Spoof-proof caller address, rate limiters that prune idle keys, runtime input checks on enquiry, payment notice and chat handlers.
- Whole-word lead routing (no more "sip" in "gossip", "hate" in "Chateau"); added 3CX, VPN, DNS, fibre, NAS, cost, estimate vocabulary.
- AI staff model call: 25 s timeout, one retry on 429/5xx.
- `vatBreakdown()` integer-cent VAT (none, standard, included, zero-rated). Not wired into quotes/invoices yet: the treatment per customer is your decision.
- Non-ASCII email subjects encoded.
- `.gitignore` covers credentials, env files, build output, attachment zips.

## Added in round two
- `ledgerVat()` in `invoice.ts`: the ledger's `issue_invoice` now honours `vatTreatment` (none, standard, included, zero_rated) in integer cents. Missing treatment keeps the old 15% behaviour; "unstated" or unknown values add no VAT. 4 new tests.
- Not changed: `record_expense` and campaign spend still record 15% of the amount. Whether supplier amounts include VAT is an accounting decision for you.

## Test status
66 of 67 office tests pass. `quote-pdf.test.ts` needs `npm install` (pdf-lib) to run.

## Needs you
1. `.grok/gmail-smtp.json` contains a Gmail app password. It is left OUT of the zip. Revoke it in your Google account and create a new one.
2. Capitec account details are hard-coded in `src/lib/office/invoice.ts`; the tests assert them. Say if you want them moved to environment settings.
3. This app calls xAI via `XAI_API_KEY`. The Cloudflare Workers AI version is a separate codebase (v3.0.0 Enhanced).
