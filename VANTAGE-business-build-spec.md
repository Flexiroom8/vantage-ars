# VANTAGE — Autonomous Revenue Engine
### Build Specification for Coding Agent

**Owner / CEO:** Juan-Louw Greyling
**Prepared:** September 2026
**Purpose of this document:** Hand this entire file to a coding agent (e.g. Claude Code) as the build brief. It explains what to build, why, in what order, and what only a human can do.

---

## 0. Read This First — Ground Truth

Before any code is written, three things have to be true, because they determine every design decision below:

1. **Nothing here can be 100% unattended AND 100% free forever.** An AI agent that runs on a schedule with zero human input either (a) costs money per run (API billing), or (b) needs a human to press "run" occasionally. This spec picks option (b): the CEO triggers a run (via Claude Code, using his existing Claude subscription — no extra per-token cost) on a cadence — daily at first, tapering to a couple of times a week once things are running smoothly. That is the honest zero-cost path. Everything else — hosting, tools, storage — is genuinely free-tier.
2. **A domain name costs money.** ~$10–15/year, paid once a year, via ICANN registration. There is no way around this if the business is going to look credible or be trusted by search engines. This is the one unavoidable cost.
3. **A handful of steps legally require a human**, once, at setup: opening/using a bank account, verifying identity with a payment processor, and signing up for affiliate programs. The agents cannot do these — no AI system can, anywhere, for legal reasons. These are listed in full in Section 7 so the coding agent can build the system around them, not pretend they don't exist.

Everything else described below can run with zero incremental spend, using free tiers of real infrastructure.

---

## 1. Business Model — Three Branches, One Engine

VANTAGE is not one business — it's a portfolio of three revenue branches sharing one operating system (agents, dashboard, reporting, resource allocator). Capacity flows toward whichever branch is working; underperforming branches are throttled to "maintenance mode," not deleted, so they can be revived if conditions change.

### Branch A — Authority Niche (the unfair advantage)
A content + affiliate site in Juan-Louw's real domain of expertise: **VoIP/telecoms, networking hardware, and IT infrastructure/ITSM tooling** (ServiceNow-adjacent). This branch is seeded with real practitioner opinions and notes (even a few bullet points per month from Juan-Louw), because that first-hand experience is exactly what generic AI-content competitors can't fake in 2026's AI-saturated search landscape. Monetized via affiliate commissions on hardware, hosting, VoIP platforms, and B2B SaaS tools in this space.

### Branch B — Opportunistic Affiliate Engine
A general-purpose content engine that is NOT locked to one niche. A "Scout" agent continuously scans trending topics, underserved keywords, and emerging affiliate programs across any niche, and spins up small test content clusters wherever there's real opportunity (search demand with low competition + a live affiliate program). Winners graduate into their own mini-sites; losers are archived. This is the "whatever becomes available" branch.

### Branch C — Micro-SaaS
One small, genuinely useful web tool (a calculator, converter, generator, or checker relevant to the Branch A audience — e.g. a VoIP bandwidth calculator, a subnet calculator, an uptime/SLA calculator) built once, hosted free, monetized via a small one-time or subscription upgrade (Stripe/Paddle) for a "pro" version, plus contextual affiliate placements. Requires the least ongoing agent effort once built — closest to true passive income.

### The Allocator
A fourth "meta-agent" that doesn't produce content — it watches performance (traffic, clicks, conversions, revenue) across all branches weekly and reallocates the content/effort quota accordingly. Rules in Section 5.

---

## 2. Org Chart — Agent Roles

Think of this as the company Juan-Louw is CEO of. Each "employee" is a defined AI agent role (a prompt + tools + a slice of the pipeline), not a separate product.

| Role | Function |
|---|---|
| **Scout** | Finds opportunities: trending keywords, low-competition niches, new affiliate programs, what's working for competitors. Feeds Branch B and refreshes Branch A topic backlog. |
| **Writer** | Drafts articles, reviews, and comparisons per branch. For Branch A, writes from the seeded practitioner notes/POV, not generic AI tone. |
| **SEO/AEO Editor** | Adds structure, schema markup, internal links; optimizes for both classic search and AI answer engines (ChatGPT/Gemini/Perplexity citations) — this matters as much as Google ranking now. |
| **Marketing/Social** | Repurposes published pieces into social posts (X, LinkedIn, Reddit where relevant, Pinterest for niche visuals) via free-tier scheduling. |
| **Affiliate Ops** | Manages affiliate link insertion, tracks which programs are joined, flags new programs Scout finds for the CEO to approve/sign up for. |
| **Product/Dev** | Builds and maintains the Branch C micro-SaaS tool. |
| **Support** | Drafts replies to any SaaS user emails/support tickets using templates + context, queues them for a one-tap approval rather than auto-sending (keeps a human in the loop for anything customer-facing). |
| **Accountant** | Logs revenue and costs per branch into a simple ledger; flags South African tax-year (SARS) considerations for the CEO's own accountant to review — this agent prepares numbers, it does not file taxes. |
| **Allocator** | Weekly: scores each branch, shifts next week's content quota accordingly, moves underperformers to maintenance mode. |
| **Analyst/Reporter** | Compiles the CEO's report — see Section 6. |

---

## 3. Tech Stack (all free-tier)

