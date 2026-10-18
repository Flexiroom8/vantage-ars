# Vantage-ARS

The public website and founder-controlled, AI-staffed office for Vantage-ARS
([vantage-ars.co.za](https://vantage-ars.co.za)): VoIP, networking and IT
infrastructure support, South Africa.

Author: Juan-louw Greyling <juanlouw.greyling@gmail.com>

## Stack
- TanStack Start + React 19, Tailwind CSS 4, Vite 8, Nitro 3
- Postgres: Neon (or any Postgres) when `DATABASE_URL` is set, otherwise embedded PGLite
- Better Auth (founder email and password), pdf-lib for quotes, Gmail SMTP for notices
- Nine AI staff, each with a fixed role, working a durable queue on their own cadence

## What is in it
| Area | Routes |
| --- | --- |
| Public site | `/`, `/services/voip`, `/services/networking`, `/services/it-infrastructure`, `/rates`, `/work`, `/support`, `/terms`, `/privacy` |
| Customer quote link | `/q/<token>`: view, download PDF, accept or decline |
| Founder office | `/office`: command, autonomy, approvals, sales, ledger, chat, audit, metrics and more |
| Operations | `/api/health` (liveness), `/api/cron/floor` (scheduled run), `/api/ai/status` |

## The office runs itself

With `AUTONOMY=on` and a `CRON_SECRET`, nine agents work a durable queue every
ten minutes. Each has named duties on their own cadence: reception classifies
enquiries, marketing scores leads on what the buyer actually wrote, flags repeat
site interest as prospects, and drafts weekly owned-channel campaigns, then files
a founder-gated handoff when demand is real; sales drafts real follow-ups on real
quotes, the service desk drafts acknowledgements, technical writes procedures,
finance chases overdue invoices, admin checks the filing, the orchestrator
briefs you once a day from the books, and compliance halts the office if the
audit chain ever fails to verify.

None of them email a customer, spend money, win or lose a customer, or publish
anything. Those are founder approvals, with the constitutional trace attached.

Full detail, including every duty and every brake: **[docs/autonomy.md](docs/autonomy.md)**.

## Run locally

Node 22.12 or newer.
```sh
npm ci
cp .env.example .env      # fill in what you need; everything is optional locally
npm run dev               # http://localhost:8080
npm run validate          # typecheck + lint + tests
npm run verify:office     # boots a real office and proves it runs autonomously
```

`npm run verify:office` is the one that matters. It starts a real embedded
Postgres, files the records the public site would really file, runs the real
scheduler, and asserts on what the real agents did — 67 checks, no mocks and no
sample data. If autonomy breaks, this fails.

## Environment

Everything is in [`.env.example`](.env.example). The ones that matter:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres (Neon). Migrations run during `npm run build`. Unset means embedded PGLite. |
| `PGLITE_DATA_DIR` | With PGLite, keep data here. Unset means in-memory, lost on restart. |
| `BETTER_AUTH_URL` | The public URL. |
| `BETTER_AUTH_SECRET` | A long random secret (`openssl rand -base64 32`). Required in production. |
| `FOUNDER_SETUP_TOKEN` | One-time code for creating the founder account. Remove it afterwards. |
| `FOUNDER_EMAIL` | The only account allowed into the office. |
| `AUTONOMY` | `on` lets the office act unattended. Anything else and only the button works. |
| `CRON_SECRET` | Bearer token the scheduler must present. 16+ characters. |
| `GMAIL_SMTP_USER`, `GMAIL_SMTP_APP_PASSWORD` | Founder notices. |
| `PAYMENT_*` | Bank details on the site and quotes. |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` / `XAI_API_KEY` | AI staff reasoning. Every autonomous duty works without it. |

## Founder setup (once)
1. Set `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, `FOUNDER_SETUP_TOKEN` and, if needed, `FOUNDER_EMAIL`. Deploy.
2. Open `/office`. The page offers "First-time founder setup".
3. Enter the founder email, a password of 12+ characters and the setup token.
4. Remove `FOUNDER_SETUP_TOKEN` and redeploy. Sign-up is closed once a founder exists.

## Deploy
**[docs/deploy-vercel.md](docs/deploy-vercel.md) is the full walkthrough** — the
variables to set, the founder setup, the domain cutover, and how to verify it.

### Vercel + Neon (recommended)
1. Import the GitHub repo in Vercel.
2. Add a Neon database and set `DATABASE_URL`, then the auth settings above.
3. Set `AUTONOMY=on` and a generated `CRON_SECRET`. The ten-minute tick is
   scheduled by the `office-scheduler` GitHub Actions workflow — add the same
   `CRON_SECRET` as a repository secret (Settings → Secrets and variables →
   Actions) so the scheduler call authenticates. `vercel.json` keeps a daily
   run as a fallback (Vercel's Hobby plan rejects crons more often than daily).
4. Deploy. `npm run build` applies migrations.
5. Check `https://www.vantage-ars.co.za/api/health` — `scheduler.overdue` should
   be `false`.

### Docker (any server)
```sh
cp .env.example .env      # set AUTONOMY=on, CRON_SECRET, auth settings
docker compose up -d --build
```

### Plain Node
```sh
npm ci && npm run build && npm start      # .output/server/index.mjs, PORT defaults to 3000
```

## Operations

**Health.** `GET /api/health` answers "is the business running?" — database,
audit chain, scheduler freshness, work queue, mail delivery, and the money
position. It returns 503 when something that matters is wrong, and never exposes
a secret or a customer. Sign in and it returns the full picture.

**Autonomy UI.** `/office` shows the scheduler state, every duty and when it is
next due, the live queue, and what each agent did last. The same panel runs the
office on demand through the identical code path.

**Money.** Amounts are integer cents. A receipt may only retire money actually
owed — the balance update and the ledger row are one transaction that reads the
receivable under lock. A quote's figure is generated from the published rate
card, never from agent prose.

**Audit chain.** Every decision and every event is hash-chained in one
transaction under an advisory lock, so the chain cannot fork. SEAL verifies the
whole chain twice a day and halts the office if it fails. `/office/audit` shows
the result.

**Backup.** `/office/audit` exports every business table as JSON with a SHA-256
checksum, including live customer quote links. Restore is add-only and
transactional: it never deletes or overwrites, and a half-restored office is
impossible.

## CI
`.github/workflows/ci.yml` runs typecheck, lint, tests, a production build and
the office verification on every push to `main` and every pull request.

## Docs
- [docs/autonomy.md](docs/autonomy.md): every duty, every brake, and why.
- [docs/deploy-vercel.md](docs/deploy-vercel.md): environment, cutover, verification.
- [docs/business-scope-and-competitive-pricing.md](docs/business-scope-and-competitive-pricing.md): scope, rates and department boundaries.
- [docs/cloudflare-workers-ai.md](docs/cloudflare-workers-ai.md): account id, API token, per-host env, verification.
- [docs/MERGE.md](docs/MERGE.md): how the earlier projects were combined.
- [CHANGELOG.md](CHANGELOG.md): what changed and when.

## Governance
Agents act only inside their role. Anything that costs money, risks a customer,
or can win one goes to the founder for approval. Every decision is recorded in a
hash-chained audit trail that the office verifies on its own.