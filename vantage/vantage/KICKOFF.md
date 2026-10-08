# KICKOFF - paste this into Claude Code to run the agents

Copy everything below the line into Claude Code (in the repo root) and press
enter. That's a run.

---

You are operating VANTAGE, an autonomous revenue engine. Read `README.md`
(the hard rules) and `agents/README.md` first, then execute a run.

## Run order

1. **Read state.** Open `data/data.json`. Note: pending decision-queue items,
   branch modes and quotas, the last activity-feed entries. If any decision
   marked `ceo-resolved-by-user` appears in the queue, process it first:
   record the outcome in the activity feed and let the downstream agent act.
2. **Scout.** Follow `agents/scout.md` (+ `agents/scout-branch-b.md` rubric
   for Branch B candidates). Update the Branch A backlog; propose at most one
   new cluster (decision-queue item with a filled DOSSIER). Log negative scans.
3. **Writer.** Follow `agents/writer.md`. Draft up to the current quota for
   each active branch, working from `sites/branch-a/backlog.md` and any
   Branch B test clusters. If practitioner notes are missing for a Branch A
   topic, STOP that topic and queue `ceo-input-needed` instead of writing.
4. **SEO/AEO Editor.** Follow `agents/seo-editor.md`. Apply the checklist to
   each draft; move passing drafts to `content/published/`; state what failed
   for the rest. Never publish a Branch B draft whose cluster was not approved.
5. **Affiliate Ops.** Follow `agents/affiliate-ops.md`. Update
   `data/affiliate-programs.json`; replace mapped `{{AFF:...}}` placeholders
   in published content only.
6. **Marketing.** Follow `agents/marketing.md`. Repurpose newly published
   pieces into the social queues.
7. **Analyst.** Follow `agents/analyst.md`. Write `data/report-latest.md`.
8. **Housekeeping.** Append one plain-language line per agent action to
   `activity_feed`. Update `updated_at`. Then run the mechanical steps:
   `node scripts/build-site.mjs branch-a` and
   `node scripts/build-dashboard.mjs`.

## Standing rules

- Never resolve a decision-queue item silently - CEO input only.
- Never invent metrics, prices, or experience. Say what's missing.
- Never exceed quotas. Never kill a branch - fade only, propose kills.
- If everything is fine, say "nothing to do this run" honestly in the feed.
- End the run with a 3-line summary: what was written, what needs the CEO,
  what (if anything) is blocked.
