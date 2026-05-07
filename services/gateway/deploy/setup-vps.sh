#!/usr/bin/env bash
# NavorTech XVM Gateway — one-shot VPS bootstrap (Ubuntu 22.04+).
#
# Idempotent: re-running is safe. Each step checks current state before
# acting and either skips or upgrades in place.
#
# What it does:
#   1. Verifies Node 24+ and pnpm are installed (installs them if missing).
#   2. Creates the `navortech` system user/group.
#   3. Creates /opt/navortech-gateway (code) and /var/lib/navortech-gateway
#      (capture corpus). Sets ownership.
#   4. Builds the gateway with `pnpm install --frozen-lockfile && pnpm build`.
#   5. Installs the systemd unit and reloads systemd.
#   6. Opens UDP/6600 in ufw if ufw is active.
#   7. Enables and (re)starts navortech-gateway.service.
#   8. Tails journald for 5s so you can confirm the listening line.
#
# Pre-conditions (run by hand once):
#   - Repo cloned to /opt/navortech-gateway (or REPO_DIR env var).
#   - Run as root (or with sudo).
#
# Usage:
#   sudo REPO_DIR=/opt/navortech-gateway bash services/gateway/deploy/setup-vps.sh

set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/navortech-gateway}"
SVC_USER="navortech"
SVC_GROUP="navortech"
DATA_DIR="/var/lib/navortech-gateway"
UNIT_SRC="${REPO_DIR}/services/gateway/deploy/navortech-gateway.service"
UNIT_DST="/etc/systemd/system/navortech-gateway.service"
NODE_MIN_MAJOR=24

log()  { printf '\033[1;34m[setup-vps]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[setup-vps]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[setup-vps]\033[0m %s\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Run as root (sudo bash $0)"
[[ -d "$REPO_DIR" ]] || die "REPO_DIR=$REPO_DIR does not exist. Clone the repo there first."
[[ -f "$UNIT_SRC" ]] || die "Systemd unit not found at $UNIT_SRC"

# 1. Node 24+
log "Checking Node.js >= ${NODE_MIN_MAJOR}…"
if ! command -v node >/dev/null 2>&1; then
  log "Node not found — installing via NodeSource…"
  curl -fsSL https://deb.nodesource.com/setup_${NODE_MIN_MAJOR}.x | bash -
  apt-get install -y nodejs
else
  CURR_MAJOR=$(node -p "process.versions.node.split('.')[0]")
  if (( CURR_MAJOR < NODE_MIN_MAJOR )); then
    log "Node v${CURR_MAJOR} too old — upgrading to v${NODE_MIN_MAJOR}…"
    curl -fsSL https://deb.nodesource.com/setup_${NODE_MIN_MAJOR}.x | bash -
    apt-get install -y nodejs
  else
    log "Node $(node -v) ✓"
  fi
fi

# pnpm via corepack (ships with Node)
log "Enabling pnpm via corepack…"
corepack enable
corepack prepare pnpm@latest --activate

# 2. System user
if id -u "$SVC_USER" >/dev/null 2>&1; then
  log "User $SVC_USER exists ✓"
else
  log "Creating system user $SVC_USER…"
  useradd --system --shell /usr/sbin/nologin --home-dir "$DATA_DIR" --create-home "$SVC_USER"
fi

# 3. Directories
log "Ensuring $DATA_DIR exists with correct ownership…"
mkdir -p "$DATA_DIR"
chown -R "$SVC_USER:$SVC_GROUP" "$DATA_DIR"
chmod 750 "$DATA_DIR"

log "Setting ownership of $REPO_DIR to $SVC_USER…"
chown -R "$SVC_USER:$SVC_GROUP" "$REPO_DIR"

# 4. Build
log "Installing dependencies and building gateway…"
sudo -u "$SVC_USER" -H bash -c "cd '$REPO_DIR' && pnpm install --frozen-lockfile"
sudo -u "$SVC_USER" -H bash -c "cd '$REPO_DIR' && pnpm --filter @workspace/gateway run build"

[[ -f "${REPO_DIR}/services/gateway/dist/index.mjs" ]] \
  || die "Build did not produce dist/index.mjs — aborting before unit install."

# 5. Systemd unit
log "Installing systemd unit at $UNIT_DST…"
install -m 0644 "$UNIT_SRC" "$UNIT_DST"
systemctl daemon-reload

# 6. Firewall (only if ufw is the active firewall).
#    UDP/6600 = VL06 (PNMB) + VL08 (0592) when configured for UDP.
#    TCP/6600 = VL08 (0592) when configured for TCP — see RUNBOOK §3.
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  log "Opening UDP/6600 + TCP/6600 in ufw…"
  ufw allow 6600/udp comment "NavorTech XVM gateway (VL06/VL08 UDP)"
  ufw allow 6600/tcp comment "NavorTech XVM gateway (VL08 TCP)"
else
  warn "ufw not active — make sure UDP/6600 AND TCP/6600 are open in your VPS firewall (38.247.130.26)."
fi

# 7. Enable & restart
log "Enabling and restarting navortech-gateway.service…"
systemctl enable navortech-gateway.service
systemctl restart navortech-gateway.service

# 8. Wait + tail
sleep 2
if systemctl is-active --quiet navortech-gateway.service; then
  log "Service is active ✓"
else
  die "Service failed to start. Run: journalctl -u navortech-gateway -n 100 --no-pager"
fi

log "Last 20 log lines:"
journalctl -u navortech-gateway -n 20 --no-pager || true

cat <<EOF

[setup-vps] DONE.

Capture file:    $DATA_DIR/xvm-live.txt
Service status:  systemctl status navortech-gateway
Live log tail:   journalctl -u navortech-gateway -f
Stop / restart:  systemctl {stop,restart} navortech-gateway

Next: ask Pablo to power on a Bobcat. Watch the log — you should see lines like:
  rx     peer=<tracker-ip>:<port> bytes=<n>  ascii=">RGP…;ID=PNMB;#0001;*..<"
  ack    peer=<...>               ascii=">ACK;ID=PNMB;#0001;*..<"

After ~15 minutes of activity, scp the capture file back:
  scp navortech@38.247.130.26:$DATA_DIR/xvm-live.txt ./fixtures/xvm-live.txt

Then run the sanitizer locally to produce the committable golden corpus:
  pnpm --filter @workspace/gateway run sanitize-corpus
EOF
