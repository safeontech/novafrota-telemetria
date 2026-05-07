# NavorTech Read API — VPS Runbook

Target host: **`38.247.130.26`** (NavorTech VPS, Ubuntu 22.04+)
Service:     **`navortech-api.service`** (systemd, TCP/8080 on loopback)
Owner:       NavorTech (work-for-hire by Safeon)

This runbook covers the read-only HTTP API that backs the M5 dashboard.
The API reads from the same Postgres the `navortech-gateway` service
writes to, then serves devices, packets, and report streams over HTTP.

The unit binds to **127.0.0.1:8080** by design — it is **not** directly
reachable from the public internet. A TLS reverse proxy (Caddy or nginx)
must front it before external clients can hit it. Two layers of defence:

  1. **Network**: only loopback can connect to the upstream port.
  2. **Auth**: every endpoint except `/api/healthz` requires
     `Authorization: Bearer <API_READ_TOKEN>`.

If `API_READ_TOKEN` is unset in the env file the service responds 500
`server_misconfigured` to every authenticated request — fail-loud, never
silently open.

---

## 1. First-time deploy (assumes the gateway is already on the VPS)

```bash
# 1.1 SSH in as a sudoer and pull the latest commit
ssh <your-user>@38.247.130.26
cd /opt/navortech-gateway
sudo -u navortech git pull   # or scp the new commit; see KNOWN_ISSUES #2

# 1.2 Run the API bootstrap (idempotent — safe to re-run after every pull)
sudo bash /opt/navortech-gateway/artifacts/api-server/deploy/setup-vps.sh
```

The script will:
- Verify Node 20+ and pnpm (installed by the gateway bootstrap). The setup script enforces this; the API bundle is built and tested against Node 20.x to match the live VPS (currently v20.20.2). Bumping the floor requires editing both `setup-vps.sh` (`NODE_MIN_MAJOR`) and this runbook in lockstep.
- Build the API bundle into `artifacts/api-server/dist/` — or skip the build and reuse a pre-built `dist/` if one was scp'd ahead of time (see "Pre-built bundle deploy" below).
- Install `navortech-api.service`.
- Scaffold `/etc/navortech-api/env` with placeholders for `DATABASE_URL`
  and `API_READ_TOKEN` (mode 640, root:navortech). **The script does not
  fill these in — you do.**
- Enable + start the service.
- Curl `/api/healthz` on loopback as a smoke test.

---

## 2. Populate secrets

```bash
# Generate a long random token (record it in your password manager)
openssl rand -hex 32

# Edit the env file — DATABASE_URL is the same as the gateway's
sudo -e /etc/navortech-api/env

# Restart so the new env is loaded
sudo systemctl restart navortech-api
```

The env file:

```
DATABASE_URL=postgres://navortech_gw:<password>@127.0.0.1:5432/navortech
API_READ_TOKEN=<the-openssl-rand-output>
```

---

## 3. Verify the listener is healthy

```bash
# Service state
systemctl status navortech-api

# Live log stream (Ctrl-C to exit)
journalctl -u navortech-api -f

# Confirm the loopback socket is bound on TCP/8080
sudo ss -ltnp | grep 8080
# expected:
#   LISTEN 0  ?  127.0.0.1:8080   0.0.0.0:*   users:(("node",pid=...))

# Healthz (no token needed)
curl -s http://127.0.0.1:8080/api/healthz

# Authenticated read (replace TOKEN with the real value)
TOKEN=$(sudo grep ^API_READ_TOKEN /etc/navortech-api/env | cut -d= -f2)
curl -H "Authorization: Bearer $TOKEN" http://127.0.0.1:8080/api/devices
```

A correct production install returns:

- `/api/healthz` → `200 OK` with `{"ok":true,...}`
- `/api/devices` (no token) → `401 unauthorized`
- `/api/devices` (correct token) → `200 OK` with the device list

---

## 3b. Pre-built bundle deploy (current production flow)

The API bundle is fully self-contained (esbuild bundles every runtime
dependency we use into `dist/index.mjs`), so we do not run
`pnpm install --frozen-lockfile` on the VPS. Instead:

```bash
# locally
pnpm --filter @workspace/api-server run build
cd artifacts/api-server
tar czf /tmp/api-bundle.tgz dist deploy
scp /tmp/api-bundle.tgz $VPS_USER@$VPS_HOST:/tmp/

# on the VPS
sudo tar xzf /tmp/api-bundle.tgz -C /opt/navortech-gateway/artifacts/api-server/
sudo chown -R navortech:navortech /opt/navortech-gateway/artifacts/api-server/{dist,deploy}
sudo bash /opt/navortech-gateway/artifacts/api-server/deploy/setup-vps.sh
sudo systemctl restart navortech-api
```

`setup-vps.sh` is idempotent: it skips the build step when a non-empty
`dist/index.mjs` is already present, so the same script handles both
"from-source on the VPS" and "scp pre-built dist" workflows.

Rollback: keep the previous `dist/` as `dist.previous` before unpacking;
to roll back, `mv dist dist.failed && mv dist.previous dist && systemctl restart navortech-api`.

---

## 4. Front it with a TLS reverse proxy

Until a proxy is in place, the API is reachable only from the VPS itself.
The minimum-effort option is Caddy (auto-TLS via Let's Encrypt):

```caddy
api.navortech.example.com {
  reverse_proxy 127.0.0.1:8080
}
```

`/api/healthz` should be the proxy's health check. Do **not** strip the
`Authorization` header at the proxy — the upstream needs it.

---

## 5. Common issues

| Symptom                                            | Diagnosis / Fix                                                                                                |
|----------------------------------------------------|----------------------------------------------------------------------------------------------------------------|
| `curl /api/devices` returns 500 `server_misconfigured` | `API_READ_TOKEN` is not set in `/etc/navortech-api/env`. Set it and restart. |
| `curl /api/devices` returns 401 even with the right token | Header missing `Bearer ` prefix. Use `Authorization: Bearer <token>`. |
| `curl /api/healthz` connection refused             | Service not running. `systemctl status navortech-api` and `journalctl -u navortech-api -n 100`. |
| Service crash-loops on startup                     | Most likely the build didn't produce `artifacts/api-server/dist/index.mjs`. Rerun `setup-vps.sh`. |
| `/api/devices` returns 500 `internal_error`        | DB connection failed. Check `DATABASE_URL` in `/etc/navortech-api/env` and verify Postgres is up: `systemctl status postgresql`. |

---

## 6. Stop / uninstall

```bash
sudo systemctl stop navortech-api
sudo systemctl disable navortech-api
sudo rm /etc/systemd/system/navortech-api.service
sudo systemctl daemon-reload
# Env file at /etc/navortech-api/env is preserved — delete by hand if desired.
```

The gateway service is unaffected.
