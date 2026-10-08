# VANTAGE — Handoff Guide
**For:** Juan-Louw Greyling (CEO)
**What this is:** Your plain-language guide to running VANTAGE. What to click, when, and what everything means.

---

## The 30-Second Version

1. **Once (setup):** Complete the checklist in Section 1 below — these are the steps only you can do.
2. **Daily at first:** Run `./scripts/run-agents.sh` from the repo root and follow the instructions it prints. This gives you a prompt to paste into Claude Code.
3. **Before each run:** Open `dashboard/index.html` and check the Decision Queue. If there's anything there, deal with it first.
4. **Once a week:** Ask Claude to generate the weekly report, or click "Export & Download" on the dashboard.

That's the whole job. Everything else is automated.

---

## Section 1 — One-Time Setup Checklist

These are the steps no agent can do for you, because they require identity verification, legal agreements, or a bank account.

**Do these in order:**

- [ ] **1. Register a domain** (~$10–15/year)
  - Use: Cloudflare Registrar (cheapest), Namecheap, or Porkbun
  - Name: something that suits Branch A (VoIP / IT / networking audience). Don't overthink it — a clean .com with your name or a relevant keyword works fine.
  - Once registered: update the Cloudflare Pages settings in step 3 to use your domain.

- [ ] **2. Create a GitHub account** (free)
  - URL: https://github.com
  - Create a new private repo (or public — your choice)
  - Push this repo to it: `git remote add origin git@github.com:YOUR_USERNAME/vantage.git && git push -u origin main`

