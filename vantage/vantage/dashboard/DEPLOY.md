# Phase 6 - Dashboard Deploy & Live Wiring

## What the CEO opens
The Bridge is a single static page. Deploy it once and it stays current on
every push - it fetches `data.json` live at load time.

## Deploy (free, one-time)
1. Cloudflare Pages -> new project -> point at this repo
2. Build command: `node scripts/build-dashboard.mjs`
3. Output dir: `dashboard/dist`
4. Every push to `main` re-publishes with the latest `data/data.json`.

`scripts/build-dashboard.mjs` copies `index.html` + the latest `data/data.json`
into `dashboard/dist/` (browsers require same-folder fetch).

## Decision Queue - how decisions get made
Agents never resolve CEO decisions silently. The flow:
1. Agent appends an item to `data/data.json` -> `decision_queue` (status `pending`)
2. CEO sees it on the dashboard
3. CEO acts (applies to the affiliate program, answers the support ticket,
   approves/edits a cluster or kill proposal)
4. CEO tells Claude Code what they did - Claude flips the item to `resolved`,
   records the outcome in `activity_feed`, and downstream agents proceed
   (e.g. Affiliate Ops can now insert links for the approved program)

## Weekly report
- Every run, the Analyst writes `data/report-latest.md`
- The dashboard "Export weekly report" button generates a .txt from live data
- Optional email (Resend free tier, 100/day): add `RESEND_API_KEY` + `CEO_EMAIL`
  as GH secrets and the weekly Actions job emails the report - wired in
  `weekly.yml` once the CEO asks for it (kept off by default: fewer accounts,
  fewer keys, and email can wait until revenue exists)

## Status line rules
`status_line` in data.json is plain language: "Growing", "Stable",
"Needs a decision", or an honest bootstrap message. The Allocator updates it
weekly; no spin - if revenue is flat, it says flat.
