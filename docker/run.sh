#!/bin/sh
# Calls the site's cron/run-due.php every INTERVAL_SECONDS (default 300).
# The site decides what is due, so calling it more often than a source
# needs is harmless: it simply answers "Nothing due".
set -u
: "${SITE_URL:?Set SITE_URL in docker/.env}"
: "${CRON_SECRET:?Set CRON_SECRET in docker/.env}"
INTERVAL_SECONDS="${INTERVAL_SECONDS:-300}"
URL="${SITE_URL%/}/cron/run-due.php?caller=docker"

echo "Scheduler started: calling ${SITE_URL%/}/cron/run-due.php every ${INTERVAL_SECONDS}s"
while true; do
  echo "--- $(date -u '+%Y-%m-%d %H:%M:%S') UTC"
  curl --silent --show-error --fail-with-body --max-time 120 \
    -H "X-Cron-Secret: ${CRON_SECRET}" \
    -H "User-Agent: ukgridlive-scheduler/docker" \
    "$URL" || echo "Request failed (the site may be down or the secret wrong). Trying again next time."
  sleep "$INTERVAL_SECONDS"
done
