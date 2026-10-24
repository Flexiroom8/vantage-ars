#!/bin/sh
# Self-hosted autonomy heartbeat for Vantage-ARS.
#
# Ticks GET /api/cron/floor every TICK_INTERVAL seconds with the CRON_SECRET
# bearer token, so the office plans and executes its own duties without
# depending on GitHub Actions cron (best-effort on quiet repositories) or an
# external uptime monitor.
#
# Required environment:
#   CRON_SECRET    the same value the application runs with
#   BASE_URL       where the app answers, e.g. http://app:3000 (compose)
#                  or http://127.0.0.1:3000 (same host)
# Optional:
#   TICK_INTERVAL  seconds between ticks (default 600 — the ten-minute cadence)
set -u

: "${CRON_SECRET:?CRON_SECRET is required}"
: "${BASE_URL:?BASE_URL is required, e.g. http://app:3000}"
INTERVAL="${TICK_INTERVAL:-600}"

echo "vantage-ars self-scheduler: ticking $BASE_URL/api/cron/floor every ${INTERVAL}s"

while true; do
  code="$(curl -sS --max-time 300 -o /tmp/vantage-tick.out -w '%{http_code}' \
    -H "Authorization: Bearer $CRON_SECRET" \
    "$BASE_URL/api/cron/floor?ts=$(date +%s)" 2>/dev/null || echo 000)"
  body="$(cat /tmp/vantage-tick.out 2>/dev/null || true)"
  echo "$(date -u '+%Y-%m-%dT%H:%M:%SZ') tick -> HTTP $code ${body}"
  rm -f /tmp/vantage-tick.out
  sleep "$INTERVAL"
done
