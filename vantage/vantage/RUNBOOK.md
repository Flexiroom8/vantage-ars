# VANTAGE RUNBOOK - How to Run This Thing

Plain language. No jargon. This is the only document you need open day-to-day.

---

## The 60-second version

1. Open **the Bridge** (dashboard URL) and look at the **Decision Queue**
2. Do whatever it asks (usually: apply to an affiliate program, approve a reply,
   or pick a direction)
3. Open Claude Code in the repo and type: **"Run the agents"**
4. Done for today. Come back tomorrow (or twice a week once things hum)

Everything else is automatic: publishing, scoring, reallocation, the ledger.

---

## One-time human setup (you, once - no agent can do these)

| # | What | Where | Why |
|---|---|---|---|
| 1 | Register the domain (~$10-15/yr) | any ICANN registrar | the only unavoidable cost; credibility + email deliverability |
| 2 | Create GitHub repo, push this code | github.com | free; the whole machine runs from it |
| 3 | Connect Cloudflare Pages (3 projects: branch-a site, flagship calculator, dashboard) | dash.cloudflare.com -> Pages -> connect git | free hosting, unlimited bandwidth |
| 4 | Verify Google Search Console for the domain | search.google.com/search-console | free traffic data; required for the analytics pull |
| 5 | Create the GSC service account + GitHub secrets (`GSC_JSON_KEY`, `GSC_SITE_BRANCH_A`; optional `CF_API_TOKEN`/`CF_ACCOUNT_ID`/`CF_SITE_TAG`) | cloud.google.com + repo settings -> secrets -> Actions | lets the weekly job pull real numbers |
| 6 | Open the bank account for payouts | your bank | money has to land somewhere |
| 7 | Sign up for Paddle (KYC) | paddle.com | only when Branch C's Pro tier goes live - can wait |
| 8 | Apply to affiliate programs when Scout shortlists them | Awin / Impact / CJ / direct | agents shortlist; you click apply |

After #1: update `sites/branch-a/site.json` (and each cluster's site.json)
with the real domain, and the Pages custom domains.

---

## Your daily/weekly rhythm

**Each run (Claude Code):** type "Run the agents". Claude reads
`agents/*.md`, executes the roles that have work, writes drafts/updates,
and appends what it did to the activity feed. Anything needing you becomes
a Decision Queue item - nothing important happens silently.

**Weekly (automatic, Monday 06:00 UTC):** GitHub Actions pulls analytics
(if secrets wired), scores clusters, runs the Allocator, commits the data.
The dashboard is current when you open it.

**Weekly (you, 5 minutes):** open the dashboard, read the report
(`data/report-latest.md` or the Export button), clear the Decision Queue.

**Monthly-ish:** paste practitioner notes into `sites/branch-a/notes/` -
even 5 rough bullets per topic. This is Branch A's unfair advantage; without
it, the Writer queues `ceo-input-needed` items instead of writing.

---

## What each dashboard section means

- **Command summary** - money in, this week/month/all-time, plus how many
  decisions are waiting. "Status" line is the honest one-liner (Growing /
  Stable / Needs a decision)
- **Branch cards** - one per business. Badge = mode (ACTIVE = full quota,
  MAINTENANCE = 1 piece/month floor, never zero). Score = the Allocator's
  weekly number (revenue growth 50%, traffic growth 30%, conversion rate 20%)
- **Decision queue** - the ONLY thing that needs you. Each item names the
  one action. Empty queue = good week
- **Activity feed** - what each agent did on the last run, in plain language

## What the agents will never do (by design)

- Send anything customer-facing without your one-tap approval
- Sign you up for anything (affiliate programs, Paddle, domains)
- Kill a branch - they fade it to maintenance and propose; you decide
- File anything with SARS - the Accountant prepares numbers for *your* accountant
- Charge anyone money - Paddle stays sandbox until you flip it to live

## Honest expectations

- Week 1-4: near-zero traffic is normal. Search trust takes weeks to months
- Branch B clusters get judged at week 4-6, not before
- If everything is flat for 6+ weeks, the honest move is the Decision Queue
  says so - the system will not flatter you

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Dashboard shows "NO DATA" | data.json missing next to index.html - rerun `node scripts/build-dashboard.mjs` |
| Analytics feed says "secrets not wired" | do setup step 5 above |
| A draft sits in `drafts/` forever | it's blocked on your practitioner notes - check the Decision Queue |
| Nothing published after a run | check the SEO/AEO Editor checklist failed on what (it says in the activity feed) |
| Weekly job didn't run | GitHub -> Actions -> weekly -> run manually (workflow_dispatch is enabled) |

---

## The exact run prompt

`KICKOFF.md` contains the paste-into-Claude-Code prompt that runs the agents.
Daily habit: open the repo, paste it, read the 3-line summary. That's it.
