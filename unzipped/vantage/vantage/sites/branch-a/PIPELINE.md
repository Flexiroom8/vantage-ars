# Branch A Pipeline - How a Piece Goes From Backlog to Live

This is the Phase 2 operating loop. Claude Code drives steps 1-3 (thinking runs);
the build + deploy are mechanical.

```mermaid
flowchart LR
  A["Backlog topic"] --> B["Writer: draft -> content/drafts/"]
  B --> C{"Practitioner notes?"}
  C -- "thin" --> D["Decision Queue: ceo-input-needed"]
  D --> B
  C -- "good" --> E["SEO/AEO Editor: checks -> content/published/"]
  E --> F["git commit -> push"]
  F --> G["Build: node scripts/build-site.mjs branch-a"]
  G --> H["Cloudflare Pages deploy"]
  H --> I["Marketing repurposes -> social queue"]
```

## The Editor's publish gate

The SEO/AEO Editor may only move a draft to `published/` after its checklist in
`agents/seo-editor.md` passes. `{{AFF:...}}` placeholders stay in the markdown;
unmapped ones render as plain text - an unapproved program can never go live
with a live link.

## Build

```bash
node scripts/build-site.mjs branch-a
```
Node 18+, zero npm dependencies. Output: `sites/branch-a/dist/`.

## Deploy (recommended free path)

Connect the repo to Cloudflare Pages via git integration: build command
`node scripts/build-site.mjs branch-a`, output dir `sites/branch-a/dist`.
Zero GitHub Actions minutes, unlimited bandwidth. The `publish.yml` workflow
is the fallback.

## AEO notes baked into the template

- Every post: direct 2-3 sentence answer within the first paragraph
- JSON-LD Article schema auto-generated at build
- Comparison tables -> quotable, parseable
- Canonical URLs use the domain in `sites/branch-a/site.json` - update after registration
