#!/usr/bin/env bash
# normalize.sh — time-remap a clip to an exact target duration and normalize its encode
# so it can be safely concatenated with other segments (concat demuxer, -c copy).
#
# Usage: normalize.sh <input.mp4> <target_duration_seconds> <output.mp4>
# Example: normalize.sh clips/m1_typing.mp4 2.6 norm/p2_typing.mp4
#
# Also works as a plain re-encoder: pass the source's own duration to keep speed 1x.
set -euo pipefail

IN="$1"; TGT="$2"; OUT="$3"

SRC_DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$IN")
FACTOR=$(python3 -c "print($TGT/$SRC_DUR)")

ffmpeg -y -i "$IN" \
  -vf "setpts=PTS*${FACTOR},scale=1920:1080,fps=24" \
  -an -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -r 24 -video_track_timescale 24000 \
  "$OUT" -loglevel error

echo "$OUT  src=${SRC_DUR}s -> target=${TGT}s (factor $FACTOR)"
ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT"
