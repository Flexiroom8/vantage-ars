#!/usr/bin/env node
/**
 * Scaffold a new Branch B test cluster from sites/branch-b/TEMPLATE.
 * Usage: node scripts/new-cluster.mjs <cluster-name>
 * Scout fills the DOSSIER; CEO approves via Decision Queue BEFORE any content.
 */
import { cpSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const name = process.argv[2];
if (!name || !/^[a-z0-9-]+$/.test(name)) {
  console.error('Usage: node scripts/new-cluster.mjs <cluster-name>  (lowercase, hyphens)');
  process.exit(1);
}
const SRC = join('sites', 'branch-b', 'TEMPLATE');
const DST = join('sites', 'branch-b', name);
if (existsSync(DST)) { console.error(`Cluster "${name}" already exists`); process.exit(1); }

cpSync(SRC, DST, { recursive: true });
mkdirSync(join(DST, 'content', 'drafts'), { recursive: true });
mkdirSync(join(DST, 'content', 'published'), { recursive: true });

const sj = join(DST, 'site.json');
const cfg = JSON.parse(readFileSync(sj, 'utf8'));
cfg.name = name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
cfg.domain = `${name}.PLACEHOLDER-SUBDOMAIN.pages.dev`;
cfg.cluster.proposed_date = new Date().toISOString().slice(0, 10);
writeFileSync(sj, JSON.stringify(cfg, null, 2) + '\n');

console.log(`Cluster scaffolded: sites/branch-b/${name}
Next: Scout fills ${name}/DOSSIER.md -> Decision Queue item -> CEO approves -> Writer drafts.`);
