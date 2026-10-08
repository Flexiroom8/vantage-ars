# Quality Checklist

Run through this checklist before delivering any ad creative package. Every item must pass.

---

## Copy Compliance

- [ ] All character counts within platform limits (check against `platform-specs.md`)
- [ ] No ALL CAPS except acronyms (Google, Meta, LinkedIn all flag this)
- [ ] No excessive punctuation (!!!, ???, .... all trigger rejection)
- [ ] No "click here" or platform trademarks in copy ("Facebook", "Insta", "Google")
- [ ] No first-person platform references
- [ ] No unsubstantiated superlative claims (#1, best-in-class, world's best)
- [ ] No deceptive or misleading claims
- [ ] No personal attribute targeting language ("Are you overweight?", "Do you have debt?")
- [ ] CTA matches the likely landing page offer (don't say "Buy now" if it leads to a blog)

## Copy Quality

- [ ] Every headline could stand alone — doesn't need description to make sense
- [ ] Specific claims over vague claims ("save 3 hours" > "save time")
- [ ] At least 3 different creative angles across all variants (not just word swaps)
- [ ] Funnel stage matches the copy approach (don't show proof to cold audiences)
- [ ] Language matches how the target audience actually talks about this problem
- [ ] No copy lifted verbatim from the brand's landing page

## Brand Identity Extraction

- [ ] Exact primary hex color extracted (via `mb audit` or manual inspection)
- [ ] Exact secondary/accent hex colors extracted
- [ ] Font families identified (heading + body)
- [ ] Brand logo downloaded as actual file (PNG/SVG, not a screenshot crop)
- [ ] Logo variants captured if available (dark mode, light mode, icon-only)
- [ ] Brand tone of voice documented with examples from their site
- [ ] Key product screenshots captured for reference

## Static Image Creatives

- [ ] Correct aspect ratio for each platform (1:1 feed, 9:16 stories, etc.)
- [ ] Text on image is readable at mobile size (large enough, high contrast)
- [ ] **Exact brand hex colors used** — not approximations
- [ ] **Actual brand logo composited** onto every creative (not a text placeholder)
- [ ] Image text <20% of total area (Meta guideline — still impacts delivery)
- [ ] Safe zones respected (no critical content cut off by platform UI elements)
- [ ] Visual style matches the creative angle (UGC-style looks authentic, brand ads look polished)
- [ ] CTA button or action element is visually clear
- [ ] Logo present but not dominating (corner placement, reasonable size)

## Video Creatives — Script

- [ ] Full script written with shot-by-shot breakdown
- [ ] Every shot has: visual description, VO line, SFX notes, text overlay notes
- [ ] Timing marks on every shot (start time – end time)
- [ ] Total script duration matches target video length
- [ ] Hook happens in first 3 seconds (1 second for TikTok)
- [ ] Only ONE value point in the body — not three crammed together
- [ ] CTA shot explicitly includes logo + URL
- [ ] VO script reads naturally when spoken aloud — not corporate/stiff

## Video Creatives — Production

- [ ] **Voiceover recorded** using `say` with appropriate voice for brand tone
- [ ] VO duration verified with `ffprobe` — fits within video length
- [ ] **Background music generated** matching video mood/energy
- [ ] Music is **ducked under voiceover** (~15-20% volume) — audible but not competing
- [ ] Sound effects generated for transitions and accent moments
- [ ] All video shots generated matching script visual descriptions
- [ ] **Brand logo appears in CTA/closing shot** — actual logo file, not text
- [ ] **Exact brand colors used** in all generated shots
- [ ] Shots assembled in correct order matching script
- [ ] Final audio mix (VO + music + SFX) composited onto video via `ffmpeg`

## Video Creatives — Final Quality

- [ ] **No silent videos** — every video has VO + music
- [ ] Hook in first 3 seconds (1 second for TikTok)
- [ ] Clear Hook → Body → CTA structure audible in VO and visible in visuals
- [ ] Body delivers ONE value point, not three
- [ ] CTA is explicit — appears visually AND verbally in VO
- [ ] Correct aspect ratio per platform (9:16 for TikTok/Stories/Shorts, 16:9 for YouTube)
- [ ] Duration appropriate: 6–15s for short-form, 15–30s for YouTube pre-roll
- [ ] Platform-native feel (TikTok = raw, LinkedIn = polished, YouTube = cinematic)
- [ ] No copyrighted audio — all music/SFX generated fresh
- [ ] Text overlays within safe zones
- [ ] Video doesn't feel like a slideshow — has actual motion and animation
- [ ] Pacing matches script timing — nothing rushed, nothing dragging

## Carousel Creatives

- [ ] Consistent visual style across all cards
- [ ] Each card works standalone AND in sequence
- [ ] Card 1 is a genuine hook (not a title card)
- [ ] Last card has clear CTA
- [ ] Visual connectors encourage swiping (arrows, numbering, continuing design)
- [ ] All cards same aspect ratio (1:1 for most platforms)
- [ ] **Brand logo on first and last card minimum**
- [ ] **Exact brand colors used across all cards**

## Brand Consistency (Final Pass)

- [ ] **Exact hex colors match across ALL assets** — statics, video frames, carousels
- [ ] **Actual brand logo present on ALL deliverables**
- [ ] Tone of voice consistent with brand personality across all copy
- [ ] Logo used correctly (proper version, clear space, not distorted)
- [ ] Typography consistent across all assets
- [ ] Visual style cohesive — looks like one campaign, not random pieces

## Creative Matrix

- [ ] At least 3 different angles/hooks represented
- [ ] Each platform has at least 2 variants for testing
- [ ] Matrix document clearly maps: angle × platform × file
- [ ] Testing recommendations included (what to test first, what signals to look for)
- [ ] **Video script files linked** from matrix for each video deliverable

## Delivery

- [ ] All files named with clear convention: `[platform]-[format]-[variant].ext`
- [ ] Folder structure is clean and organized
- [ ] Brief and matrix documents included
- [ ] **Video scripts included in scripts/ folder**
- [ ] Brand kit stored in memory for future sessions
- [ ] **Brand assets folder included** with logo files and screenshots
