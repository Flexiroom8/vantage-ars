# Pipeline Reference — recipes & prompt patterns

## ffmpeg recipes

Standard encode settings (every segment, always):

```bash
ENC='-an -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -r 24 -video_track_timescale 24000'
```

### Reference video breakdown

```bash
# thumbnails at 2fps to study structure
ffmpeg -y -i ref.mp4 -vf fps=2,scale=640:-1 ref_frames/r_%03d.png -loglevel error
# full-res frame at an exact beat boundary
ffmpeg -y -ss 5.6 -i ref.mp4 -frames:v 1 full/f_5.6.png -loglevel error
# cut reference footage as a segment (intro): first 5.6s
ffmpeg -y -i ref.mp4 -t 5.6 -vf scale=1920:1080 $ENC norm/p1_intro.mp4 -loglevel error
# outro from 18.10 to end
ffmpeg -y -ss 18.10 -i ref.mp4 -vf scale=1920:1080 $ENC norm/p9_outro.mp4 -loglevel error
```

### Time-remap (bundled as scripts/normalize.sh)

Generate clips at ≥3s, squeeze to beat duration:

```bash
f=$(python3 -c "print(TARGET/SOURCE_DURATION)")
ffmpeg -y -i clip.mp4 -vf "setpts=PTS*$f,scale=1920:1080,fps=24" $ENC segment.mp4
```

### Frozen hold (bundled as scripts/hold.sh)

```bash
ffmpeg -y -sseof -0.05 -i segment.mp4 -frames:v 1 last.png
ffmpeg -y -loop 1 -i last.png -t 0.7 -vf scale=1920:1080 $ENC hold.mp4
```

### Concat + audio mux (bundled as scripts/assemble.sh)

```bash
ffmpeg -y -f concat -safe 0 -i concat.txt -c copy noaudio.mp4
ffmpeg -y -i noaudio.mp4 -i audio_src.mp4 -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest final.mp4
```

### Seam check

```bash
ffmpeg -y -sseof -0.05 -i norm/pN.mp4 -frames:v 1 /tmp/a.png
ffmpeg -y -i norm/pN+1.mp4 -frames:v 1 /tmp/b.png
montage /tmp/a.png /tmp/b.png -tile 2x1 -geometry +2+2 -resize 620 /tmp/seam.png
# numeric check:
python3 -c "
from PIL import Image; import numpy as np
a=np.asarray(Image.open('/tmp/a.png'),float); b=np.asarray(Image.open('/tmp/b.png'),float)
print('MSE', ((a-b)**2).mean())"
```

Gotcha: montage/convert with brace-expanded filenames (`{a,b}.png`) fails intermittently — always pass explicit full paths.

### Mixing music + SFX

```bash
ffmpeg -y -i music.mp3 -i whoosh.wav -filter_complex \
  "[1]adelay=15100|15100,volume=0.9[s];[0][s]amix=inputs=2:duration=first:normalize=0" \
  -c:a aac mix.m4a
```

## Hand-built frames from real assets (preferred over generation)

When official/product imagery exists, composite frames programmatically — no generation, no grain:

```bash
# find full-res assets on a product page (srcset scraping)
curl -sL "https://example.com/product/" -o page.html
grep -oE 'srcset="[^"]+"|src="[^"]+\.(jpg|png)[^"]*"' page.html \
  | grep -oE '/v/[^ ",]+\.(jpg|png)' | sort -u | grep 'xlarge_2x\|large_2x'
```

```python
# PIL compositing: fit to width, pad with bg color (invisible on matching bg), real font captions
img = src.resize((1920, round(src.height * 1920/src.width)), Image.LANCZOS)
canvas = Image.new("RGB", (1920,1080), (0,0,0)); canvas.paste(img, ((1920-img.width)//2, (1080-img.height)//2))
# captions: ImageFont.truetype(brand_font, size) on an RGBA layer, manual tracking loop for letterspacing
```

Grab the real brand font (e.g. SF Pro from a GitHub mirror) — never let a model render typography you can render yourself.

