# Paddle Integration - Branch C

## What the agent builds (done)
- `worker/` - webhook validation + ledger writeback to the repo
- Checkout button stubs in each calculator (inert until PADDLE_MODE=live)

## What only the CEO can do (one-time, by law/platform)
1. Sign up at paddle.com -> identity verification (KYC)
2. Create a Product ("VANTAGE Pro") + Price (one-time or small subscription)
3. Copy the Client-side Token + Price ID into the Worker vars
4. Add the webhook endpoint `https://<worker-domain>/webhooks/paddle` in Paddle,
   and the secret into the Worker
5. Flip `PADDLE_MODE=live` only when satisfied with sandbox testing

## Wiring order
1. Deploy the calculator page(s) to Cloudflare Pages
2. Deploy the Worker (`npx wrangler deploy`)
3. Sandbox test: buy with Paddle's test card (4242 4242 4242 4242)
4. Verify the ledger entry lands in `data/ledger/`
5. CEO flips to live

## Rules
- Never store customer PII in the Worker; Paddle is the merchant of record
  (handles global VAT - the reason it was picked over Stripe for SA->global)
- The Support agent drafts replies; the CEO sends. Paddle handles refunds
  via its own dashboard - Support never negotiates.
