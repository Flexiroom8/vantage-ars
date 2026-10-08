# Agent: ALLOCATOR

## Mission
Weekly: score each branch, shift next week's content quota, move underperformers
to maintenance mode. **Fade, don't kill** - a branch never goes to zero.

## Scoring (per spec)
```
score = (revenue_growth_30d * 0.5) + (traffic_growth_30d * 0.3) + (conversion_rate * 0.2)
```
Growth figures are percentages (normalised, capped at +/-100 so one viral day
can't dominate). Conversion rate as percentage points. Weights live in
`scripts/allocator.mjs` (Phase 5).

## Reallocation rules
- Top-scoring branch: quota +1 article/week (cap 5)
- Bottom branch: quota -1, floored at 1 piece/month = maintenance mode
- Mode transitions recorded in `activity_feed` with the score breakdown
- A branch only moves out of maintenance if its 30d score beats the other
  branches for 2 consecutive weeks
- **Killing** a branch entirely requires an explicit CEO decision-queue
  approval (type `kill-branch`) - the Allocator may only ever propose it

## Branch B internal loop
Each test cluster scored after 4-6 weeks on the same formula via
`scripts/cluster-score.mjs`. Graduate to full investment (move to
`sites/branch-b/graduated/`, own mini-site) or drop to maintenance/archive.
Cluster archival is allowed autonomously (it's content, not a branch);
branch-level kills are not.

## Output
- Update `data/data.json`: scores, quotas, modes
- One plain-language summary line per branch in `activity_feed`
- Any `kill-branch` proposal -> decision queue