- [ ] **3. Create a Cloudflare account** (free)
  - URL: https://cloudflare.com
  - Add your domain to Cloudflare (point your domain's nameservers to Cloudflare)
  - Create three Cloudflare Pages projects (one per branch) connected to your GitHub repo
  - Set the build output directories:
    - Branch A: `content/branch-a/published`
    - Branch B: `content/branch-b/published`
    - Branch C: `content/branch-c`

- [ ] **4. Create a Google Search Console account** (free)
  - URL: https://search.google.com/search-console
  - Verify each site once it's live on Cloudflare Pages
  - Submit the sitemap for each site (the GitHub Actions publish workflow generates these)

- [ ] **5. Sign up for Paddle** (free to join, ~5% + $0.50 per transaction)
  - URL: https://paddle.com
  - Requires: identity verification, bank account details for payouts
  - Once verified: note your Paddle Vendor ID and add it to `data.json` once Branch C is built
  - South Africa note: Paddle handles VAT/GST automatically for global sales — this is why we use Paddle over Stripe for SA-based sellers.

- [ ] **6. Apply to affiliate networks**
  - **Awin:** https://www.awin.com (accepts SA publishers, strong B2B/SaaS programs)
  - **Impact:** https://impact.com (accepts SA, strong tech/SaaS)
  - **CJ (Commission Junction):** https://www.cj.com (accepts SA)
  - The Scout agent will shortlist specific programs within these networks. You approve and join them via the Decision Queue.
  - Amazon Associates: verify current SA eligibility at https://affiliate-program.amazon.com before applying — policy has changed historically.

- [ ] **7. Configure GitHub Actions secrets**
  Go to your repo → Settings → Secrets and variables → Actions. Add these when you have them:
  - `CF_API_TOKEN` — Cloudflare API token (for Pages deploys)
  - `CF_ACCOUNT_ID` — your Cloudflare account ID
  - `GSC_SERVICE_ACCOUNT_JSON` — for analytics pull (Phase 6)
  - `AWIN_API_KEY`, `IMPACT_API_KEY` — when you join those networks (Phase 6)
  - `PADDLE_API_KEY` — when Branch C is live (Phase 4)

---

## Section 2 — How to Run the Agents (Daily/Regular)

### Step 1: Check the Decision Queue
Open `dashboard/index.html` in your browser (double-click the file or serve it locally).

The Decision Queue is the only section that requires your input. Check it before each run. Items look like:
- "Join affiliate program: Awin / [Program Name]" → you click the link and apply
- "Support reply awaiting approval: [subject]" → you review the draft and send it (or edit it first)
- "Branch B cluster ready to graduate" → you decide whether to invest in a full mini-site

**Clear any pending items before running the agents** — otherwise the agents may duplicate work.

### Step 2: Run the entrypoint script
From the repo root in a terminal:
```bash
./scripts/run-agents.sh
```

Or for specific modes:
```bash
./scripts/run-agents.sh --scout           # Find opportunities only
./scripts/run-agents.sh --writer          # Draft content only
./scripts/run-agents.sh --allocator       # Score branches + update quotas
./scripts/run-agents.sh --report          # Generate CEO report
./scripts/run-agents.sh --branch=A        # Scope to Branch A only
./scripts/run-agents.sh --dry-run         # See what would run, no changes
```

The script will:
1. Show you the current system state
2. Warn you about any Decision Queue items
3. Assemble a prompt file at `scripts/last-prompt.txt`
4. Tell you exactly what to do next

### Step 3: Paste the prompt into Claude Code
The script will print instructions for how to do this. The short version:
- Open Claude Code (your existing subscription — no extra cost)
- Paste the contents of `scripts/last-prompt.txt`
- Claude does the work: drafts content, updates data.json, writes backlog items

### Step 4: Review and commit
After Claude finishes:
1. Skim what it produced (spot-check a draft article, look at data.json changes)
2. Commit and push:
   ```bash
   git add -A
   git commit -m "feat: agent run $(date +%Y-%m-%d)"
   git push
   ```
3. GitHub Actions will automatically publish any articles marked `status: ready`

---

## Section 3 — What Each Dashboard Section Means

### Command Summary
Four numbers at the top:
- **Revenue This Week / This Month / All-Time** — exactly what it says. These are real dollars from affiliate commissions and Paddle payments, as logged by the Accountant agent. They start at $0 and grow slowly — content sites take weeks to rank.
- **Revenue Trend** — a sparkline of the last 8 reporting periods. Flat at first; rising is good.
- **Status line** — one of: "Bootstrapping" (pre-launch), "Stable" (running, not growing fast), "Growing" (things are working), "Needs a decision" (something needs your input).

### Branch Cards (Branch A, B, C)
One card per revenue branch. Each card shows:
- **Status badge** — Active, Growing, Maintenance, or Bootstrapping
- **Metrics** — traffic and revenue for Branch A/B; MRR and user counts for Branch C
- **Quota** — how many articles per week the Allocator has assigned this branch
- **Score** — the Allocator's weekly score (0.0000 to ~0.3000). Higher = healthier.

If a branch shows "Maintenance" — it's been underperforming for 3+ weeks. It's still live; it just gets one article per month to keep it ticking. It can recover.

### Decision Queue
**This is the only section that needs your attention.** Items here are things the agents cannot resolve themselves:
- Affiliate program signup requests (you sign up, agents can't)
- Support reply approvals (you approve, agents draft)
- Branch archival proposals (agents propose, you decide)

When the queue is empty, it says "Nothing in the queue. Nice." — that's the goal state.

### Agent Activity
A log of what each agent did on the last run. Plain language, no jargon. If you're confused about what happened, this is where to look first.

### Report Export
Click "Preview Report" to see the weekly CEO summary in-browser. Click "Export & Download" to get a Markdown file you can email to yourself or archive. This is the same report the Analyst/Reporter agent generates.

---

## Section 4 — Cadence Guide

| When | What to do |
|------|-----------|
| **Every run** | Check Decision Queue → Run agents → Review output → Commit → Push |
| **Weekly** | Run the Allocator (`--allocator`) → Check if any branches changed mode → Read the weekly report |
| **Monthly** | Review the Accountant's financial summary in `docs/financials/` — send to your accountant if needed |
| **Phase 2 (soon)** | Seed Branch A with your real practitioner notes — even 3–5 bullet points per topic is enough for the Writer |
| **As needed** | Clear Decision Queue before each run |

**Recommended cadence to start:** Daily for the first 2 weeks (to build initial content fast), then taper to 3×/week once there's a solid backlog.

---

## Section 5 — What the Agents Cannot Do (Ever)

Just so it's clear in writing:

| Task | Why it requires you |
|------|-------------------|
| Sign up for affiliate programs | Platform requires human identity verification |
| Open/use a bank account | Legal/KYC requirement |
| Verify identity with Paddle | Legal requirement for payment processing |
| Send customer support replies | VANTAGE has a human-in-the-loop rule — reputation risk |
| File taxes or give tax advice | Legal. The Accountant agent prepares numbers; a real accountant files |
| Run themselves on a schedule | The "thinking" agents (Writer, Scout, Allocator) need you to trigger them |
| Guarantee revenue by a date | Honest answer: no one can. Content takes time. |

---

## Section 6 — Troubleshooting

**"The dashboard shows zeros for everything"**
Normal until: (a) sites are live on Cloudflare Pages, (b) Google has indexed them, (c) affiliate programs are joined, (d) the analytics workflow is connected. Zeros are correct at launch.

**"GitHub Actions workflow failed"**
Check the Actions tab in your GitHub repo. The most common cause at launch is missing secrets (CF_API_TOKEN etc.). Add them in Settings → Secrets.

**"A branch went into Maintenance mode"**
Not an emergency. It means the Allocator scored it lowest for 3+ weeks. Check the score — if it's because there's no data yet (early stage), ignore it. If it's because the content isn't performing, focus the Writer on the other branches for a while.

**"I don't understand what Claude wrote"**
Read the activity feed in the dashboard. Or look at the actual files Claude created in `content/`. The agent prompts are in `agents/` — they describe exactly what each agent is supposed to produce.

**"I want to kill a branch"**
Don't delete files. Add an item to the Decision Queue manually in `data.json`:
```json
{
  "id": "dq-manual-001",
  "type": "branch_archive",
  "priority": "low",
  "title": "Archive Branch [X]",
  "body": "CEO-initiated archive request.",
  "requires_approval": true,
  "status": "pending",
  "agent": "ceo"
}
```
Then confirm it next time you run the agents. The Allocator handles the actual wind-down.

---

## Section 7 — File Map (Where Things Live)

```
vantage/
├── agents/               ← Agent role definitions (prompt library)
│   ├── scout.md
│   ├── writer.md
│   ├── seo-aeo-editor.md
│   ├── marketing-social.md
│   ├── affiliate-ops.md
│   ├── product-dev.md
│   ├── support.md
│   ├── accountant.md
│   ├── allocator.md
│   └── analyst-reporter.md
├── content/
│   ├── branch-a/
│   │   ├── backlog/      ← Draft/queued articles for Branch A
│   │   └── published/    ← Live articles, deployed to Cloudflare Pages
│   ├── branch-b/
│   │   ├── clusters/     ← Draft clusters for Branch B
│   │   └── published/    ← Live articles
│   ├── branch-c/         ← Micro-SaaS tool source code
│   └── social/queue/     ← Social post drafts (queued, not sent)
├── dashboard/
│   └── index.html        ← The Bridge (open this in your browser)
├── data/
│   └── data.json         ← The single source of truth for all metrics
├── docs/
│   ├── financials/       ← Monthly financial summaries from Accountant
│   ├── reports/          ← Weekly CEO reports
│   └── setup/            ← Setup guides (analytics, integrations)
├── scripts/
│   ├── run-agents.sh     ← CEO entrypoint — run this to trigger agents
│   └── last-prompt.txt   ← Auto-generated by run-agents.sh
└── .github/workflows/
    ├── publish.yml        ← Auto-publishes ready content on push
    ├── weekly-allocator.yml ← Monday 06:00 UTC: score + quota update
    └── analytics-refresh.yml ← Daily 05:00 UTC: pull analytics (Phase 6)
```

---

*Questions? Open an issue in the repo or run Claude Code with this file as context.*
*Last updated: Phase 1 complete — September 2026*
