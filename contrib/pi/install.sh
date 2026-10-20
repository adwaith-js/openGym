#!/bin/bash
# One-time setup of openGym self-updates on the Pi. Run with sudo:
#   sudo bash install.sh           update only when "Update this server" is pressed in Settings
#   sudo bash install.sh daily     the same, plus a check once a day
# Installs the update script, a systemd path unit that starts it the moment the app asks, and
# turns the button on (SELF_UPDATE=1). Compose stops pulling on its own: the script decides when
# images change, so it can back up first and roll back after.
set -euo pipefail

APP_DIR="${APP_DIR:-/home/adwaith/apps/openGym}"
SRC="https://raw.githubusercontent.com/adwaith-js/openGym/feature/nutrition/contrib/pi"

curl -fsSL "$SRC/opengym-autoupdate.sh" -o /usr/local/bin/opengym-autoupdate
chmod 755 /usr/local/bin/opengym-autoupdate

cat > /etc/systemd/system/opengym-autoupdate.service <<UNIT
[Unit]
Description=Update openGym to the newest published images
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
Environment=APP_DIR=$APP_DIR
ExecStart=/usr/local/bin/opengym-autoupdate
UNIT

cat > /etc/systemd/system/opengym-autoupdate.path <<UNIT
[Unit]
Description=Start an openGym update when the app asks for one

[Path]
PathExists=$APP_DIR/data/update-request.json

[Install]
WantedBy=multi-user.target
UNIT

# The every-5-minutes timer from the first version goes; "daily" puts back a once-a-day check.
systemctl disable --now opengym-autoupdate.timer 2>/dev/null || true
rm -f /etc/systemd/system/opengym-autoupdate.timer
if [ "${1:-}" = daily ]; then
  cat > /etc/systemd/system/opengym-autoupdate.timer <<'UNIT'
[Unit]
Description=Check for new openGym images once a day

[Timer]
OnCalendar=*-*-* 04:00:00
Persistent=true

[Install]
WantedBy=timers.target
UNIT
fi

# Compose must not pull by itself: "always" would undo a rollback on the next restart.
sed -i 's/pull_policy: always/pull_policy: missing/' "$APP_DIR/docker-compose.override.yml"

# Turn the button on, and restart the api so it reads that.
grep -q '^SELF_UPDATE=' "$APP_DIR/.env" || echo 'SELF_UPDATE=1' >> "$APP_DIR/.env"
(cd "$APP_DIR" && docker compose up -d >/dev/null)

systemctl daemon-reload
systemctl enable --now opengym-autoupdate.path
[ "${1:-}" = daily ] && systemctl enable --now opengym-autoupdate.timer
# One update now: the build with the button may not be on the Pi yet.
echo "Updating once now (a minute or two)..."
systemctl start opengym-autoupdate.service || true
tail -n 3 "$APP_DIR/autoupdate.log" 2>/dev/null || true
echo "Installed. From now on: Settings → About → Update this server, in the app."
echo "Log: $APP_DIR/autoupdate.log"
