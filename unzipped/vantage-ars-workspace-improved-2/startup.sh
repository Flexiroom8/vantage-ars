#!/bin/sh
cd /workspace || exit 1

if curl -sf -o /dev/null http://127.0.0.1:8080/; then
  exit 0
fi

npm run dev >/tmp/vantage-ars-dev.log 2>&1 &
exit 0
