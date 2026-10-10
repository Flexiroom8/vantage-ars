# Changelog

## 4.1.0 (2026-10-10)

### Sign-in
- Founder email and password sign-in at `/login` and `/office` (Better Auth, 12-character minimum).
- Sign-up is closed. A one-time founder setup needs `FOUNDER_SETUP_TOKEN` (constant-time check) and only works while no founder account exists.
- Rate limits on sign-in and sign-up. Client IP comes from Vercel, Cloudflare or `X-Forwarded-For` headers.
- The founder email comes from `FOUNDER_EMAIL` on the server; the office lock is decided server-side.
- Grok OAuth is optional (`GROK_AUTH_CLIENT_ID` or `GROK_OAUTH`).

### Customer quote links
- The founder creates a private link for a quote on the Sales page (`/office/sales`). The link is shown once, stored only as a hash, and expires after 30 days. It can be replaced or withdrawn.
- The customer opens `/q/<token>` on any device: total, scope, payment details, PDF download, and accept or decline with a name and note.
- Accepting closes the opportunity through the same path as a founder close, notifies the founder and writes an audit event with "customer" as the actor. Links can only be used once, the public endpoints are rate limited, and the page is `noindex` / `no-referrer`.
- Migration `0009_quote_links.sql`.

### Public website
- Service pages: `/services/voip`, `/services/networking`, `/services/it-infrastructure`. Prices, exclusions and FAQs come from the published rate catalogue.
- Canonical URLs, Open Graph and Twitter cards on every public page.
- JSON-LD: ProfessionalService, Service and FAQPage.
- Home service rows and the footer link to the service pages. There is a "Services" item in the navigation.
- Updated `sitemap.xml`. `robots.txt` blocks `/office`, `/login`, `/api/` and `/q/`.
- An app manifest of its own, replacing the Grok sandbox one.

### Platform and cleanup
- Removed the Grok app-builder sandbox tooling (preview, PWA middleware, app-env and brand-check scripts, and Playwright).
- Nitro preset: `vercel` on Vercel, otherwise `node-server` (override with `NITRO_PRESET`). PGLite's runtime files ship with the server bundle.
- `PGLITE_DATA_DIR` keeps embedded-database data on disk.
- `Dockerfile` and `docker-compose.yml` for self-hosting. GitHub Actions CI runs typecheck, lint, tests and build on Node 22.
- Lint errors fixed. `npm test` finds every `*.test.ts` / `*.test.mjs` automatically (182 tests, all passing).
- Fixed the migration-plan test that failed on the original upload.
- Removed `legacy/` from the working tree. The pre-4.1 tree is preserved at git tag `pre-v4-archive`.

## 4.0.x improvement rounds (2026-10-05)

Author: Juan-louw Greyling <juanlouw.greyling@gmail.com>

### Applied (from vantage-ars-patch, verified)
- Spoof-proof caller address, rate limiters that prune idle keys, runtime input checks on enquiry, payment notice and chat handlers.
- Whole-word lead routing (no more "sip" in "gossip", "hate" in "Chateau"); added 3CX, VPN, DNS, fibre, NAS, cost, estimate vocabulary.
- AI staff model call: 25 s timeout, one retry on 429/5xx.
- `vatBreakdown()` integer-cent VAT (none, standard, included, zero-rated). Not wired into quotes/invoices yet: the treatment per customer is your decision.
- Non-ASCII email subjects encoded.
- `.gitignore` covers credentials, env files, build output, attachment zips.

### Added in round two
- `ledgerVat()` in `invoice.ts`: the ledger's `issue_invoice` now honours `vatTreatment` (none, standard, included, zero_rated) in integer cents. Missing treatment keeps the old 15% behaviour; "unstated" or unknown values add no VAT. 4 new tests.
- Not changed: `record_expense` and campaign spend still record 15% of the amount. Whether supplier amounts include VAT is an accounting decision for you.

### Added in round three
- Database-backed rate limiting (`migrations/0008_rate_limits.sql`, `rate-limit.ts`) for enquiries, payment notices and chat. It holds across server instances and restarts, fails open on database errors, and sits behind the existing in-memory limiter. 4 tests with a fake database.
- Security headers in `vercel.json` (nosniff, referrer policy, permissions policy, HSTS). I did not add a CSP or frame blocking, because I can't test them against the Grok preview embed from here.
- `README.md` for the workspace, and tests for `money.ts` and `guard.ts`, all registered in `npm test`.
- Not run here: the new database code has never touched a real database (no `node_modules` or network in my sandbox). Run `npm install && npm test` and one enquiry on preview before deploying.

### Added in round four (final)
- VAT picker on the Ledger screen: each ready-to-invoice job has a VAT treatment selector (none by default, add 15%, quote includes 15%, zero-rated) with a live net / VAT / total preview.
- The invoice bills the gross figure, records the exact VAT in `vat_cents`, and the customer copy and receipt carry the VAT lines. Default is still "no VAT added", so nothing changes unless you choose.
- `raiseInvoice` accepts `vatTreatment`; unknown values become "none". 6 more tests.
- Not verified here: the screen itself (no `node_modules`, so no typecheck or browser run). Run `npm run typecheck` and open /office/ledger on preview.

### Added in round five (merge)
- One project: see `docs/MERGE.md`. The v3 Cloudflare source sits in `legacy/` and is not built.
- Workers AI provider (`ai-provider.ts`): the AI staff use Cloudflare Workers AI when `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` are set, otherwise xAI. Same retry and timeout. 5 tests. The Workers AI call itself is untested: it needs your real credentials.
- Verified JSON backup download on the Audit page (`backup.ts`, 4 tests). No restore yet.
- `robots.txt`, `sitemap.xml`, business scope document in `docs/`.

### Added in round six
- Bank details now come from environment settings (`PAYMENT_*`), not code. Until you set them, the public site and quotes say details are sent with the quote or invoice. The old numbers are gone from the repo and tests.
- Supplier VAT: expenses and campaign spend no longer record an automatic 15%. Input VAT is recorded only when the action says the amount includes it (`vatTreatment: "included"`), because claiming it needs a valid supplier tax invoice. This changes past behaviour on purpose; check with your accountant.
- Backup restore (Audit page): additive only, checksum verified, allow-listed tables and columns. Does not write an audit event or fix the audit head yet.
- Draft-only daily cron `/api/cron/floor` behind `AUTO_DRAFTS=on` and `CRON_SECRET`; `operateFloor({ sendMail: false })`. `.env.example` added.
- Gmail: `smtpCredentialSource()` and rotation steps in the README. I cannot revoke the password for you.
- Not verified here: restore SQL, the cron route and the new public-page loader have never run against a real app or database. `src/routeTree.gen.ts` regenerates on the next `npm run dev` or build.
