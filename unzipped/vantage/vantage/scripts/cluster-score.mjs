#!/usr/bin/env node
/**
 * Branch B cluster scorer - runs at each cluster's 4-6 week mark (wired into
 * the weekly Actions job). Reads data/data.json -> branches.branch-b.clusters[]
 * and applies the Allocator formula (revenue .5 / traffic .3 / conversion .2,
 * growth normalised +/-100).
 */
import { readFileSync, writeFileSync } from 'node:fs';

const DATA = 'data/data.json';
const WEIGHTS = { revenue: 0.5, traffic: 0.3, conversion: 0.2 };
const clamp = v => Math.max(-100, Math.min(100, v ?? 0));

const data = JSON.parse(readFileSync(DATA, 'utf8'));
const clusters = data.branches['branch-b'].clusters || [];
const only = process.argv[2];

const verdicts = [];
for (const c of clusters) {
  if (c.status !== 'test') continue;
  if (only && c.name !== only) continue;
  const m = c.metrics || {};
  const score =
    clamp(m.revenue_growth_30d_pct) * WEIGHTS.revenue +
    clamp(m.traffic_growth_30d_pct) * WEIGHTS.traffic +
    (m.conversion_rate_pct ?? 0) * WEIGHTS.conversion;

  let verdict = 'maintain-test';
  if (score >= 20 && (m.conversions_30d ?? 0) > 0) verdict = 'graduate';
  else if (score < -25) verdict = 'maintenance';

  c.score = Math.round(score * 10) / 10;
  c.verdict = verdict;
  verdicts.push(`${c.name}: score ${c.score} -> ${verdict}`);
}
if (verdicts.length === 0) verdicts.push('No test clusters due for scoring.');

data.activity_feed.push({
  agent: 'Allocator', when: new Date().toISOString(),
  what: `Cluster scoring: ${verdicts.join('; ')}`
});
writeFileSync(DATA, JSON.stringify(data, null, 2) + '\n');
console.log(verdicts.join('\n'));
console.log('\nNOTE: "graduate" moves the cluster to sites/branch-b/graduated/ - a Claude Code thinking step, not automated.');
