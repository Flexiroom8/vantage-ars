#!/usr/bin/env bash
# Vantage-ARS start script (TanStack Start SSR + Nitro).
# - Installs dependencies, builds when needed.
# - Writes deployment-output.json (explicit controller path + OPENCODE_WEB_DIR).
# - Serves the production server in the foreground on $PORT (default 3000).
# Per-command timing via /usr/bin/time -p (stderr only; never wraps `exec`).
set -euo pipefail
cd "$(dirname "$0")"
PROJECT_DIR="$(pwd)"
PORT="${PORT:-3000}"
export PORT
HOST="${HOST:-0.0.0.0}"
export HOST
TMP_BASE="${RUNNER_TEMP:-/tmp}"
DEPLOY_META_DIR="/home/runner/work/_temp/omgithub-web"

# 1. Dependencies (prefer reproducible ci; fall back to install).
if /usr/bin/time -p test -f package-lock.json; then
  if ! /usr/bin/time -p npm ci --no-audit --no-fund; then
    /usr/bin/time -p npm install --no-audit --no-fund
  fi
else
  /usr/bin/time -p npm install --no-audit --no-fund
fi

# 2. Build when the server bundle is missing or sources are newer.
NEED_BUILD=0
if /usr/bin/time -p test ! -f .output/server/index.mjs; then
  NEED_BUILD=1
elif find src package.json vite.config.ts -newer .output/server/index.mjs -print -quit | /usr/bin/time -p grep -q .; then
  NEED_BUILD=1
fi
if /usr/bin/time -p test "$NEED_BUILD" = 1; then
  /usr/bin/time -p npm run build
fi

# 3. Static snapshot for deployment-output validation (must contain index.html).
/usr/bin/time -p mkdir -p dist
if /usr/bin/time -p test -d .output/public; then
  /usr/bin/time -p cp -r .output/public/. dist/ 2>/dev/null || true
fi
if /usr/bin/time -p test ! -f dist/index.html; then
  # Render the homepage through the production server for a faithful snapshot.
  SNAP_PORT="$((PORT + 17))"
  SNAP_PID_FILE="$TMP_BASE/vantage-snap.pid"
  SNAP_LOG="$TMP_BASE/vantage-snap.log"
  (env "PORT=$SNAP_PORT" node .output/server/index.mjs >"$SNAP_LOG" 2>&1 & echo $! > "$SNAP_PID_FILE")
  SNAP_OK=0
  for _ in $(seq 1 30); do
    if /usr/bin/time -p curl --fail --silent --max-time 2 "http://127.0.0.1:${SNAP_PORT}/" -o dist/index.html; then
      SNAP_OK=1
      break
    fi
    sleep 1
  done
  kill "$(cat "$SNAP_PID_FILE")" 2>/dev/null || true
  rm -f "$SNAP_PID_FILE"
  if /usr/bin/time -p test "$SNAP_OK" != 1; then
    echo "Failed to snapshot homepage for dist/index.html. See $SNAP_LOG." >&2
    exit 1
  fi
fi

# 4. Deployment metadata (controller validates project + directory + index.html).
write_meta() {
  /usr/bin/time -p mkdir -p "$1"
  /usr/bin/time -p node -e "require('node:fs').writeFileSync(process.argv[1] + '/deployment-output.json', JSON.stringify({ project: process.cwd(), directory: require('node:path').resolve('dist') }))" "$1"
}
/usr/bin/time -p test -f dist/index.html
write_meta "$DEPLOY_META_DIR"
if /usr/bin/time -p test -n "${OPENCODE_WEB_DIR:-}"; then
  if /usr/bin/time -p test "$OPENCODE_WEB_DIR" != "$DEPLOY_META_DIR"; then
    write_meta "$OPENCODE_WEB_DIR"
  fi
fi

# 5. Serve in the foreground (controller owns the tmux session).
# NOTE: `exec` is a shell keyword — it must precede /usr/bin/time, not follow it.
exec /usr/bin/time -p node .output/server/index.mjs
