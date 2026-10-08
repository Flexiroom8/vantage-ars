#!/usr/bin/env node
/**
 * Phase 5 - Analytics pull. Runs in the weekly Actions job BEFORE the
 * allocator. Two sources, both free:
 *
 *   1. Google Search Console (searchanalytics.query) - clicks, impressions,
 *      CTR per site. Needs a GSC service account (created once, human step:
 *   https://console.cloud.google.com -> enable "Google Search Console API" ->
 *   service account -> JSON key -> add as the GH secret GSC_JSON_KEY, and share
 *   the GSC property with the service account email).
 *   2. Cloudflare Web Analytics (GraphQL API) - page views. Needs API token
 *      + account/site IDs (GH secrets CF_API_TOKEN, CF_ACCOUNT_ID, CF_SITE_TAG).
 *
 * Until secrets exist, this runs in DRY mode: it leaves metrics untouched and
 * writes an honest "no analytics wired yet" line to the activity feed.
 * No invented numbers - the ground rule.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const DATA = 'data/data.json';
const HAVE_GSC = !!process.env.GSC_JSON_KEY;
const HAVE_CF = !!process.env.CF_API_TOKEN && !!process.env.CF_ACCOUNT_ID && !!process.env.CF_SITE_TAG;
const SITE_KEYS = { 'branch-a': process.env.GSC_SITE_BRANCH_A }; // GSC siteUrl per branch

async function gsc30d(siteUrl) {
  // JWT signing with Web Crypto; scopes: webmasters.readonly
  const key = JSON.parse(process.env.GSC_JSON_KEY);
  const now = Math.floor(Date.now() / 1000);
  const b64url = o => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const header = b64url({ alg: 'RS256', typ: 'JWT' });
  const claim = b64url({ iss: key.client_email, scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 });
  const pem = key.private_key.replace(/\\n/g, '\n');
  const pk = await crypto.subtle.importKey('pkcs8', pemToDer(pem), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pk, new TextEncoder().encode(`${header}.${claim}`));
  const jwt = `${header}.${claim}.${b64urlRaw(sig)}`;
  const tok = (await (await fetch('https://oauth2.googleapis.com/token', { method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}` })).json());

  const end = new Date().toISOString().slice(0, 10);
  const start = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const r = await fetch('https://searchconsole.googleapis.com/webmasters/v3/sites/' +
    encodeURIComponent(siteUrl) + '/searchAnalytics/query', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tok.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ startDate: start, endDate: end, dimensions: [] })
  });
  const j = await r.json();
  return { clicks: j.rows?.[0]?.clicks ?? 0, impressions: j.rows?.[0]?.impressions ?? 0 };
}

async function cf30d() {
  const start = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const end = new Date().toISOString().slice(0, 10);
  const r = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST', headers: { Authorization: `Bearer ${process.env.CF_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `query { viewer { zones(filter: {zoneTag: "${process.env.CF_SITE_TAG}"}) { httpRequests1dGroups(limit: 100, filter: {date_geq: "${start}", date_lt: "${end}"}) { sum { requests pageViews } } } } }` })
  });
  const j = await r.json();
  return j.data?.viewer?.zones?.[0]?.httpRequests1dGroups?.reduce((a, g) => a + (g.sum.pageViews || 0), 0) ?? 0;
}

function pemToDer(pem) {
  // minimal PEM->DER base64 strip
  const body = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const bin = atob(body); const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}
function b64urlRaw(buf) {
  let s = ''; const b = new Uint8Array(buf);
  for (const c of b) s += String.fromCharCode(c);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const data = JSON.parse(readFileSync(DATA, 'utf8'));
if (!HAVE_GSC && !HAVE_CF) {
  data.activity_feed.push({ agent: 'System', when: new Date().toISOString(),
    what: 'Analytics pull skipped - GSC/Cloudflare secrets not wired yet. Metrics untouched (no invented numbers).' });
  writeFileSync(DATA, JSON.stringify(data, null, 2) + '\n');
  console.log('DRY mode: no analytics secrets found. See header of this file for the one-time human setup.');
  process.exit(0);
}

// Wired mode: pull per-branch metrics, compute growth vs previous snapshot
const SNAP = 'data/analytics-snapshot.json';
const prev = existsSync(SNAP) ? JSON.parse(readFileSync(SNAP, 'utf8')) : {};
for (const [id, b] of Object.entries(data.branches)) {
  const m = b.metrics;
  const old = prev[id] || {};
  if (HAVE_CF && process.env.CF_SITE_TAG) {
    const pv = await cf30d();
    m.traffic_growth_30d_pct = old.traffic_30d ? Math.round(((pv - old.traffic_30d) / old.traffic_30d) * 100) : 0;
    m.traffic_30d = pv;
  }
  if (HAVE_GSC && SITE_KEYS[id]) {
    const g = await gsc30d(SITE_KEYS[id]);
    m.clicks_30d = g.clicks;
    m.conversion_rate_pct = m.traffic_30d ? Math.round(m.clicks_30d / m.traffic_30d * 1000) / 10 : 0;
  }
}
writeFileSync(SNAP, JSON.stringify(Object.fromEntries(Object.entries(data.branches).map(([id, b]) => [id, { traffic_30d: b.metrics.traffic_30d, revenue_30d: b.metrics.revenue_30d }])), null, 2));
data.activity_feed.push({ agent: 'System', when: new Date().toISOString(), what: 'Pulled 30-day analytics (GSC + Cloudflare).' });
writeFileSync(DATA, JSON.stringify(data, null, 2) + '\n');
console.log('Analytics pulled and snapshot saved.');
