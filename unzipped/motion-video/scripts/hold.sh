#!/usr/bin/env bash
# hold.sh — create a frozen still segment from the LAST frame of a segment.
# Use after fast motion (whips/reveals) for crisp holds instead of longer AI clips.
#
# Usage: hold.sh <source_segment.mp4> <hold_duration_seconds> <output.mp4>
set -euo pipefail

IN="$1"; DUR="$2"; OUT="$3"
STILL=$(mktemp --suffix=.png)

ffmpeg -y -sseof -0.05 -i "$IN" -frames:v 1 "$STILL" -loglevel error
ffmpeg -y -loop 1 -i "$STILL" -t "$DUR" \
  -vf "scale=1920:1080" \
  -an -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -r 24 -video_track_timescale 24000 \
  "$OUT" -loglevel error
rm -f "$STILL"

echo "$OUT (${DUR}s hold from last frame of $IN)"
