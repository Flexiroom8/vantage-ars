# Tested Color Grade Presets

These are battle-tested ffmpeg color grade filters. Adjust curves per scene — these are starting points.

Always prepend the normalization filter:
```
NORM="scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=24"
```

## Cold Office / Corporate
Teal-blue, visible faces, clinical feel.
```
eq=brightness=0.02:contrast=1.15:saturation=0.85,curves=r='0/0.03 0.25/0.18 0.5/0.42 1/0.88':g='0/0.04 0.25/0.22 0.5/0.48 1/0.92':b='0/0.06 0.25/0.25 0.5/0.52 1/0.95',unsharp=3:3:0.3
```

## Dark Forest / Nature
Moody green, visible trees and faces.
```
eq=brightness=0.0:contrast=1.15:saturation=0.75,curves=r='0/0.02 0.25/0.15 0.5/0.38 1/0.82':g='0/0.04 0.25/0.22 0.5/0.48 1/0.9':b='0/0.02 0.25/0.14 0.5/0.35 1/0.78',unsharp=3:3:0.3
```

## Cyberpunk / Hacker Den (Blue-Purple)
Neon accents, screen-lit faces.
```
eq=brightness=0.02:contrast=1.15:saturation=0.85,curves=r='0/0.02 0.25/0.16 0.5/0.38 1/0.82':g='0/0.03 0.25/0.18 0.5/0.42 1/0.88':b='0/0.05 0.25/0.24 0.5/0.5 1/0.95',unsharp=3:3:0.3
```

## Surveillance / Night Vision
Green monochrome tint, high contrast.
```
eq=brightness=0.0:contrast=1.2:saturation=0.65,curves=r='0/0.02 0.25/0.15 0.5/0.35 1/0.78':g='0/0.04 0.25/0.22 0.5/0.48 1/0.9':b='0/0.02 0.25/0.14 0.5/0.35 1/0.78',unsharp=3:3:0.3
```

## Warm Amber / Nostalgic
Golden tones, cozy or romantic.
```
eq=brightness=0.02:contrast=1.1:saturation=0.9,curves=r='0/0.04 0.25/0.22 0.5/0.5 1/0.95':g='0/0.03 0.25/0.18 0.5/0.42 1/0.85':b='0/0.01 0.25/0.1 0.5/0.3 1/0.7',unsharp=3:3:0.3
```

## Horror / Desaturated
Washed out, sickly, dread.
```
eq=brightness=-0.02:contrast=1.25:saturation=0.5,curves=r='0/0.02 0.25/0.14 0.5/0.35 1/0.78':g='0/0.03 0.25/0.16 0.5/0.38 1/0.8':b='0/0.02 0.25/0.14 0.5/0.35 1/0.78',unsharp=3:3:0.4
```

## IMPORTANT
- After grading, ALWAYS extract a frame and check visibility. If you can't see faces = too dark, boost brightness
- Apply grade BEFORE text overlays — text should be on graded footage
- The normalize filter (NORM) must come BEFORE the grade in the -vf chain
