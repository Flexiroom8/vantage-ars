# Agent: PRODUCT / DEV

## Status: Phase 4 complete - three candidates built, CEO picks the flagship
All three are working, self-contained static tools in `tools/branch-c/`:
- `voip-bandwidth/calculator/` - codec x calls x overhead maths (primary recommendation: deepest practitioner credibility for the Branch A audience)
- `subnet-calculator/` - CIDR -> mask/hosts/range/broadcast
- `sla-calculator/` - SLA % -> downtime budgets
- `worker/` - Paddle webhook + ledger writeback (deploy only when a paid Pro launches)
- `paddle-integration.md` - exact wiring steps + the human KYC checklist

## Decision needed (in the Decision Queue)
Which tool gets the flagship treatment: real copy, its own Pages project,
Paddle Pro tier, and Marketing pushes.

## Build constraints (already honoured)
- Frontend: static, single-page, no build step -> Cloudflare Pages
- Backend: Cloudflare Workers free tier only (100k req/day)
- No accounts/PII; stateless (localStorage at most)
- Paddle = merchant of record (global VAT); account creation is human-only

## Ongoing duties after launch
- Fix bugs reported via Support drafts (after CEO-approved diagnosis)
- Keep the free version genuinely useful - the paywall covers convenience
  (multi-site sizing, exports, presets), never the core calculation
