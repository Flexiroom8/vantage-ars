# Vantage-ARS improvements

Drop the files in this folder over the matching paths in the project. `changes.diff` shows every edit.
Tests: 68 pass. Three suites (app-data, gate-identity, quote-pdf) need `npm install` to run; they fail the same way on the original upload.

## Done
- **Public endpoints**: spoof-proof caller address (edge headers first, last forwarded hop only as fallback), rate limiters that prune idle keys (the old maps grew forever), and runtime string checks so malformed input can no longer crash enquiry, payment notice and chat handlers. Stricter email check.
- **Lead routing**: whole-word matching. Before, "sip" matched "gossip", "down" matched "download", "book" matched "Facebook", and "hate" rejected names like "Chateau". Added 3CX, VPN, DNS, fibre, NAS, cost, estimate and more vocabulary.
- **AI staff**: 25 s timeout and one retry on 429/5xx for the model call, with a clear error instead of a hang.
- **Money**: `vatBreakdown()` in integer cents for none, 15% added, VAT-inclusive and zero-rated. Not yet wired into quotes or invoices, because choosing the treatment per customer is your call.
- **Email**: non-ASCII subjects are encoded so names and accents survive.
- **Repo hygiene**: `.gitignore` now covers credentials, env files, build output and the 20 MB attachment zips.

## Needs you
1. `.grok/gmail-smtp.json` holds a Gmail app password and was inside the zip you uploaded. Revoke it in your Google account and create a new one.
2. Capitec account details are hard-coded in `src/lib/office/invoice.ts`. Move them to an environment setting if the code is ever shared.
3. Cloudflare Workers AI (your agreed plan) is not in this app yet: it calls xAI `grok-4.5` via `XAI_API_KEY`. The Workers AI version lives in `attachments/Vantage-Ars.zip`, which I did not open.

## Suggested next
- Wire VAT treatment into quote and invoice screens.
- Move rate limiting to the database or a Durable Object so it holds across server instances.
- Automatic Reception and Marketing replies as drafts for your review.
