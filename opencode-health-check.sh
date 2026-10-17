#!/usr/bin/env bash
set -euo pipefail

PORT="${OPENCODE_WEB_PORT:-40453}"
BASE_URL="${OPENCODE_BASE_URL:-http://127.0.0.1:${PORT}}"
HEARTBEAT_PATH="${OPENCODE_HEARTBEAT_PATH:-/omgithub/heartbeat}"
URL="${BASE_URL}${HEARTBEAT_PATH}"

printf 'Checking OpenCode heartbeat at %s\n' "$URL"
for attempt in $(seq 1 12); do
  if curl --silent --show-error --fail "$URL" > /tmp/opencode-heartbeat.json 2>/dev/null; then
    echo "OpenCode heartbeat is healthy."
    cat /tmp/opencode-heartbeat.json
    exit 0
  fi

  echo "Heartbeat not ready yet (${attempt}/12); waiting 5 seconds..."
  sleep 5
done

echo "OpenCode heartbeat did not respond at ${URL}" >&2
exit 1
