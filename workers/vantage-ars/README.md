# vantage-ars Worker

Cloudflare Worker serving **vantage-ars.co.za** — a content site with a
Workers AI writer and a human-in-the-loop admin queue.

- `src/worker.production.js` — the deployed Worker (routes, AI calls, admin,
  rendering, plus the `AgentTaskWorkflow` class); this is `main` in `wrangler.toml`
- `src/worker.js` — the `AgentTaskWorkflow` class alone; not deployable and not
  imported by `wrangler.toml` (the Durable Workflow entry needs its own module)
- `wrangler.toml` — bindings: D1 `vantage-data`, Workers AI, Durable Workflow,
  cron `0 7 * * 1` + `*/15 * * * *`, custom domains
  `vantage-ars.co.za` + `www.vantage-ars.co.za`, and `VERCEL_ORIGIN`
- `schema.sql` / `seed.sql` — idempotent D1 schema + starter backlog

## Deploy

Automatic: pushing changes under `workers/vantage-ars/**` to `main` runs
`.github/workflows/deploy-vantage-ars.yml`, which applies the schema/seed to
the remote D1 and deploys the Worker. Requires repo secret
`CLOUDFLARE_API_TOKEN` (scoped to Workers Scripts Edit + D1 Edit). The account
ID lives in `wrangler.toml`.

Manual:

```bash
cd workers/vantage-ars
npx wrangler@4 d1 execute vantage-data --remote --file=schema.sql --yes
npx wrangler@4 d1 execute vantage-data --remote --file=seed.sql --yes
npx wrangler@4 deploy
```

## Fallback to the Vercel app

The Worker owns the content site, admin queue, AI writer and the `/api/*`
routes it implements. Every other path (services, rates, legal pages, office,
auth, quotes, ...) is proxied to `VERCEL_ORIGIN` (default
`https://vercel.vantage-ars.co.za`), so the content site and the Vercel app
can coexist on the custom domains instead of one replacing the other.
`VERCEL_ORIGIN` is a Worker variable in `wrangler.toml`; override it there if
the Vercel deployment lives elsewhere.

## Admin

`https://vantage-ars.co.za/admin?t=<ADMIN_TOKEN>` — approvals, edits,
corrections, weekly report (`/admin/report`), and a manual writer run
(`/admin/run`). `ADMIN_TOKEN` is a Worker secret (set once; persists across
deploys).
