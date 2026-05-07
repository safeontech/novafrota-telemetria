#!/usr/bin/env bash
# NavorTech Read API — one-shot VPS bootstrap (Ubuntu 22.04+).
#
# Idempotent: safe to re-run after every git pull. Mirrors the gateway
# bootstrap (services/gateway/deploy/setup-vps.sh) but builds the API
# bundle and installs the navortech-api systemd unit.
#
# What it does:
#   1. Verifies Node 24+ and pnpm are present (the gateway bootstrap
#      installs them; this script only checks).
#   2. Verifies the `navortech` system user already exists (created by
#      the gateway bootstrap).
#   3. Builds the api-server with `pnpm install --frozen-lockfile && pnpm build`.
#   4. Installs the systemd unit at /etc/systemd/system/navortech-api.service
#      and reloads systemd.
#   5. Creates /etc/navortech-api/env (mode 640, root:navortech) if missing.
#      You MUST populate it with DATABASE_URL and API_READ_TOKEN before the
#      service can serve real requests in production.
#   6. Enables and (re)starts navortech-api.service.
#   7. Tails journald for a few seconds and curls /healthz on loopback.
#
# Pre-conditions:
#   - Repo cloned to /opt/navortech-gateway (the gateway already lives there).
#   - Run as root (or with sudo).
#
# Usage:
#   sudo REPO_DIR=/opt/navortech-gateway bash artifacts/api-server/deploy/setup-vps.sh

set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/navortech-gateway}"
SVC_USER="navortech"
SVC_GROUP="navortech"
ENV_DIR="/etc/navortech-api"
ENV_FILE="${ENV_DIR}/env"
UNIT_SRC="${REPO_DIR}/artifacts/api-server/deploy/navortech-api.service"
UNIT_DST="/etc/systemd/system/navortech-api.service"
# Match the runtime currently powering the gateway on the VPS (Node 20.20.2
# as of M3 deploy). The api-server bundle is built locally, so the only
# requirement here is that the VPS Node can run the bundled output.
NODE_MIN_MAJOR=20

log()  { printf '\033[1;34m[setup-vps:api]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[setup-vps:api]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[setup-vps:api]\033[0m %s\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Run as root (sudo bash $0)"
[[ -d "$REPO_DIR" ]] || die "REPO_DIR=$REPO_DIR does not exist. Run the gateway bootstrap first."
[[ -f "$UNIT_SRC" ]] || die "Systemd unit not found at $UNIT_SRC"

# 1. Node + pnpm check (gateway bootstrap installs them; we only verify).
log "Checking Node.js >= ${NODE_MIN_MAJOR}…"
command -v node >/dev/null 2>&1 \
  || die "Node not installed. Run services/gateway/deploy/setup-vps.sh first."
CURR_MAJOR=$(node -p "process.versions.node.split('.')[0]")
(( CURR_MAJOR >= NODE_MIN_MAJOR )) \
  || die "Node v${CURR_MAJOR} too old. Run the gateway bootstrap to upgrade."
log "Node $(node -v) ✓"

command -v pnpm >/dev/null 2>&1 \
  || die "pnpm not installed. Run the gateway bootstrap first."
log "pnpm $(pnpm --version) ✓"

# 2. System user check
id -u "$SVC_USER" >/dev/null 2>&1 \
  || die "User $SVC_USER missing. Run the gateway bootstrap first (it creates the user)."
log "User $SVC_USER ✓"

# 3. Build (or accept a pre-built bundle scp'd into dist/).
#
# The bundle is fully self-contained (esbuild bundles everything except
# native modules we do not use), so the production deploy flow is to
# build locally and scp the dist/ directory into place — no pnpm install
# on the VPS needed. When a pre-built dist/ is present we skip the
# install + build to keep the bootstrap fast and to avoid touching the
# already-running gateway's node_modules.
DIST_FILE="${REPO_DIR}/artifacts/api-server/dist/index.mjs"
if [[ -s "$DIST_FILE" ]]; then
  log "Found pre-built bundle at $DIST_FILE ($(stat -c%s "$DIST_FILE") bytes) — skipping build."
else
  log "No pre-built bundle — installing dependencies and building api-server…"
  sudo -u "$SVC_USER" -H bash -c "cd '$REPO_DIR' && pnpm install --frozen-lockfile"
  sudo -u "$SVC_USER" -H bash -c "cd '$REPO_DIR' && pnpm --filter @workspace/api-server run build"
  [[ -f "$DIST_FILE" ]] \
    || die "Build did not produce dist/index.mjs — aborting before unit install."
fi

# 4. Systemd unit
log "Installing systemd unit at $UNIT_DST…"
install -m 0644 "$UNIT_SRC" "$UNIT_DST"
systemctl daemon-reload

# 5. Env file scaffold (do NOT clobber an existing one)
if [[ ! -f "$ENV_FILE" ]]; then
  log "Scaffolding $ENV_FILE — fill it in before exposing the API publicly."
  install -d -m 0750 -o root -g "$SVC_GROUP" "$ENV_DIR"
  cat > "$ENV_FILE" <<EOF
# NavorTech Read API runtime secrets.
# Populate before the API will serve authenticated requests.
#
# DATABASE_URL must point at the same Postgres the gateway writes to.
# API_READ_TOKEN must be a long random string (e.g. \`openssl rand -hex 32\`).
# Without API_READ_TOKEN the service will refuse all non-/healthz requests in
# production.

DATABASE_URL=
API_READ_TOKEN=
EOF
  chown root:"$SVC_GROUP" "$ENV_FILE"
  chmod 640 "$ENV_FILE"
else
  log "Env file $ENV_FILE already exists — leaving it alone."
fi

# 6. Enable & restart
log "Enabling and restarting navortech-api.service…"
systemctl enable navortech-api.service
systemctl restart navortech-api.service

# 7. Wait + smoke
sleep 2
if systemctl is-active --quiet navortech-api.service; then
  log "Service is active ✓"
else
  die "Service failed to start. Run: journalctl -u navortech-api -n 100 --no-pager"
fi

log "Smoke test on loopback (no token required for /healthz)…"
HEALTHZ_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/api/healthz || echo "000")
if [[ "$HEALTHZ_CODE" == "200" ]]; then
  log "/api/healthz returned 200 ✓"
else
  warn "/api/healthz returned $HEALTHZ_CODE — investigate with journalctl -u navortech-api -n 50"
fi

log "Last 20 log lines:"
journalctl -u navortech-api -n 20 --no-pager || true

cat <<EOF

[setup-vps:api] DONE.

Service status:  systemctl status navortech-api
Live log tail:   journalctl -u navortech-api -f
Stop / restart:  systemctl {stop,restart} navortech-api

Listener bound to 127.0.0.1:8080 — NOT directly reachable from the
public internet. To expose it externally, install a TLS reverse proxy
(Caddy or nginx) that forwards to http://127.0.0.1:8080.

Next steps:
  1. Edit $ENV_FILE and fill in DATABASE_URL + API_READ_TOKEN.
  2. systemctl restart navortech-api
  3. Test from another shell on the VPS:
       TOKEN=\$(grep ^API_READ_TOKEN $ENV_FILE | cut -d= -f2)
       curl -H "Authorization: Bearer \$TOKEN" http://127.0.0.1:8080/api/devices
EOF
