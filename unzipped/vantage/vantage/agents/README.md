# Agent Role Library

Each file here is one "employee": a prompt + its slice of the pipeline.
Claude Code loads the relevant file(s) when the CEO triggers a run.

| Role | File | Writes to |
|---|---|---|
| Scout | `scout.md` (+ `scout-branch-b.md` rubric) | `sites/branch-a/backlog.md`, decision queue items |
| Writer | `writer.md` | `sites/*/content/**/*.md` (drafts) |
| SEO/AEO Editor | `seo-editor.md` | drafts + frontmatter/schema |
| Marketing/Social | `marketing.md` | `sites/*/social/queue.md` |
| Affiliate Ops | `affiliate-ops.md` | link map, `data/ledger`, decision queue |
| Product/Dev | `product-dev.md` | `tools/branch-c/` |
| Support | `support.md` | draft replies in decision queue (NEVER auto-send) |
| Accountant | `accountant.md` | `data/ledger` |
| Allocator | `allocator.md` | `data/data.json` (quotas, modes) |
| Analyst/Reporter | `analyst.md` | `data/report-latest.md` |

## Ground rules for every agent

1. Follow the hard rules in `../README.md` (human-in-the-loop, fade-don't-kill, SARS caution).
2. Every action gets a plain-language line appended to `data/data.json` -> `activity_feed`.
3. Anything requiring CEO input becomes a `decision_queue` item - never a silent action.
4. Never invent metrics. If data is missing, say so in the feed.
