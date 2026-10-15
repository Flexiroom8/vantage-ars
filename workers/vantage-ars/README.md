# vantage-ars Worker

Cloudflare Worker serving **vantage-ars.co.za** — a content site with a
Workers AI writer and a human-in-the-loop admin queue.

- `src/worker.js` — the Worker (routes, AI calls, admin, rendering)
- `wrangler.toml` — bindings: D1 `vantage-data`, Workers AI, cron `0 7 * * 1`,
  custom domains `vantage-ars.co.za` + `www.vantage-ars.co.za`
- `schema.sql` / `seed.sql` — idempotent D1 schema + starter backlog

## Deploy

Automatic: pushing changes under `workers/vantage-ars/**` to `main` runs
`.github/workflows/deploy-vantage-ars.yml`, which applies the schema/seed to
the remote D1 and deploys the Worker. Requires repo secrets
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

Manual:

```bash
cd workers/vantage-ars
npx wrangler@4 d1 execute vantage-data --remote --file=schema.sql --yes
npx wrangler@4 d1 execute vantage-data --remote --file=seed.sql --yes
npx wrangler@4 deploy
```

## Admin

`https://vantage-ars.co.za/admin?t=<ADMIN_TOKEN>` — approvals, edits,
corrections, weekly report (`/admin/report`), and a manual writer run
(`/admin/run`). `ADMIN_TOKEN` is a Worker secret (set once; persists across
deploys).
