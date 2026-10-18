# Deploying to Vercel

This takes about twenty minutes and is the last step. Everything else is done and
verified.

## 1. Merge the branch

```sh
git checkout main
git merge opencode/autonomous-office
git push origin main        # this is what triggers the deploy
```

## 2. Set the environment variables

Vercel → your project → **Settings → Environment Variables**. Add each one for
**Production** (and **Preview** if you want previews to behave the same).

### Required — the app will not boot without these

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Your Neon connection string. Keep `?sslmode=require`. |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` — run it, paste the output. |
| `BETTER_AUTH_URL` | `https://www.vantage-ars.co.za` |
| `CRON_SECRET` | `openssl rand -hex 32` — a second, different secret. |

### Required for the office to run by itself

| Variable | Value |
| --- | --- |
| `AUTONOMY` | `on` |

Without `AUTONOMY=on` the app works exactly as before: the office only acts when
you press **Run the floor**. With it on, the scheduler acts every ten minutes.

### Required to reach the office at all

| Variable | Value |
| --- | --- |
| `FOUNDER_EMAIL` | Your email. This is the only account that can open `/office`. |

Sign-up is closed to everyone else, permanently, in code — not by configuration.

### Recommended

| Variable | Why |
| --- | --- |
| `GMAIL_SMTP_USER`, `GMAIL_SMTP_APP_PASSWORD` | Founder notices. Without these the office still works; notices are recorded in the office and read there. `/api/health` will tell you mail is down. |
| `PAYMENT_BANK_NAME`, `PAYMENT_ACCOUNT_NUMBER`, `PAYMENT_BRANCH_CODE`, `PAYMENT_BENEFICIARY`, `PAYMENT_SWIFT` | Bank details on quotes and invoices. All five or none — an incomplete set is treated as "not configured" rather than shown half-filled. |
| `DATABASE_POOL_MAX` | Defaults to 4. Only raise it if Neon says you have connections to spare. |

### Optional — only for the manual "brief an agent" panel

| Variable | Why |
| --- | --- |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` | Workers AI. See `docs/cloudflare-workers-ai.md`. |
| `XAI_API_KEY` | Or xAI instead. |
| `GROK_OAUTH` | Set to `off` unless you want Google/X sign-in buttons. |

**The autonomous duties do not need any of these.** They decide from office
records, not from a language model, which is exactly why they keep working when
the model provider is down.

### One-time, then remove

| Variable | Why |
| --- | --- |
| `FOUNDER_SETUP_TOKEN` | `openssl rand -hex 16`. Needed only to create the founder account. |

1. Deploy with it set.
2. Open `https://www.vantage-ars.co.za/office`.
3. Press **First-time founder setup**. Enter your email, a password of at least
   12 characters, and the token.
4. **Remove `FOUNDER_SETUP_TOKEN` and redeploy.** Sign-up closes itself once the
   account exists, but do not leave a live creation token in production.

## 3. Create the founder account

Do this within a few minutes of step 1, then remove the token.

## 4. Point the domain

Vercel → **Settings → Domains**. Add `vantage-ars.co.za` and `www.vantage-ars.co.za`.

The domain is currently served by a Cloudflare Worker, not by this app. Pointing
it at Vercel means:

- the live site becomes this application, and
- Cloudflare keeps the zone (DNS, caching, TLS) if you proxy it, with DNS set to
  **DNS only** pointing at the Vercel nameservers/records.

Verify the Worker is no longer serving before you delete it, and keep it for a
week.

## 5. Verify the deploy

```sh
# The site is up and the office is provisioned.
curl -s https://www.vantage-ars.co.za/api/health | jq '{ok, database, chain, scheduler}'

# The office is locked to signed-out visitors.
curl -s https://www.vantage-ars.co.za/office | grep -c 'Command centre access'

# The cron endpoint refuses anonymous callers.
curl -s -o /dev/null -w '%{http_code}\n' https://www.vantage-ars.co.za/api/cron/floor   # 401
```

Then, in a browser:

1. Sign in at `/office`. You should see the **Autonomy** panel with
   "Running by itself", 26 duties, and a queue.
2. Press **Run the floor**. It should report what it did.
3. Wait ten minutes and reload. `lastTickAt` should have moved on its own.
4. Watch `GET /api/health` — `scheduler.overdue` must stay `false`.

## 6. Set up monitoring

Point an uptime check at `https://www.vantage-ars.co.za/api/health` and alert on
a non-200. The endpoint returns 503 when the database is unreachable, the audit
chain fails, the scheduler goes stale, or the office is halted — which are the
four conditions where the business is not actually running even though the pages
still render.

## 7. Backups

`/office` → **Governance** → **Audit** → *Download verified backup*. Take one
after the first real deal and then whenever you want a checkpoint.

The export includes live customer quote links, so restoring it does not break an
open quote. Restores are add-only and transactional: they never delete or
overwrite.

## If something goes wrong

**The office is doing something you do not want.** Halt it — the sidebar button,
or `haltOffice` through the office. Nothing plans or executes while halted, and
queued approvals are refused until you resume.

**The office will not start.** Check `/api/health`. `problems` names the cause.
The usual one is a missing or unreachable `DATABASE_URL`, which the app reports
loudly at boot instead of failing later inside a request.

**The scheduler stopped.** `/api/health` reports `scheduler.overdue` and
`consecutiveFailures`. Five consecutive failing ticks trip a circuit breaker and
the office refuses to act until a human looks at it. That is deliberate.