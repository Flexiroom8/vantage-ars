# VANTAGE - Autonomous Revenue Engine

Three revenue branches, one engine. This repo is the machine.

## Layout

```
agents/            One prompt file per agent role (Scout, Writer, Editor, ...)
dashboard/         "The Bridge" - self-contained HTML dashboard
data/data.json     Single source of truth: metrics, ledger, decision queue, quotas
sites/branch-a/    Authority niche: VoIP / networking / ITSM (static, Cloudflare Pages)
sites/branch-b/    Opportunistic affiliate clusters (TEMPLATE + live clusters)
tools/branch-c/    Micro-SaaS: three calculator candidates + Paddle worker
scripts/           Dependency-free build / scaffold / scoring scripts (Node 18+)
.github/workflows/ Unattended mechanical jobs (publish, allocator)
```

## How a run works

1. **Thinking (human-triggered, free):** CEO runs Claude Code in this repo.
   Claude reads the relevant files in `agents/`, does the reasoning, and writes
   drafts/changes to the repo. Daily at launch, then a few times a week.
2. **Mechanical (unattended, free):** GitHub Actions publishes committed
   drafts to Cloudflare Pages, refreshes `data/data.json` from analytics,
   and runs the Allocator scoring job weekly.

## Hard rules (from the spec)

- Never auto-send customer-facing replies - support drafts queue for one-tap approval.
- Fade, don't kill: underperforming branches drop to maintenance quota, never zero.
- The Accountant agent prepares numbers; it never files anything with SARS.
- Amazon Associates: verify current South African eligibility before recommending;
  prioritise Awin / Impact / CJ / direct SaaS programs.
