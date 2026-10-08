---
name: motion-video
description: Create high-end motion design videos — product/feature launch videos, explainers, promos, ads — using an anchor-frame pipeline (AI-generated first/middle/last frames per beat, first+last-frame video clips, ffmpeg time-remap and assembly). Use when the user asks for a motion video, launch video, promo video, animated ad, motion graphics, or a product showcase video. Supports beat-matching an uploaded reference video or building from scratch, from user screenshots or fully generated visuals.
---

# Motion Video

You produce polished motion design videos the way a motion studio does: design every key frame first, get them approved, then animate between them. The user gives a topic and details; you drive the rest through the workflow below.

The gold-standard example this pipeline produced is documented in `references/case-study.md` — read it before your first video.

## Tools

| Task | Tool | Notes |
| --- | --- | --- |
| Anchor frames from user screenshots / prior frames | `image_refine` | Preferred — pass screenshots + prior frames for pixel consistency |
| Anchor frames from scratch | `image_generate` | Only when no reference imagery exists |
| Animate between anchor frames | `video_generate` | `image_path` = start frame, `end_image_path` = end frame, `generate_audio: false`, duration ≥ 3s |
| Restyle / inject into existing footage | `video_refine` | Rare; prefer regenerating the beat |
| Cut, remap, concat, mux, extract frames | `ffmpeg` via bash | Use the bundled scripts |
| Background music | `music` command | Run `music --help` first |
| Whooshes, clicks, UI sounds | `sound-effects` command | Run `--help` first |
| Inspect every generated frame/grid | `read` | Mandatory before using any frame |

Bundled scripts (`scripts/`): `normalize.sh` (time-remap + normalize encode), `hold.sh` (frozen-still holds), `assemble.sh` (concat + audio mux), `verify.sh` (timestamp frame grid). Run each with no args to see usage.

## Workflow

### 1. Gather inputs — always, before generating anything

Use `ask_questions` (see `<preflight>`). Then research the product/topic if needed and write a **beat sheet**: a markdown table of segments — segment id, start–end time, duration, what happens, start-frame description, end-frame description, camera/motion note. Total duration must be exact (matters for audio sync).

If the user gave a reference video: extract frames at 2fps (`ffmpeg -vf fps=2,scale=640:-1`) plus full-res frames at every beat boundary, study them, and map your beat sheet 1:1 to the reference timeline. Reference footage can be reused directly for intro/outro segments when the user allows it.

### 2. Generate anchor frames

For every beat: a start frame and an end frame (plus a middle frame for long/complex beats). Consecutive beats share frames — beat N's end frame IS beat N+1's start frame. Never generate two "almost identical" frames for a seam; reuse the exact file.

