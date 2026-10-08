# Case Study — Runable "Ask mode" launch video (21.54s)

Beat-matched replica of an ARC browser launch video, rebuilt with Runable's real app UI. Dark theme (#111214 bg, #00b7ca cyan accent), 1920x1080 @ 24fps, reference video's full audio track laid over the cut. This is the reference execution for the skill.

## Final timeline (13 segments)

| Time | Dur | Segment | Source |
| --- | --- | --- | --- |
| 0.0–5.6 | 5.6 | blob → flower logo → "Ask" typing (ref footage) | ref cut `-t 5.6` |
| 5.6–7.0 | 1.4 | headline settles left, custom suggestion list cascades in | gen: f_5.6 → E1 |
| 7.0–9.6 | 2.6 | suggestions fade, input card in, prompt types in cyan | gen: E1 → G2 |
| 9.6–10.7 | 1.1 | cursor slides in, clicks arrow button, cyan glow | gen: G2 → G3 |
| 10.7–11.9 | 1.2 | "Ask / Thinking..." fades in from black | gen: blank → G4 |
| 11.9–13.4 | 1.5 | answer lines + "Completed 3 steps" appear sequentially | gen: G4 → G5 |
| 13.4–15.1 | 0.9 + 0.7 hold | window scales up: comparison table UI | gen: black → G6, + hold.sh |
| 15.1–16.5 | 0.7 + 0.7 hold | whip pan → charts UI | gen: G6 → G7, + hold |
| 16.5–18.1 | 0.7 + 1.0 hold | whip pan → verdict UI | gen: G7 → G8, + hold |
| 18.1–21.54 | 3.44 | "best way to work with AI" → runable.com (ref footage) | ref cut `-ss 18.10` |

Total exactly 21.54s = reference length, so the reference audio's beats land on the cuts (whips hit the music hits).

## What made it work

- User screenshots of the real app were passed to every `image_refine` call — the sidebar, logo, icons stayed genuinely on-brand.
- Every showcase frame chained from the previous via "Recreate image 1 exactly ... change only X" — G2→G3→..., so seams were invisible.
- Whips generated at 3s and remapped to 0.7s: motion blur reads intentional and fast.
- Frame-approval checkpoint caught two full frame-set rejections BEFORE any clips were generated (cheap).
- Per-beat revision: when the user later wanted the 5.6–7.0s beat replaced with an original animation, only that beat + the following typing clip were regenerated (the typing clip's start frame changed), intro re-cut at 5.6s, durations rebalanced to keep 21.54s, reassembled. Nothing else touched.

## Failure post-mortems

1. **Animating a complete UI frame** → the model redrew and scrambled all the text mid-clip. Fix: clips start blank/partial, end on the finished frame. This is Hard Rule #1.
2. **Logo drift** — early showcase frames invented a dark sidebar and a wrong logo. Caught by cropping the logo region from every frame into one comparison strip. Fix: surgical `image_refine` diffs pinning the logo to the real screenshot.
3. **Mixed encodes before concat** → broken timestamps, players showed wrong duration. Fix: normalize.sh for every segment, no exceptions.
4. **Changing one beat's duration without rebalancing** shifts every later audio beat. Fix: any re-cut must preserve the running total at each boundary (5.6+1.4+2.6 kept the 9.6s boundary intact).
5. **montage with brace-expanded paths** failed intermittently (`unable to open image`). Use explicit full filenames.
6. Asking the video model for "fast" motion directly → mushy. Generate calm 3s motion, speed up with setpts.

## Verification done before delivery

- ffprobe duration: 21.546s ✅
- 15-timestamp frame grid + 2 follow-up grids around the showcase section
- Seam at 7.0s checked with numpy MSE (≈0 → same frame both sides)
- Audio audit: whip transitions land on the soundtrack's hits

---

# Case Study 2 — iPhone 17 Pro teaser (15.0s, zero AI-generated frames)

Apple-style product teaser: pure black bg, cinematic product shots, minimal white SF Pro type. 1920x1080 @ 24fps, 6 beats, whooshes at 5.2 / 7.7 / 10.2s. The defining constraint arrived mid-project: the user rejected AI-generated frames outright ("crystal sharp, like done by hand"). Final version used **no image generation at all**.

## Final timeline (15.0s, 6 beats)

| Time | Beat | Content | Source |
| --- | --- | --- | --- |
| 0.0–2.4 | 1 | black → "This is it." typography | hand-rendered PIL frames (58 PNGs → ffmpeg) |
| 2.4–5.2 | 2 | bridge → 3-phone lineup hero | gen clip from hand-built frames |
| 5.2–7.7 | 3 | whip → A19 Pro chip | gen clip, 1.2s remap + 1.3s hold |
| 7.7–10.2 | 4 | whip → 48MP camera | gen clip, 1.2s remap + 1.3s hold |
| 10.2–12.6 | 5 | vapor chamber → bridge | gen clip |
| 12.6–15.0 | 6 | Cosmic Orange / price / apple.com outro | gen clip |

Anchor frames were hand-composited, only the *motion between them* was AI-generated (and beat 1 not even that).

## Version history (why v3 exists)

1. **v1 rejected — inaccurate product images + hard black cuts.** `image_generate` invented a phone that wasn't the iPhone 17 Pro (wrong camera plateau, wrong color). Real, recognizable products cannot be hallucinated. Cuts to pure black between beats read as dead seams.
2. **v2 rejected — AI grain.** Frames rebuilt with `image_refine` from reference shots looked close but carried the telltale diffusion texture: soft edges, noisy gradients, slightly melted text. User: "crystal sharp, like done by hand," and attached a rip of the real apple.com product page.
3. **v3 accepted — real assets, hand compositing.**
   - Scraped full-res `_xlarge_2x`/`_large_2x` images from apple.com's `srcset` attributes (2096–3840px originals; the user's zip only had thumbnails).
   - Downloaded real SF Pro OTFs; all text rendered with PIL, never by a model.
   - `build_frames3.py` composited all 8 anchor frames (product cutouts on black + typographic lockups) — reproducible, pixel-exact.
   - Bridge frames inserted at the title→hero and vapor→outro seams so no beat lands on dead black.

