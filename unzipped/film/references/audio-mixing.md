# Audio Mixing Reference

## SFX Categories to Generate

### Ambient Beds (10-20s, loopable)
- Office room tone / fluorescent hum / ventilation
- Forest wind / leaves / night atmosphere
- CRT monitor hum / electronic buzz
- Rain / thunder / weather

### One-Shot SFX (1-4s, punchy)
- Keyboard typing (mechanical or membrane)
- Phone ring / hangup
- Door slam / creak
- Whoosh transition (for scene changes)
- Glitch / digital interference
- Camera servo / motorized movement
- Static burst (TV static)
- Heartbeat (sub bass, for tension)
- Impact / boom (for dramatic moments)

### Emotional SFX (5-10s, for endings/climaxes)
- Building heartbeat (accelerating)
- Tinnitus ring (rising high pitch)
- Reverse cymbal / swell
- Drone buildup to silence

## Audio Mix Template

```bash
ffmpeg -y \
  -i score.mp3 \
  -i sfx1.mp3 \
  -i sfx2.mp3 \
  -filter_complex "\
    [0:a]atrim=0:DURATION,asetpts=PTS-STARTPTS,volume=0.22,afade=t=in:d=4:st=0,afade=t=out:d=3:st=END[score];\
    [1:a]atrim=0:LENGTH,asetpts=PTS-STARTPTS,volume=0.35[sfx1];\
    [2:a]atrim=0:LENGTH,asetpts=PTS-STARTPTS,volume=0.4[sfx2];\
    [sfx1]adelay=TIMESTAMP_MS|TIMESTAMP_MS[d_sfx1];\
    [sfx2]adelay=TIMESTAMP_MS|TIMESTAMP_MS[d_sfx2];\
    [score][d_sfx1][d_sfx2]amix=inputs=3:duration=first:dropout_transition=2,volume=1.5[mix]" \
  -map "[mix]" -c:a aac -b:a 192k output.m4a
```

## Volume Levels Guide
| Element | Volume | Notes |
|---------|--------|-------|
| Score (bed) | 0.20-0.30 | Felt not heard, never competing |
| Ambient beds | 0.15-0.25 | Subtle, fills silence |
| Standard SFX | 0.30-0.45 | Present, supports visuals |
| Impact SFX | 0.50-0.70 | Punchy, attention-grabbing |
| Climax SFX | 0.70-0.90 | Maximum impact for endings |

## Key Rules
- `amix` drops volume proportional to input count — ALWAYS compensate with `volume=1.5` or higher after mixing
- Use `adelay=milliseconds|milliseconds` (both channels) for precise placement
- Always `afade` the score in and out — never hard start/stop
- Map SFX to actual content by extracting frames every 2s and building a timeline BEFORE mixing
- Generate clips with `generate_audio: false` — always mix audio in post for films
