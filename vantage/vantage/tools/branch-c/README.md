# Branch C - Micro-SaaS

Three candidates built and ready to deploy (pick one or run all - each is a
single static page, zero backend needed for the free tier):

| Candidate | Folder | Free version | Pro version (Paddle) |
|---|---|---|---|
| VoIP bandwidth calculator | `voip-bandwidth/` | codecs x calls -> kbps/Mbps, per-codec table | RTP/VLAN overhead detail, multi-site sizing, CSV export, saved presets |
| Subnet calculator | `subnet-calculator/` | CIDR -> mask, hosts, range, broadcast | VLSM planner, multiple blocks, export |
| SLA calculator | `sla-calculator/` | SLA % <-> downtime budget (monthly/yearly) | multi-service stacks, incident budget tracker |

## Deploy (free)
Each `<tool>/calculator/index.html` is self-contained - deploy the folder to
Cloudflare Pages (its own project or a path on the main domain). The Worker
(`worker/`) is only needed once a pro version exists: it validates Paddle
webhooks and stores nothing.

## Payments (Paddle)
- `paddle-integration.md` has the exact wiring steps.
- Paddle account creation is a **human KYC step** (spec Section 7, step 3).
- Nothing charges anything until the CEO flips `PADDLE_MODE` from "sandbox"
  to "live" - the page renders pricing as "coming soon" until then.
