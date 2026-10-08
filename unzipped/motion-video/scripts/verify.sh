#!/usr/bin/env bash
# verify.sh — extract frames at given timestamps and tile them into one grid PNG
# for visual timeline verification. Read the grid with the `read` tool afterwards.
#
# Usage: verify.sh <video.mp4> <t1,t2,t3,...> <out_grid.png>
# Example: verify.sh final.mp4 1.0,4.0,7.05,9.8,13.5,17.0,21.0 check/grid.png
set -euo pipefail

VID="$1"; TIMES="$2"; OUT="$3"
TMPDIR=$(mktemp -d)
FILES=()

IFS=',' read -ra TS <<< "$TIMES"
for t in "${TS[@]}"; do
  f="$TMPDIR/t_${t}.png"
  ffmpeg -y -ss "$t" -i "$VID" -frames:v 1 -vf scale=620:-1 "$f" -loglevel error
  # label each tile with its timestamp
  convert "$f" -gravity northwest -fill yellow -pointsize 28 -annotate +8+8 "${t}s" "$f"
  FILES+=("$f")
done

N=${#FILES[@]}
COLS=3; [ "$N" -le 4 ] && COLS=2
montage "${FILES[@]}" -tile "${COLS}x" -geometry +2+2 -background gray "$OUT"
rm -rf "$TMPDIR"
echo "$OUT ($N frames)"
