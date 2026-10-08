#!/usr/bin/env node
/**
 * Weekly branch Allocator - Phase 5. Scores each branch on
 *   revenue_growth_30d * 0.5 + traffic_growth_30d * 0.3 + conversion_rate * 0.2
 * (growth capped +/-100, conversion in percentage points), then shifts quotas:
 * top branch +1 article/week (cap 5); bottom branch -1, floored at
 * 1 piece/month (maintenance mode). Fade, don't kill: a branch NEVER goes to
 * zero, and a kill requires an explicit CEO decision-queue approval.
 * Phase 5+: this script also pulls metrics from GSC + Cloudflare Analytics
 * before scoring (see pull-analytics step, added in Phase 5).
 */
import { readFileSync, writeFileSync } from 'node:fs';

const DATA = 'data/data.json';
const WEIGHTS = { revenue: 0.5, traffic: 0.3, conversion: 0.2 };
const clamp = v => Math.max(-100, Math.min(100, v ?? 0));
const QUOTA_CAP = 5, FLOOR_MONTHLY = 0.25; // 1 piece/month ~ 0.25/week

const data = JSON.parse(readFileSync(DATA, 'utf8'));
const branches = Object.entries(data.branches);

const scored = branches.map(([id, b]) => {
  const m = b.metrics || {};
  const score =
    clamp(m.revenue_growth_30d_pct) * WEIGHTS.revenue +
    clamp(m.traffic_growth_30d_pct) * WEIGHTS.traffic +
    (m.conversion_rate_pct ?? 0) * WEIGHTS.conversion;
  return { id, b, score: Math.round(score * 10) / 10 };
}).sort((a, b) => b.score - a.score);

if (scored.length < 2) { console.log('Need >=2 branches to reallocate.'); process.exit(0); }

// No-signal guard: at bootstrap (or a genuine tie across ALL branches) the
// ranking is arbitrary - fading the bottom branch would punish an innocent
// branch on week one. Only reallocate when there is actual differentiation.
if (scored[0].score === scored[scored.length - 1].score) {
  for (const s of scored) s.b.score = s.score; // record scores, keep quotas and modes
  data.activity_feed.push({
    agent: "Allocator", when: new Date().toISOString(),
    what: "All branches scored " + scored[0].score + " - no differentiation, quotas unchanged."
  });
  writeFileSync(DATA, JSON.stringify(data, null, 2) + "\n");
  console.log("All branches scored " + scored[0].score + " - no signal, quotas unchanged.");
  process.exit(0);
}

const top = scored[0], bottom = scored[scored.length - 1];
for (const s of scored) {
  s.b.score = s.score;
  if (s === top) s.b.quota.articles_per_week = Math.min(QUOTA_CAP, (s.b.quota.articles_per_week || 0) + 1);
  if (s === bottom) {
    s.b.quota.articles_per_week = Math.max(FLOOR_MONTHLY, (s.b.quota.articles_per_week || 0) - 1);
    if (s.b.quota.articles_per_week <= FLOOR_MONTHLY) s.b.mode = 'maintenance';
  }
  if (s.id !== bottom.id && s.b.mode === 'maintenance' && s.score > bottom.score) {
    s.b.mode = 'active'; // recovery signal; 2-week confirmation is a Phase 5+ refinement
  }
}
data.updated_at = new Date().toISOString();
data.activity_feed.push({
  agent: 'Allocator', when: data.updated_at,
  what: `Weekly allocation: ${scored.map(s => `${s.id}=${s.score}`).join(', ')}. Top: ${top.id} (+1/wk). Bottom: ${bottom.id} (faded, floor kept).`
});
writeFileSync(DATA, JSON.stringify(data, null, 2) + '\n');
console.log(scored.map(s => `${s.id}: score ${s.score} -> quota ${s.b.quota.articles_per_week}/wk (${s.b.mode})`).join('\n'));