- **Hosting:** Cloudflare Pages (static sites, unlimited free-tier bandwidth) for all three branches
- **Compute/scheduling:** GitHub Actions (2,000 free minutes/month) — runs whichever agent steps CAN run unattended (publishing already-drafted content, refreshing the dashboard, pulling analytics)
- **The "thinking" runs:** triggered by the CEO via Claude Code on his machine, using his existing Claude access — this is where Scout/Writer/Allocator actually reason and produce drafts. Claude Code writes files to the repo; GitHub Actions handles the mechanical publishing after.
- **Content storage:** Markdown files in a GitHub repo (free, versioned, simple)
- **Micro-SaaS backend:** Cloudflare Workers (100k free requests/day) — enough for a calculator-style tool
- **Payments:** Paddle (handles global tax/VAT automatically, good fit selling from South Africa to a global audience) — requires one-time human KYC signup
- **Analytics:** Google Search Console (free) + Cloudflare Web Analytics (free, privacy-friendly, no cookie banner needed)
- **Ledger/dashboard data:** a single `data.json` (or Google Sheet, free) that agents update and the dashboard reads
- **Social scheduling:** native free-tier posting APIs, or Buffer free plan (3 channels)
- **Affiliate networks:** Awin, Impact, CJ, and direct SaaS affiliate programs — these accept South African affiliates. (Flag: Amazon Associates has historically been awkward to join directly from South Africa — Scout should verify current eligibility before recommending it, and prioritize Awin/Impact/CJ/direct SaaS programs instead.)

---

## 4. Dashboard — "The Bridge"

A single self-contained HTML file (cyberpunk aesthetic, Orbitron/JetBrains Mono/Share Tech Mono typefaces, dark theme with neon accents), reading live data from `data.json`. This is the one thing Juan-Louw actually opens.

**Sections:**
1. **Command summary** — total revenue (this week / this month / all-time), trend line, one-line status ("Growing", "Stable", "Needs a decision")
2. **Branch cards** — one card per branch: status badge (Active/Growing/Maintenance), key metrics (traffic, clicks, conversions, revenue), current content quota
3. **Decision queue** — the only place requiring CEO input: new affiliate programs Scout wants to join, support replies awaiting approval, any Allocator recommendation to kill (not just fade) a branch
4. **Activity feed** — what each agent did on the last run, in plain language, no jargon
5. **Report export** — one button to generate a plain-language weekly summary (see Section 6)

---

## 5. Allocator Logic — the "fade, don't kill" rule

Weekly, per branch:
```
score = (revenue_growth_30d * 0.5) + (traffic_growth_30d * 0.3) + (conversion_rate * 0.2)
```
- Top-scoring branch(es): content quota increases (more articles/week)
- Bottom-scoring branch: quota drops toward a floor (e.g. 1 piece/month — "maintenance mode"), never zero, so it can recover if conditions change
- A branch stays live indefinitely at maintenance level; it is only fully archived if the CEO explicitly approves it in the Decision Queue
- Branch B (opportunistic) runs its own internal version of this: each test niche cluster gets scored after 4–6 weeks and either graduates to full investment or drops to maintenance

---

## 6. The CEO Report

Delivered as a short plain-language summary (email via a free-tier sender like Resend, or just the dashboard export button), on whatever cadence Juan-Louw sets (weekly is recommended to start):

- Total revenue and where it came from
- What changed since last report (up/down, why)
- What each branch's agents did
- What's in the Decision Queue and needs his input
- One honest line on outlook — no inflated projections

---

## 7. Human-Required Steps (one-time setup checklist)

These cannot be delegated to an agent, by law or by platform design:

1. Register a domain (~$10–15/year)
2. Create/use a bank account to receive payouts
3. Sign up for Paddle (or Stripe) — identity verification required
4. Apply to Awin, Impact, CJ, and relevant direct SaaS affiliate programs (Scout will shortlist which ones fit; Juan-Louw clicks "apply")
5. Create free accounts: GitHub, Cloudflare, Google Search Console
6. Periodically run Claude Code to trigger the "thinking" agents (daily at launch, then a few times a week)
7. Check the Decision Queue on the dashboard before each run

---

## 8. Build Order for the Coding Agent

**Phase 1 — Skeleton:** GitHub repo structure, GitHub Actions workflow files, agent prompt library (one file per role in Section 2), empty dashboard shell reading a stub `data.json`.

**Phase 2 — Branch A pipeline:** topic backlog seeded from Juan-Louw's real notes, Writer + SEO/AEO Editor pipeline, Cloudflare Pages deploy.

**Phase 3 — Branch B pipeline:** Scout's opportunity-scanning logic, lightweight site-generation template reusable per test niche.

**Phase 4 — Branch C:** pick and build the micro-SaaS tool, Cloudflare Worker backend, Paddle checkout integration.

**Phase 5 — Allocator + ledger:** scoring logic, `data.json` schema, weekly reallocation job.

**Phase 6 — Dashboard + report:** wire live data in, build the Decision Queue and report export.

**Phase 7 — Handoff doc:** a plain-language "how to run this" guide for Juan-Louw — what to click, when, and what each dashboard section means.

---

## 9. What This Will NOT Do

To keep expectations honest, in writing, for whoever builds this:

- It will not generate meaningful revenue in week one — content businesses take weeks to months to be trusted by search engines
- It will not run with literally zero human touch — someone has to trigger the thinking-agent runs and clear the Decision Queue
- It will not replace the need for a real accountant come tax season — the Accountant agent prepares numbers, not filings
- It should never auto-send customer-facing replies without a human tap of approval, to avoid reputational risk
