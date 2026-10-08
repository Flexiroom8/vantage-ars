/**
 * Branch C Worker - only needed once a paid Pro version exists.
 * Free tier: 100k req/day. Two endpoints:
 *  1. GET  /api/config        - Paddle env IDs for the calculator page
 *  2. POST /webhooks/paddle   - signature-verified; writes a ledger entry
 *     back to the repo via the GitHub API (Accountant agent picks it up)
 * No PII stored; no database. Deploy: npx wrangler deploy
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/config' && request.method === 'GET') {
      return Response.json({
        paddleMode: env.PADDLE_MODE || 'sandbox',
        clientToken: env.PADDLE_CLIENT_TOKEN || null,
        proPriceId: env.PADDLE_PRO_PRICE_ID || null
      });
    }

    if (url.pathname === '/webhooks/paddle' && request.method === 'POST') {
      const raw = await request.text();
      const sig = request.headers.get('Paddle-Signature') || '';
      const ts = (sig.match(/ts:(\d+)/) || [])[1];
      const expected = await hmac(`${ts}:${raw}`, env.PADDLE_WEBHOOK_SECRET);
      const got = (sig.match(/h1:([a-f0-9]+)/) || [])[1];
      if (!expected || got !== expected) return new Response('bad signature', { status: 401 });

      const event = JSON.parse(raw);
      if (event.event_type === 'transaction.completed') {
        const entry = {
          date: new Date().toISOString().slice(0, 10),
          branch: 'branch-c',
          type: 'revenue',
          source: `Paddle - ${event.data.custom_data?.plan || 'pro'}`,
          amount: event.data.totals?.total || 0,
          currency: event.data.currency_code || 'USD',
          reference: event.data.id
        };
        await fetch(`https://api.github.com/repos/${env.GH_REPO}/contents/data/ledger/paddle.json`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${env.GH_PAT}`, Accept: 'application/vnd.github+json' },
          body: JSON.stringify({ message: 'paddle: pro sale', content: btoa(JSON.stringify(entry)) })
        }).catch(() => {}); // log-only; the weekly reconcile catches drops
      }
      return new Response('ok');
    }

    return new Response('not found', { status: 404 });
  }
};

async function hmac(data, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}
