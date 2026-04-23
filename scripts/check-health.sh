#!/bin/bash
# Ping the Garnish /api/v1/health endpoint and exit non-zero if anything's
# wrong. Meant for cron on the MacBook server, manual poking, or piping
# into a uptime monitor.
#
# Usage:
#   scripts/check-health.sh                 # localhost
#   HEALTH_URL=https://... scripts/check-health.sh
set -eu

URL="${HEALTH_URL:-http://localhost:3000/api/v1/health}"

# --max-time 5: if the server takes more than 5s to answer, treat it as down.
response=$(curl -sS --max-time 5 -w "\n%{http_code}" "$URL" 2>&1) || {
  echo "UNREACHABLE: $URL"
  echo "$response"
  exit 2
}

body=$(echo "$response" | sed '$d')
status=$(echo "$response" | tail -n1)

if [ "$status" != "200" ]; then
  echo "UNHEALTHY ($status):"
  echo "$body"
  exit 1
fi

# Optional: pretty-print if jq is available
if command -v jq >/dev/null 2>&1; then
  echo "$body" | jq .
else
  echo "$body"
fi

echo "OK"
