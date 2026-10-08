#!/usr/bin/env node
/**
 * VANTAGE static site builder - dependency-free (Node 18+, no npm install).
 * Reads sites/<branch>/content/published/*.md, renders to sites/<branch>/dist/
 * with the article template, JSON-LD schema, and internal links.
 * Usage: node scripts/build-site.mjs <branch>   (e.g. branch-a, or a
 *        sites/branch-b/graduated/<name> path)
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const target = process.argv[2] || 'branch-a';
const SITE = target.includes('/') ? target : join('sites', target);
const SRC = join(SITE, 'content', 'published');
const DIST = join(SITE, 'dist');

if (!existsSync(SRC)) { console.error(`No published content at ${SRC}`); process.exit(1); }
if (!existsSync(join(SITE, 'site.json'))) { console.error(`Missing ${SITE}/site.json`); process.exit(1); }
const siteCfg = JSON.parse(readFileSync(join(SITE, 'site.json'), 'utf8'));
const SITE_NAME = siteCfg.name || target;
const DOMAIN = (siteCfg.domain || 'PLACEHOLDER-DOMAIN.tld').replace(/^https?:\/\//, '').replace(/\/$/, '');

function parsePost(file) {
  const raw = readFileSync(join(SRC, file), 'utf8');
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`${file}: missing frontmatter`);
  const meta = Object.fromEntries(m[1].split('\n').filter(l => l.includes(':'))
    .map(l => { const i = l.indexOf(':'); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
  return { meta, body: m[2], slug: file.replace(/\.md$/, '') };
}

function inline(md) {
  return md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

function renderBody(md) {
  const lines = md.split('\n'); let html = '', inList = false, inCode = false, inTable = false;
  for (const line of lines) {
    if (line.startsWith('```')) {
      if (inCode) { html += '</code></pre>'; inCode = false; }
      else { html += '<pre><code>'; inCode = true; }
      continue;
    }
    if (inCode) { html += line + '\n'; continue; }
    const h = line.match(/^(#{1,4})\s+(.*)/);
    if (h) { html += `<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`; continue; }
    if (/^[-*]\s+/.test(line)) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li>${inline(line.replace(/^[-*]\s+/, ''))}</li>`; continue;
    } else if (inList) { html += '</ul>'; inList = false; }
    if (line.startsWith('|')) {
      const cells = line.split('|').slice(1, -1).map(c => c.trim());
      if (cells.every(c => /^-+$/.test(c))) continue;
      if (!inTable) { html += '<table>'; inTable = true; }
      html += `<tr>${cells.map(c => `<td>${inline(c)}</td>`).join('')}</tr>`;
      continue;
    } else if (inTable) { html += '</table>'; inTable = false; }
    if (line.trim() === '') continue;
    html += `<p>${inline(line)}</p>`;
  }
  if (inList) html += '</ul>'; if (inTable) html += '</table>'; if (inCode) html += '</code></pre>';
  return html;
}

const posts = readdirSync(SRC).filter(f => f.endsWith('.md')).map(parsePost)
  .sort((a, b) => (b.meta.date || '').localeCompare(a.meta.date || ''));

const LAYOUT = (title, content, desc, jsonld, path) => `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title><meta name="description" content="${desc || ''}">
<link rel="canonical" href="https://${DOMAIN}/${path}">
${jsonld || ''}
<link rel="stylesheet" href="/assets/style.css">
</head><body><header><a class="home" href="/"><- ${SITE_NAME}</a></header>
<main>${content}</main>
<footer><p>(c) ${new Date().getFullYear()} ${SITE_NAME}. Some links may be affiliate links.</p></footer>
</body></html>`;

mkdirSync(join(DIST, 'assets'), { recursive: true });

const indexContent = `<h1>${SITE_NAME}</h1><p class="tagline">${siteCfg.tagline || ''}</p><ul class="index">` +
  posts.map(p => `<li><a href="/${p.slug}/">${p.meta.title}</a> <time>${p.meta.date || ''}</time></li>`).join('') +
  '</ul>';
writeFileSync(join(DIST, 'index.html'), LAYOUT(SITE_NAME, indexContent, siteCfg.tagline || SITE_NAME, '', ''));

for (const p of posts) {
  const jsonld = `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org', '@type': 'Article',
    headline: p.meta.title, description: p.meta.description,
    datePublished: p.meta.date, author: { '@type': 'Person', name: p.meta.author || 'Juan-Louw Greyling' }
  })}</script>`;
  mkdirSync(join(DIST, p.slug), { recursive: true });
  writeFileSync(join(DIST, p.slug, 'index.html'),
    LAYOUT(p.meta.title, `<article><h1>${p.meta.title}</h1>${renderBody(p.body)}</article>`,
      p.meta.description, jsonld, `${p.slug}/`));
}
writeFileSync(join(DIST, 'assets', 'style.css'), readFileSync(join('scripts', 'assets', 'article.css'), 'utf8'));
console.log(`Built ${posts.length} posts for ${SITE} -> ${DIST}`);
