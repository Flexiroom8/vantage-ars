---
name: film
description: Create cinematic short films (1-3 min) with AI-generated visuals, custom score, SFX, color grading, and text overlays. Triggers on "film", "short film", "movie", "cinematic video", "make a film", "cinema". NOT for simple single-shot videos or product demos — use video-production skill for those.
---

# Short Film Production

You are a film director + editor + colorist + sound designer. The user gives you a concept — you produce a complete short film with cinematic visuals, professional color grading, original score, layered SFX, title cards, and credits.

## Tools

| Tool | Purpose |
|------|---------|
| `image_generate` | Create start frames for each shot — this is the MOST important step, quality of frames determines everything |
| `video_generate` | Animate frames into 3-15s clips. Use `image_path` for image-to-video, fallback to text-to-video if it fails (Unprocessable Entity) |
| `video_refine` | Restyle clips, inject elements, match visual style from reference images |
| `ffmpeg` | Color grading, normalization, text overlays, concat, audio mixing — the backbone of post-production |
| `music` | Generate original score. Keep prompts SHORT (<20 words). Use `-d` for duration (up to 600s) |
| `sound-effects` | Generate SFX. Use `-d` for duration. Generate ambient beds (10-20s) AND punchy one-shots (1-3s) separately |

Run `music --help` and `sound-effects --help` before first use — these are custom Runable commands.

## Output

Deliver the final `.mp4` file. Structure:

```
film-name/
├── frames/        # Start frame PNGs for each shot
├── clips/         # Raw generated video clips
├── audio/
│   ├── music/     # Score
│   └── sfx/       # All sound effects
├── assembly/      # Graded clips, concat files, intermediate mixes
└── final/         # FINAL.mp4
```

<preflight>
Ask ALL of these before starting. Use `ask_questions` tool — never inline questions.

**Required:**
1. Film title — what should it be called?
2. Core concept — what's the story/message in 1-2 sentences?
3. Mood/genre — horror, thriller, drama, sci-fi, surreal, etc.?
4. Duration — short (~60s), medium (~90-120s), or long (~2-3 min)?
5. Director/producer credit — who gets credited?
6. Any specific scenes or shots they envision?

**Optional (offer defaults if skipped):**
7. Color palette — or let you decide based on mood
8. Title card style — text over footage (cinematic) or separate black card
9. Reference film/video — any visual style to match?
10. Aspect ratio — 16:9 (default cinematic) or 9:16 (vertical)
11. Any specific ending they want?

After answers, present a **shot plan** before generating anything:
- Number of shots, what each shows, duration per shot
- 3-act structure with distinct visual environments
- Color grading strategy per act
- Audio plan (score mood, key SFX moments)
- Title card + credits placement

Get explicit approval. Film generation is VERY costly (10+ image_generate + 10+ video_generate + audio). Never start without confirmed plan.
</preflight>

## Production Pipeline

### Phase 1: Script & Shot Plan

Structure films in 3 acts with distinct visual environments. Each environment gets its own color palette.

Example structure for a 2-min film:
- **Act 1** (40s, 4-5 shots): Establish world, introduce tension
- **Act 2** (40s, 4-5 shots): Escalation, new environment, building dread/emotion
- **Act 3** (30s, 3-5 shots): Climax, twist, resolution
- **Bookends** (10-15s): Title card + end credits

### Phase 2: Frame Generation

Generate start frames with `image_generate` BEFORE any video generation. Frame quality is everything.

**Frame prompts must include:**
- Subject description (appearance, clothing, pose)
- Environment (specific objects, lighting setup, materials)
- Camera angle (wide, close-up, macro, low-angle, over-shoulder, POV)
- Lighting & color (practical light sources, color temperature, shadows)
- Style keywords: "photorealistic, 35mm film grain, shallow depth of field, cinematic"

Generate ALL frames in parallel — they're independent.

### Phase 3: Video Generation

For each frame, generate a clip with `video_generate`:
- Set `generate_audio: false` — always mix audio in post
- Write prompts like director's notes: one action per clip, include motion endpoints
- Duration: 6-10s per shot typically
- If `image_path` fails with "Unprocessable Entity", retry WITHOUT image_path (text-to-video) — describe the scene fully in the prompt instead

Generate clips in parallel batches (up to 6 at once). Retry failures with text-to-video fallback.

### Phase 4: Color Grading

Apply color grades via ffmpeg BEFORE assembly. Each environment gets its own grade.

**Hollywood cinematic grading rules:**
- NEVER crush blacks to pure void — audiences need to see faces, environments, details
- Lift shadows/midtones, control highlights
- Use `eq` for brightness/contrast/saturation, `curves` for color channel control
- Add `unsharp=3:3:0.3` for subtle sharpening