**Real assets beat generation.** Before generating any frame, hunt for real source imagery: official press/product images (product pages often serve full-res `_xlarge_2x` assets — scrape the page's `srcset`s), user screenshots, brand kits. Composite them onto the canvas programmatically (PIL/ImageMagick: fit-to-width, pad with the bg color, real brand fonts for captions) — zero generation means zero AI grain, mushy edges, or invented details. Only fall back to `image_refine`/`image_generate` for imagery that cannot exist yet. Recipes in `references/pipeline.md`.

When you do generate: build frames with `image_refine` from user screenshots and previously approved frames so branding, fonts, and layout stay pixel-consistent. Prompt patterns that work are in `references/pipeline.md`.

After each generation, `read` the frame at full size. Reject and regenerate if any text is scrambled, icons are malformed, or the logo/branding drifts from other frames (crop-compare logos across frames when in doubt).

### 3. CHECKPOINT — frame approval (mandatory)

Montage all anchor frames into a labeled grid, deliver it (`deliver`, type file) together with the beat sheet, and stop. Do not generate a single video clip until the user approves or edits the frames. Iterate frames here — it is 10x cheaper than iterating clips.

### 4. Generate and normalize clips

One `video_generate` call per beat: start frame + end frame, minimum 3s even for sub-second beats, `generate_audio: false`, motion described precisely (camera vocabulary in `references/pipeline.md`). Then squeeze each clip to its beat duration: `scripts/normalize.sh <clip> <beat_duration> <segment>`. Generating slow and remapping fast gives crisper motion than asking the model for fast motion.

Add frozen holds after fast motion with `scripts/hold.sh` — never ask the model to "hold still" at the end of a clip.

### 5. Assemble and add audio

Write a concat list (`file 'norm/p1.mp4'` lines, in order), then `scripts/assemble.sh concat.txt final.mp4 <audio_source>`. Audio source: reference video (beat-matched builds), a `music`-generated track, a user track, or layered music + `sound-effects` mixed with ffmpeg `amix`.

### 6. Verify, then CHECKPOINT — final delivery

- `ffprobe` total duration matches the beat sheet exactly.
- `scripts/verify.sh final.mp4 <10+ timestamps> grid.png` → `read` the grid.
- Check every seam: extract last frame of segment N and first frame of segment N+1, compare visually (or numpy MSE). A visible jump means a frame was duplicated instead of reused — fix the frames, not the seam.

Deliver the MP4. For revisions, regenerate only the broken beat and re-assemble — never rebuild the whole video.

## Hard rules

1. **Never animate from an already-complete UI frame.** Video models scramble existing text. Clips must start from a blank/partial state and END on the complete frame.
2. **Identical encode before concat.** Every segment through `normalize.sh`/`hold.sh` (libx264, crf 17, yuv420p, 24fps, timescale 24000, `-an`). Mixed encodes = broken timestamps.
3. **Total duration is sacred** when audio is beat-matched. If you re-cut one segment, rebalance neighbors so the total is unchanged.
4. **Verify every generated asset with `read`** before building on it. Never report a frame or video as good unseen.
5. **Seam = same file.** Adjacent beats share the literal same PNG at their boundary.
6. Text in frames: quote the exact strings in the image prompt and demand "crisp, perfectly legible" — and still verify.
7. **No dead-black (or dead-bg) seams between connected beats.** Every boundary must be one of: (a) a shared anchor frame, (b) a designed *bridge frame* where the outgoing element is mid-exit while the incoming element is mid-entry (overlapping action), or (c) an intentional hard cut landing exactly on an audio hit. A beat that fades fully to black before the next beat fades in reads as two stitched videos, not one film.
8. **Nothing is ever static — add a procedural camera.** Real motion design has no still frames: apply a continuous global camera (slow push-in + gentle sine drift) plus small punch-in pulses that attack ~80ms on each audio onset and decay exponentially. For procedural renders, implement as a final crop/zoom step (`z(t) = base_push + Σ punch(t-hit)`, total zoom ≤ ~1.07, crop clamped to canvas); for generated clips, demand subtle drift in the prompt. A continuous never-resetting camera is seam-safe by construction and makes cuts feel audio-synced for free.
9. **Icons and brand marks: extract from reference footage, never draw from memory.** Crop the mark at its largest appearance, rebuild the geometry, and compare side-by-side at 4x before rendering. For stroked icons with organic parts (speech-bubble tails, notches): build the outer silhouette (shape ∪ bezier polygon), erode it by the stroke width via `scipy.ndimage.distance_transform_edt`, keep `outer & ~inner` — uniform stroke, parts flow into the outline like a real vector path.
10. **Typography-only beats are rendered by hand, never generated.** Title cards, outros, text-on-bg beats: render every frame programmatically (PIL + real fonts + easing curves, encode with the standard settings). Deterministic, pixel-exact ends, perfect spelling — video models routinely misspell text mid-motion even when both anchor frames are correct.

<preflight>
Ask via `ask_questions` before any generation:

1. Topic — what is the video about, what must it communicate? Key text: headlines, product name, exact prompt/demo text, CTA, outro URL.
2. Duration and aspect ratio (default 1920x1080 landscape).
3. Do they have screenshots / brand assets / product UI to build from? (allowAttachments: true). If none: "Should I generate the visuals from scratch?"
4. Reference video to beat-match? (allowAttachments: true). If yes, may its intro/outro footage and audio be reused directly?
5. Style — always ask, never assume: theme (dark/light), background + accent colors, motion feel (whip cuts / smooth zooms / typing beats / fades), any brand kit.
6. Audio — generate music (+ SFX)? user-provided track? reference video's audio? silent?

Then present the beat sheet as decisions before generating frames.
</preflight>

<design_thinking>
Great motion design is choreography, not effects. The energy curve matters: calm setup → accelerating middle → punchy showcase whips → breathing-room outro. Cut ON the audio beats. Fast things should be very fast (0.7s whips) and holds genuinely still — mush lives in between.

Frames carry the quality; motion just connects them. A mediocre animation between two beautiful, consistent frames still reads premium. A beautiful animation between inconsistent frames reads AI-generated. Spend the iteration budget on frames.

Overlapping action is what makes separate beats feel like one continuous film: something from beat N should still be moving when beat N+1's subject enters. Title lifting while the product rises beneath it; the product dimming while outro text emerges over it. Design these moments as explicit bridge frames — never let both elements come to rest on empty background between beats.

Consistency is the whole game: same logo, same fonts, same background hex, same corner radii across every frame. One drifted logo destroys the illusion of a real product recording.
</design_thinking>

## References

- `references/pipeline.md` — ffmpeg recipes, image/video prompt patterns, camera vocabulary. Read when executing steps 2–6.
- `references/case-study.md` — three full builds: the Runable Ask launch video (generated frames, beat-matched to a reference), the iPhone 17 Pro teaser (zero AI-generated frames, real assets + hand compositing), and Ask v2 (fully procedural — the entire video as one `render(t)` function with a procedural camera synced to audio onsets), each with failure post-mortems. Read before your first video with this skill.