## Failure post-mortems (new lessons)

1. **Video model misspelled on-screen text** — the beat-1 clip rendered the subtitle as "Thisss it." Fix: typography-only beats are rendered frame-by-frame in PIL (typewriter reveal, eased fades) and encoded directly with ffmpeg. Deterministic, always spelled right. This became Hard Rule #8. (A mask/patch fix over the bad clip was considered and rejected as risky.)
2. **AI texture is detectable even on "good" frames.** If the subject is a real product with public official imagery, download the official imagery. Generation is for things that don't exist yet.
3. **`assemble.sh` needs absolute paths in concat.txt** — relative paths fail with `realpath: no such file or directory`.
4. **Never `read` an .mp4** — binary dump wastes context. Extract frames with ffmpeg and read those.

## Verification done before delivery

- ffprobe duration: 15.093s ✅ (audio boundaries preserved from v1 mix, so `audio/mix.m4a` reused unchanged)
- Seam MSE at every beat boundary: 160.1 / 224.4 / 17.6 / 0.0 / 1.7 (high values = intentional mid-motion seams; 0.0 = beat-1 last frame vs bridge frame, pixel-identical)
- Beat-1 last PIL frame vs N1b bridge PNG: MSE 0.00
- Timeline frame grid + dedicated beat-1 grid visually checked

---

# Case Study 3 — Runable Ask launch v2, light mode (21.54s, fully procedural)

Rebuild of case study 1 in light mode with ZERO generation of any kind: the entire video is one Python function `render(t)` (PIL + real brand fonts + real screenshots), rendered at 24fps ×517 frames, encoded once. No clips, no concat, no seams by construction. Reference audio reused; visual beats mapped to its detected onsets.

## Why fully procedural won

- Every previous complaint (AI grain, text scrambling, logo drift, dead seams) is impossible: one deterministic renderer, real assets only.
- Revisions are surgical: edit the beat's time window inside `render(t)`, re-render only those frame indices (`render.py all <start> <end>`), re-encode.
- Supersample 2x, downsample with LANCZOS for crisp sub-pixel motion.
- Real brand fonts pulled from the product site's own woff2 assets, converted to TTF with fonttools+brotli.

## New lessons (v2 revision round)

1. **A camera must exist.** First cut had static holds → rejected ("fix the camera movement"). Reference study showed nothing is ever still: constant slow push-in + gentle sinusoidal drift, plus small punch-in pulses that attack in ~80ms ON each audio onset and decay exponentially (`z(t) = base_push(t) + Σ 0.016·atk·e^(−3.5·Δt)`). Implemented as a global crop/zoom in the final compositing step. Continuous everywhere → seam-safe, and the whole cut feels audio-synced for free. This became Hard Rule #8.
2. **Icon/branding accuracy: extract from reference footage, not memory.** The Ask bubble's tail was drawn wrong from imagination → rejected. Fix: extract full-res frames where the icon is huge, crop it, rebuild the geometry to match. For stroked icons with organic parts (tails, notches), don't hand-draw stroke segments — build the OUTER silhouette (rounded rect ∪ bezier tail polygon), erode it by the stroke width with `scipy.ndimage.distance_transform_edt`, keep `outer & ~inner`. Uniform stroke, tail flows into the outline exactly like a real vector path. This became Hard Rule #9.
3. Compare rebuilt icons side-by-side with the reference crop at 4x before rendering — small geometry errors (tail depth/position/departure point vs the corner radius arc) took 3 iterations to converge.
4. Keep total camera zoom modest (≤ ~1.07) so edge content never crops out; clamp the crop box to the canvas.
5. Audio-hit sync list doubles as the camera punch schedule — one source of truth for cuts, typing beats, whips, and camera pulses.

## Verification

- ffprobe 21.54s = reference duration; 14-timestamp frame grid read before delivery.
- Icon crop vs reference crop side-by-side at 4x.
- Seam pairs at every bridge boundary checked pixel-continuous before the first render.
