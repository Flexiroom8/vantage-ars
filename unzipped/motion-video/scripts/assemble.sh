#!/usr/bin/env bash
# assemble.sh — concat normalized segments and optionally mux an audio track.
#
# Usage: assemble.sh <concat.txt> <output.mp4> [audio_source]
#   concat.txt   ffmpeg concat demuxer list: lines like  file 'norm/p1.mp4'
#                (paths relative to the concat.txt location)
#   audio_source optional: any file with an audio stream (music track, reference
#                video, etc). Laid over the full video, cut with -shortest.
#
# All listed segments MUST already be normalized identically (normalize.sh /
# hold.sh) or concat -c copy will produce broken timestamps.
set -euo pipefail

LIST="$1"; OUT="$2"; AUDIO="${3:-}"
DIR=$(dirname "$(realpath "$LIST")")
TMP=$(mktemp --suffix=.mp4)

(cd "$DIR" && ffmpeg -y -f concat -safe 0 -i "$(realpath "$LIST")" -c copy "$TMP" -loglevel error)

if [ -n "$AUDIO" ]; then
  ffmpeg -y -i "$TMP" -i "$AUDIO" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest "$OUT" -loglevel error
else
  mv "$TMP" "$OUT"
fi
rm -f "$TMP"

echo "$OUT"
ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT"
