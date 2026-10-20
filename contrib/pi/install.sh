#!/bin/bash
# One-time setup of openGym auto-updates on the Pi. Run with sudo:
#   sudo bash install.sh
# Installs the update script and a systemd timer that runs it every 5 minutes, and stops
# compose from pulling on its own (the script decides when images change, so it can back up
# first and roll back after).
set -euo pipefail

APP_DIR="${APP_DIR:-/home/adwaith/apps/openGym}"
SRC="https://raw.githubusercontent.com/adwaith-js/openGym/feature/nutrition/contrib/pi"

curl -fsSL "$SRC/opengym-autoupdate.sh" -o /usr/local/bin/opengym-autoupdate
chmod 755 /usr/local/bin/opengym-autoupdate

cat > /etc/systemd/system/opengym-autoupdate.service <<EOF
[Unit]
Description=Update openGym when new images are published
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
Environment=APP_DIR=$APP_DIR
ExecStart=/usr/local/bin/opengym-autoupdate
EOF

cat > /etc/systemd/system/opengym-autoupdate.timer <<'EOF'
[Unit]
Description=Check for new openGym images every 5 minutes

[Timer]
OnBootSec=2min
OnUnitActiveSec=5min
Persistent=true

[Install]
WantedBy=timers.target
EOF

# Compose must not pull by itself any more: "always" would undo a rollback on the next restart.
sed -i 's/pull_policy: always/pull_policy: missing/' "$APP_DIR/docker-compose.override.yml"

systemctl daemon-reload
systemctl enable --now opengym-autoupdate.timer
systemctl start opengym-autoupdate.service || true
echo "Installed. Next check:"
systemctl list-timers opengym-autoupdate.timer --no-pager | head -3
echo "Log: $APP_DIR/autoupdate.log"
