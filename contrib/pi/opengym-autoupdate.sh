#!/bin/bash
# openGym self-update for a Raspberry Pi running this fork's images.
#
# Started by the "Update this server" button in Settings: the app leaves
# data/update-request.json and a systemd path unit runs this (see install.sh). Each run:
#   1. pulls the fork's newest images (nothing else changes if there is nothing new)
#   2. when the running containers are older than what was pulled: backs up data/,
#      restarts on the new images and checks /api/health
#   3. if the new build is not healthy within 90 s: puts the previous images back, restarts,
#      and remembers the bad build so the next run does not install it again
#
# Pause it:   touch ~/apps/openGym/autoupdate.paused      Resume: rm that file
# Run by hand: sudo systemctl start opengym-autoupdate.service
# Log:        ~/apps/openGym/autoupdate.log                Backups: ~/opengym-backups
set -uo pipefail

APP_DIR="${APP_DIR:-/home/adwaith/apps/openGym}"
BACKUP_DIR="${BACKUP_DIR:-/home/adwaith/opengym-backups}"
KEEP_BACKUPS="${KEEP_BACKUPS:-14}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:8080/api/health}"
API_IMAGE="${API_IMAGE:-ghcr.io/adwaith-js/opengym-api:nutrition}"
WEB_IMAGE="${WEB_IMAGE:-ghcr.io/adwaith-js/opengym-web:nutrition}"
LOG="$APP_DIR/autoupdate.log"
BAD="$APP_DIR/.autoupdate-bad"
REQ="$APP_DIR/data/update-request.json"
STATUS="$APP_DIR/data/update-status.json"

cd "$APP_DIR" || exit 1
log() { echo "$(date '+%F %T') $*" >> "$LOG"; }
# Keep the log short: the last 1000 lines are plenty to see what happened.
trim_log() { [ -f "$LOG" ] && tail -n 1000 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"; }
trap trim_log EXIT

# What the app shows under "Update this server" (GET /api/admin/update reads it).
web_version() { docker inspect --format '{{index .Config.Labels "org.opencontainers.image.version"}}' opengym-web-1 2>/dev/null || true; }
status() {
  printf '{"state":"%s","message":"%s","version":"%s","at":"%s"}\n' "$1" "$2" "$(web_version)" "$(date -u +%FT%TZ)" > "$STATUS.tmp" \
    && mv "$STATUS.tmp" "$STATUS"
}

# The request is taken first: the path unit starts this again for as long as the file exists.
rm -f "$REQ"

# Paused by hand, or the stack was switched back to another image (the rollback in the runbook).
if [ -f autoupdate.paused ]; then status paused "Updates are paused on the Pi (autoupdate.paused)"; exit 0; fi
if ! grep -q "$API_IMAGE" docker-compose.override.yml 2>/dev/null; then
  status paused "The Pi is not running the fork's images (rolled back by hand)"; exit 0
fi
status checking "Checking for a new build"

img_id() { docker image inspect --format '{{.Id}}' "$1" 2>/dev/null || echo none; }
running_id() { docker inspect --format '{{.Image}}' "$1" 2>/dev/null || echo none; }
healthy() {
  for _ in $(seq 1 18); do
    curl -fsS --max-time 5 "$HEALTH_URL" >/dev/null 2>&1 && return 0
    sleep 5
  done
  return 1
}

# What is running now: the rollback target if the new build turns out bad.
run_api=$(running_id opengym-api-1)
run_web=$(running_id opengym-web-1)

if ! docker compose pull --quiet >> "$LOG" 2>&1; then
  log "pull failed (offline, or GitHub unreachable)"
  status failed "Could not reach GitHub to check for a new build"
  exit 0
fi
new_api=$(img_id "$API_IMAGE")
new_web=$(img_id "$WEB_IMAGE")

# Nothing new, or containers already on these images.
if [ "$new_api" = "$run_api" ] && [ "$new_web" = "$run_web" ]; then status uptodate "Already up to date"; exit 0; fi

# A build that already failed its health check: keep the running one.
if [ -f "$BAD" ] && grep -qx "$new_api $new_web" "$BAD"; then
  docker tag "$run_api" "$API_IMAGE"; docker tag "$run_web" "$WEB_IMAGE"
  status uptodate "The newest build failed its health check before, so it was skipped"
  exit 0
fi

log "new build found: api ${new_api:7:12} web ${new_web:7:12}"
mkdir -p "$BACKUP_DIR"
backup="$BACKUP_DIR/data-$(date +%Y%m%d-%H%M%S).tar.gz"
if ! tar czf "$backup" data; then
  log "backup failed; not updating"
  status failed "The data backup failed, so nothing was changed"
  exit 1
fi
ls -1t "$BACKUP_DIR"/data-*.tar.gz | tail -n +$((KEEP_BACKUPS + 1)) | xargs -r rm -f
log "backed up data to $backup"

status updating "Installing the new build"
docker compose up -d >> "$LOG" 2>&1
if healthy; then
  log "updated and healthy"
  status updated "Updated and healthy"
  docker image prune -f >/dev/null 2>&1
  exit 0
fi

log "new build is not healthy: rolling back"
echo "$new_api $new_web" >> "$BAD"
if [ "$run_api" != none ] && [ "$run_web" != none ]; then
  docker tag "$run_api" "$API_IMAGE"
  docker tag "$run_web" "$WEB_IMAGE"
  docker compose up -d >> "$LOG" 2>&1
  if healthy; then
    log "rolled back and healthy"
    status rolledback "The new build did not start, so the previous one was put back"
  else
    log "rolled back but still not healthy: check 'docker compose logs api'"
    status failed "Rolled back, but the app is still not healthy: check the Pi"
  fi
fi
exit 1
