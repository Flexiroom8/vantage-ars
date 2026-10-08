---
name: lecture-video
description: Transforms any input (notes, images, URLs, videos, prompts) into a polished educational lecture video with dark-canvas motion graphics, professional voiceover, sound effects, and background music. Use when asked to create lecture videos, explain topics visually, turn notes into videos, or make educational content.
---

# Lecture Video

Produce **clean dark-canvas educational lecture videos**: pure black (#000000) backgrounds, crisp vector graphics, LaTeX equations, flat solid colors, thin precise lines. **Looks like programmatic/code-rendered output — NOT AI art.** No glow, bloom, gradients, blur, or purple/blue tints. Ever.

## Tools & Scripts

| Tool | Purpose |
|---|---|
| `web_search` / `mb` | Research (run `mb --help` first) |
| `transcribe` | Extract text from video/audio |
| `image_generate` | Frames (dark canvas diagrams) |
| `video_generate` | Animate frames (3-15s clips) |
| `video_refine` | Inject recurring elements |
| `say` | Voiceover narration |
| `music` / `sound-effects` | Background music + SFX |
| `ffmpeg` | Stitch, mix, crossfade |

**Scripts**: `~/.skills/lecture-video/scripts/assemble.py <project_dir>` (concat clips + mix 3 audio layers) | `scripts/research.py <url> <output.md>` (URL extraction)

## Project Structure
```
/home/user/lecture-video-project/
├── research/    script.md    frames/    clips/
├── voiceover/   sfx/         music.mp3  output/final.mp4
```

<preflight>
Gather from user:
1. Confirm understanding of their input (summarize back)
2. Professor voice — Male or Female?
3. Tone — Energetic / Calm-intellectual / Authoritative / Friendly-casual / Intense-passionate
4. Duration — Short (1-2min, ~6-12 shots) / Medium (3-5min) / Long (5+min) / Auto
5. Aspect ratio — 16:9 or 9:16
6. Focus areas — emphasize or skip anything?

Then present a **production plan** (topic summary, script outline, shot count, duration estimate, voice choice, cost warning if >15 shots). Don't generate until user approves.
</preflight>

## Production Pipeline

### Phase 1: Deep Research (MOST IMPORTANT)
Research depth = credibility. Understand 10x deeper than what appears on screen.

**Extract input**: Text→parse | Image→describe | URL→`research.py` | Video→`transcribe` + extract frames | Topic→`web_search`

**Always do supplemental research**: 3-5 searches (history, intuition, misconceptions, applications, analogies). Scrape best 2-3 sources with `mb`. Search for how top educators explain it. Find the "wait, WHAT?" moment. Verify all facts.

**Save** `research/synthesis.md`: core concepts, narrative thread, "aha" moments, misconceptions, key facts, analogies, sources. Research should produce 2-5x more content than the final script.

### Phase 2: Script
Write `script.md` with `**[VISUAL: description]**` cues per shot. Rules: hook with curiosity (never "In this video..."), 1-3 shots per section, conversational tone, tie ending to hook, use specific facts/dates/names from research, depth over vibes.

### Phase 3: Voice (BEFORE visuals — audio drives timing)
Voices: male energetic=`george`, male calm=`charlie`, female energetic=`sarah`, female calm=`rachel`, female friendly=`lily`

Split script at shot boundaries → `say -v <voice> "<text>" -o voiceover/001.mp3` → measure duration with `ffprobe` → durations drive shot lengths.

### Phase 4: Visuals

**Style (non-negotiable)**: Pure black #000000 bg. Crisp vector lines 1-3px. Flat solid accent colors. LaTeX-quality text. Max 3 accent colors per frame + white. Looks like code-rendered output.

**Palette**: Blue `#58C4DD` (primary), Green `#83C167` (positive/secondary), Yellow `#FFFF00` (key terms), Red `#FF8080` (warnings), Purple `#B080FF` (annotations), Orange `#FF8000` (emphasis), White `#FFFFFF` (text/axes), Gray `#888888` (de-emphasized)

**Anti-AI suffix (append to EVERY image prompt)**:
> Pure black background #000000, no gradients. Clean precise vector graphics, programmatic style. Crisp sharp lines, no blur, no glow, no bloom, no lens flare. Flat solid colors on pure black. Code-rendered look, NOT AI art. 4K sharp.

**Prompt patterns** — adapt per shot type:
- **Diagram**: `[SUBJECT] with thin [COLOR] outlines, sharp geometric shapes, small white labels. Sparse, lots of black space. [SUFFIX]`
- **Equation**: `"[EQ]" centered, white LaTeX text, key vars color-coded: [VAR] in [COLOR]. Nothing else. [SUFFIX]`
- **Graph**: `Thin white axes, gray ticks. [CURVE] as smooth [COLOR] 2px line. Small white axis labels. [SUFFIX]`
- **Process**: `Steps connected by thin [COLOR] arrows. Rectangle outlines with small white labels. Sparse layout. [SUFFIX]`
- **Title card**: `Large "[TITLE]" white sans-serif, subtitle in [COLOR] below. Nothing else. [SUFFIX]`
- **Comparison**: `Side-by-side: left [A] in [COLOR], right [B] in [COLOR]. Thin white divider. [SUFFIX]`

**Text on frames**: MINIMUM text — 1 equation OR 2-3 short labels OR 1 title. Max 8 words per element. Equations = hero of frame (big, centered, surrounded by black). Never sentences on frames.

**Video clips**: Start frame as `image_path`, optional end frame as `end_image_path`. Duration = voiceover segment length (3-15s). `generate_audio: false`. Describe motion: drawing-in, zoom, morph, pan, equation-building. Always note "pure black bg stays black, no glow/particles."

**Consistency**: Same color = same concept across all shots. If element recurs, use `video_refine` with `@Element`.

### Phase 5: Sound Design (parallel with visuals)
```bash
music -d <total_dur> "subtle ambient thinking music, soft piano, gentle pads, educational, minimal" -o music.mp3
sound-effects "soft whoosh transition" -d 1.5 -o sfx/whoosh.mp3
sound-effects "gentle pop reveal" -d 0.8 -o sfx/pop.mp3
sound-effects "soft rising tone, 2 seconds" -d 2 -o sfx/riser.mp3
```

### Phase 6: Assembly
```bash
python3 ~/.skills/lecture-video/scripts/assemble.py /home/user/lecture-video-project/
```
Concatenates clips with crossfades, mixes voice (100%) + music (15%) + SFX (40%) → `output/final.mp4`. For custom assembly, use ffmpeg directly (concat → mix audio → merge).

**Long videos (>15 shots)**: Warn user. Generate in batches of 5, check quality between batches. 10+ min → suggest series.

## Output
Deliver final `.mp4` via deliver tool with type `file`.

<design_thinking>
- The "aha" moment is the product — structure everything to build toward sudden understanding
- Audio-first: voiceover is backbone, visuals support narration, timing must sync
- One idea per shot — build piece by piece, don't pack frames
- Pure black #000000 always — blue/purple tints = instant "AI-generated" look, kills credibility
- If a frame looks like AI art (glow, bloom, fuzzy), regenerate it immediately
- Color encodes meaning — be consistent across all shots, max 3 accents per frame
- Motion with purpose: draw-in = building understanding, zoom = detail, morph = transformation
- Hook in first 10s with curiosity/surprise — never "In this video we'll discuss..."
- Research 2-5x more than what's in the script — deep understanding enables simple explanation
- Minimal text on frames, maximum clarity — voiceover carries words, visuals carry diagrams
- Sound design: subtle whooshes, pops, ambient music at 15-20% — felt not heard
</design_thinking>