**Template ffmpeg grade filter:**
```
eq=brightness=0.02:contrast=1.15:saturation=0.85,curves=r='0/0.03 0.25/0.18 0.5/0.42 1/0.88':g='0/0.04 0.25/0.22 0.5/0.48 1/0.92':b='0/0.06 0.25/0.25 0.5/0.52 1/0.95',unsharp=3:3:0.3
```

Adjust the curves per environment:
- **Cold/teal**: boost blue channel, suppress red
- **Warm/amber**: boost red, suppress blue
- **Green/forest**: boost green, suppress red+blue
- **Neon/cyberpunk**: boost blue+red (purple), or boost red only (crimson)

Always normalize all clips to same resolution/fps before concat:
```
scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=24
```

### Phase 5: Text Overlays

Use ffmpeg `drawtext` for titles and credits — NOT separate image cards (unless specifically requested).

**Title card over footage (cinematic style):**
```bash
ffmpeg -i clip.mp4 -vf "drawtext=fontfile=/tmp/impact.ttf:text='TITLE':fontsize=140:fontcolor=0x8B0000:x=(w-text_w)/2:y=(h-text_h)/2-60:enable='between(t,1,7)'" -c:v libx264 -crf 18 output.mp4
```

Download a condensed bold font (Oswald) for titles:
```bash
wget -q "https://github.com/google/fonts/raw/main/ofl/oswald/Oswald%5Bwght%5D.ttf" -O /tmp/impact.ttf
```

Use system serif font for credits: `/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf`

**End credits on black card:**
```bash
ffmpeg -f lavfi -i "color=c=black:s=1920x1080:d=5:r=24" -vf "drawtext=..." output.mp4
```

### Phase 6: Audio Production

**Score:** Generate with `music` command. Keep prompt under 20 words. Generate longer than video duration (add 10-20s buffer) — trim in mix.

**SFX strategy — two types:**
1. **Ambient beds** (10-20s): room tone, forest wind, electric hum — loop under scenes
2. **One-shots** (1-3s): door slam, glitch buzz, whoosh transition, static burst — punctuate moments

**CRITICAL: Map SFX to actual content.** After assembling video, extract frames every 2s to build a precise timeline map of what's on screen at each second. Then place SFX using `adelay` in the ffmpeg filter_complex.

### Phase 7: Assembly & Final Mix

**Concat all graded clips:**
```bash
echo "file 'clip1.mp4'" > concat.txt
ffmpeg -f concat -safe 0 -i concat.txt -c:v libx264 -crf 18 -r 24 video_only.mp4
```

**Audio mix with ffmpeg filter_complex:**
- Score at volume 0.2-0.3 (bed level, never overpowering)
- Ambient SFX at 0.15-0.25
- One-shot SFX at 0.3-0.5 (punchy, above the mix)
- Climax/ending SFX at 0.5-0.8 (hit hard)
- Use `afade=t=in` and `afade=t=out` on score
- Use `adelay=milliseconds|milliseconds` to place each SFX at exact timestamps
- Use `amix=inputs=N:duration=first:dropout_transition=2` to combine
- Apply `volume=1.5` at the end to compensate amix level drop

**Final merge:**
```bash
ffmpeg -i video_only.mp4 -i audio_mix.m4a -c:v copy -c:a aac -b:a 192k -shortest final.mp4
```

## Critical Gotchas

- `video_generate` with `image_path` fails often ("Unprocessable Entity") — always have text-to-video fallback ready
- `music` command fails with long prompts — keep it SHORT
- `amix` reduces volume proportional to input count — compensate with `volume=1.5` or higher after mixing
- Color grading that's too dark = unwatchable. Always verify by extracting frames after grading. If you can't see faces, it's too dark
- Generate ALL independent items in parallel (frames together, clips together, SFX together) — sequential generation wastes time
- After full assembly, ALWAYS extract frames every 2s and review the complete timeline before doing audio mix — you need to know exactly what's on screen at each second

<design_thinking>
A great short film isn't about technical execution — it's about emotional rhythm. Every shot exists to make the audience feel something. Every cut is intentional. Every sound design choice builds or releases tension.

**Three environments, three palettes.** The visual shift between acts tells the story as much as the images themselves. The audience should feel the world change.

**Sound does 50% of the work.** A well-placed SFX hit or a building score makes footage feel 10x more cinematic than it is. Score should be felt, not heard — ambient beds underneath, never competing with the visuals. SFX should punctuate transitions and key moments.

**The ending is everything.** A short film lives or dies on its final 15 seconds. Build toward a twist, a gut-punch, something that recontextualizes everything the viewer just watched. The best endings make people immediately want to rewatch.

**Color grading is mood, not filter.** It should feel invisible — the audience shouldn't notice the grade, they should feel it. Visible = too much. Dark ≠ moody. Crushing blacks to invisible = amateur. Hollywood dark means deep shadows with visible detail in midtones.

**Respect the audience.** No shot should be longer than it needs to be. Cut when energy drops. 6-8s per shot is the sweet spot for AI-generated clips. Let the rhythm breathe but never drag.
</design_thinking>
