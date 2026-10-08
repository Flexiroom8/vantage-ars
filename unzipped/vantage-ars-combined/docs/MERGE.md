# How the projects were combined

Base: the Grok workspace (TanStack Start, Postgres, nine AI staff, quotes, invoices, ledger, live chat, founder notices).

| From | What came across |
| --- | --- |
| `vantage-ars-patch` | Spoof-proof caller address, pruned rate limiters, whole-word lead routing, model timeout and retry, integer-cent VAT, encoded email subjects, `.gitignore`. |
| `Vantage-ARS-v3_0_0-Enhanced` (Cloudflare) | Workers AI as the reasoning model (now a provider choice, see README), `robots.txt`, `sitemap.xml`, the business scope and pricing document (`docs/`), the verified backup idea (now a download on the Audit page). The full v3 source is kept in `legacy/vantage-ars-v3/` for reference and is not built. |
| `Vantage-Ars.zip` (original) | Superseded by v3. Its `.codex-project` chat logs were not copied. |
| Rounds 2 to 4 | VAT picker and invoice VAT, database rate limiting, security headers, README, tests. |

Not carried over: v3's department-scoped bearer credentials for external workers and its Durable Object storage. This app has one founder login, nine built-in agents and Postgres, so they have no equivalent here.