### Hand-rendered motion for typography beats

Render the whole beat frame-by-frame (24 × duration frames), then encode with the standard settings:

```python
def ease_out(t): return 1-(1-t)**3        # entrances
def ease_in_out(t): return 3*t*t-2*t**3   # handoffs
# per frame: interpolate y, alpha, font size between keyframe states; last frame MUST equal the next anchor PNG (verify MSE==0)
```

```bash
ffmpeg -y -framerate 24 -i beat1_frames/f%03d.png $ENC norm/p1.mp4
```

## Bridge frames (no dead-bg seams)

A bridge frame replaces a fade-to-black boundary: outgoing element mid-exit + incoming element mid-entry, in one composed frame that both clips share.

- Hand-built (preferred): previous beat's text at ~60% alpha shifted toward its exit position + next beat's subject dimmed (`ImageEnhance.Brightness ~0.55–0.9`) and partially in frame (e.g. only top 30% peeking from the bottom edge).
- Generated: `image_refine` with both anchor frames — `Compose a single transition frame: the title from image 1 lifted higher and faded to 60% opacity, while the product from image 2 rises from the bottom edge, only its top third visible. Same background, everything crisp.`

Clip N then ends on the bridge; clip N+1 starts on the same file. The seam lands mid-motion instead of on empty background.

## Image prompt patterns (anchor frames)

Rules that prevented scrambled output:

- Quote every string that must appear: `headline "Ask about anything"`, `rows: Price ($799 vs $749), Display...`. Unquoted text descriptions get invented/scrambled.
- End with a quality clamp: `All text crisp, perfectly legible, real UI screenshot quality, flat editorial design, no 3D, no glow` (drop "no glow" for glow styles).
- Derivative frames: use `image_refine` with the previous frame as image 1 and phrase as a diff — `Recreate image 1 exactly ... but change two things only: 1) ... 2) ... Keep everything else pixel-identical to image 1.` This is the single most reliable consistency technique.
- Multi-reference compose: `Create a frame in the exact style of image 1 ... the app window content = the UI from image 2 ...`
- Surgical icon/logo fixes: `Take image 1 unchanged except one fix: replace X with the exact icon from image 2's header. Everything else stays pixel-identical.`
- Specify exact hexes for backgrounds/accents every time (`#111214`, `#00b7ca`); models drift otherwise.

## Video prompt patterns (clips)

Frame the whole clip as a screen recording to suppress camera drift: `Dark UI screen recording. ... Static camera, crisp text, flat dark background, no other motion.`

Motion vocabulary that works:

| Effect | Phrase |
| --- | --- |
| Typing reveal | `the prompt text "..." types out rapidly character by character in cyan, and once complete the text settles to white` |
| Cursor + click | `a white cursor arrow slides in from the bottom and lands on the button, which lights up with a bright cyan glow on hover` |
| Sequential lines | `lines appear one after another quickly, static camera` (list each line's exact text) |
| Window reveal | `from a pure black screen, a background blooms in and an app window scales up smoothly from the center ... stays perfectly crisp and static as the window settles` |
| Whip pan | `fast horizontal whip pan: the first window slides out to the left with strong motion blur while the second slides in from the right and snaps into place, crisp and static at the end ... very fast and clean, no morphing` |
| Zoom-settle | `zoom out from the huge headline; it settles small at the left while rows cascade in from the right` |

Always: `generate_audio: false`, duration ≥ 3s (remap down later), explicit `no morphing` on transitions, restate that end-state text must be crisp.

## Beat sheet template

| # | Time | Dur | Beat | Start frame | End frame | Motion |
| - | ---- | --- | ---- | ----------- | --------- | ------ |
| 1 | 0.0–5.6 | 5.6 | logo intro | (ref footage) | (ref footage) | reuse reference |
| 2 | 5.6–7.0 | 1.4 | suggestions | f_5.6.png | E1.png | zoom-settle + cascade |
| … | | | | | | |

Durations must sum exactly to the target. Sub-second beats are fine — generate 3s, remap.
