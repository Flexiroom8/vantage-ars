#!/bin/sh
# Regenerate the VANTAGE canvas from the /home/user/vantage tree.
# Output is pure ASCII; every file body goes into a four-backtick fence.
set -e
ROOT=/home/user/vantage
OUT=/home/user/canvases/vantage-phase-1-skeleton/CANVAS.md
mkdir -p "$(dirname "$OUT")"
{
  printf '%s\n' '---'
  printf '%s\n' 'name: vantage-phase-1-skeleton'
  printf '%s\n' 'type: text/markdown'
  printf '%s\n' 'title: VANTAGE - Complete Build (Phases 1-7)'
  printf '%s\n' '---'
  printf '\n'
  printf '%s\n' '# VANTAGE - Complete Build (Phases 1-7)'
  printf '\n'
  printf '%s\n' 'Full repository contents for the VANTAGE autonomous revenue engine. Each section below is one file: the heading is its path, and the body inside the four-backtick fence is its exact content. To rebuild the repo locally, create each path and paste the fenced content verbatim.'
  printf '\n'
  cd "$ROOT"
  find . -type f | sed 's|^\./||' | sort | while IFS= read -r f; do
    printf '\n'
    printf '### `%s`\n\n' "$f"
    printf '````\n'
    cat "$f"
    printf '\n'
    printf '````\n'
  done
} > "$OUT"
echo "wrote $OUT"
wc -c "$OUT"
