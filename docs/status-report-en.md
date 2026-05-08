# MINHA MÁQUINA — Telemetry Platform
## Technical Status Report & Roadmap
**Date:** May 8, 2026  
**Prepared by:** 4Safe Tecnologia  
**For:** NavorTech  

---

## 1. Overview

The MINHA MÁQUINA platform is a fleet telemetry system purpose-built for NavorTech's Bobcat construction equipment, tracked via VIRLOC VL06 and VL08 GPS devices. The platform covers the full data pipeline: from raw bytes transmitted by devices in the field, through to a web-based dashboard accessible by fleet operators.

The system is deployed on a production VPS at IP **38.247.130.26** and is currently live.

---

## 2. Architecture Summary

```
[VL06/VL08 Device]
       │  UDP / TCP  port 6600
       ▼
[XVM Ingest Gateway]          ← systemd service, always-on
       │  SQL (Drizzle ORM)
       ▼
[PostgreSQL — navortech DB]   ← single source of truth
       │  REST API (Express)
       ▼
[minhamaquina-api]            ← PM2 managed Node.js process, port 4001
       │  Nginx reverse proxy
       ▼
[MINHA MÁQUINA Dashboard]     ← React SPA, served via Nginx
       │  HTTPS (browser)
       ▼
[Fleet Operator]
```

---

## 3. Current Status — What Is Working

### 3.1 XVM Ingest Gateway ✅ Healthy

| Property | Value |
|----------|-------|
| Service name | `navortech-gateway.service` |
| Managed by | systemd (auto-starts on VPS reboot) |
| Protocol | UDP + TCP on port 6600 |
| Status | **Active / Running** |
| Database | `navortech` (PostgreSQL, localhost) |

The gateway is fully operational. It:
- Receives raw telemetry packets from VIRLOC VL06/VL08 trackers over UDP and TCP
- Splits and validates `>…<` frame envelopes with XOR-LRC checksum verification
- ACKs every valid device-originated frame to prevent retransmission storms
- Decodes report types: **RGP** (GPS position), **RUV00** (installation snapshot), **RUV01** (full telemetry), **RUV02** (end-of-trip), **RUV03** (periodic engine data)
- Persists each packet with full audit trail to PostgreSQL (packets → frames → reports_*)
- Updates the device's denormalized "latest state" (position, speed, hourmeter, ignition) on every received report
- Handles TCP stream fragmentation and 16-bit message number rollover
- Deduplicates retransmitted frames using advisory transaction locks

**Device activity as of today:**

| Device | Last Contact | Transport | Hourmeter |
|--------|-------------|-----------|-----------|
| PFDU | 2026-05-08 10:35 UTC | UDP | 5,328 min |
| PNMB | 2026-04-29 14:44 UTC | UDP | — |

PFDU is actively transmitting. PNMB has not been seen since April 29 — likely powered off or out of mobile coverage in the field.

### 3.2 Database ✅

| Property | Value |
|----------|-------|
| Engine | PostgreSQL (localhost) |
| Database name | `navortech` |
| Tables | `devices`, `packets`, `frames`, `reports_rgp`, `reports_ruv00–03`, `mm_users` |

The database schema mirrors the protocol decode pipeline. Indexes are optimized for "latest report per device" queries and fleet-wide time-window aggregations.

### 3.3 REST API ✅

| Property | Value |
|----------|-------|
| Framework | Express 5 |
| Process manager | PM2 (`minhamaquina-api`) |
| Port | 4001 (internal, proxied by Nginx) |
| Authentication | Email + password login → JWT (7-day session) |

Key endpoints:
- `GET /api/healthz` — liveness probe (public)
- `POST /api/auth/login` — issues JWT
- `GET /api/devices` — fleet device list with latest telemetry
- `GET /api/devices/:id` — device detail with paginated packets and reports
- `GET /api/devices/:id/packets` — packet history
- `GET /api/devices/:id/reports/rgp` — GPS report history
- `GET /api/devices/:id/reports/ruv00–03` — typed report history

### 3.4 Dashboard ✅

| Property | Value |
|----------|-------|
| Technology | React + Vite (SPA) |
| Served by | Nginx (static files) |
| Current URL | http://38.247.130.26 |
| Languages | Portuguese (default) / English |
| Themes | Dark Navy, Dark Amber, Light |

Dashboard pages:
- **Fleet Overview** — 5 KPI cards (active machines, system health, total fleet hours, maintenance status) + machine roster + live map + packet feed
- **Equipment** — grid view of all machines with per-device stats and status badges
- **Maintenance** — 500-hour cycle tracking table; overdue / upcoming / normal status per machine
- **Device Detail** — 7-tab layout: Packets, GPS/RGP, Street View, RUV00, RUV01, RUV02, RUV03
- **Street View** — Google Maps Street View panorama at device's last known GPS position

### 3.5 User Accounts ✅

| Email | Role |
|-------|------|
| `admin@minhamaquina.com` | Administrator |
| `pharrell.chatupa@4safetecnologia.com` | Operator |

---

## 4. Roadmap — What Needs to Be Done Next

### 4.1 Domain Name (Priority: High)
**Current state:** The platform is accessible only via bare IP (`http://38.247.130.26`).  
**Action required:** A domain name must be pointed at this server. Options:
- `minhamaquina.navortech.com.br` (NavorTech subdomain)
- `minhamaquina.4safetecnologia.com` (4Safe subdomain)
- A dedicated domain (e.g., `minhamaquina.com.br`)

NavorTech or the domain registrar must create an **A record** pointing to `38.247.130.26`. Once propagated (usually within minutes), step 4.2 can proceed immediately.

### 4.2 SSL/TLS Certificate — HTTPS (Priority: High)
**Current state:** Traffic is unencrypted HTTP. Login credentials are transmitted in plaintext.  
**Action required:** Issue a free Let's Encrypt certificate via Certbot. This takes approximately 5 minutes once the domain is live.

Commands to run on the VPS:
```bash
sudo certbot --nginx -d minhamaquina.navortech.com.br
```

This will automatically:
- Issue and install the TLS certificate
- Update the Nginx config to serve HTTPS on port 443
- Add a redirect from HTTP → HTTPS
- Schedule automatic certificate renewal

### 4.3 PNMB Device Investigation (Priority: Medium)
**Current state:** Device PNMB has not transmitted since April 29, 2026.  
**Action required:** Field investigation to confirm whether the unit is:
- Powered off / equipment not in use
- SIM card or mobile coverage issue
- Hardware fault on the VL06/VL08 unit

If the device is operational, the gateway will automatically pick up its transmissions with no configuration changes required.

### 4.4 Live Dashboard Refresh (Priority: Medium)
**Current state:** The dashboard data is loaded on page open and requires a manual browser refresh to show new packets.  
**Action required:** Implement server-sent events (SSE) or WebSocket push so the fleet overview and device detail pages update automatically as new packets arrive from the field.

### 4.5 API Token for Programmatic Access (Priority: Low)
**Current state:** The API accepts JWT (from login) or a static `API_READ_TOKEN` environment variable.  
**Action required:** Set a strong `API_READ_TOKEN` on the VPS PM2 config if NavorTech needs machine-to-machine API access (e.g., for integration with their ERP or reporting systems).

### 4.6 Monitoring & Alerting (Priority: Low)
**Current state:** PM2 and systemd provide basic crash recovery, but there is no proactive alerting.  
**Recommended additions:**
- Uptime monitor (e.g., UptimeRobot) on `https://[domain]/api/healthz`
- Alert when a device has not been seen for > 24 hours
- Alert on sustained gateway parse error rate

### 4.7 Backup Strategy (Priority: Low)
**Current state:** No automated database backups configured.  
**Action required:** Schedule nightly `pg_dump` of the `navortech` database to a secure remote location (S3, Backblaze, or SFTP).

---

## 5. Summary Table

| Item | Status | Next Action |
|------|--------|-------------|
| Gateway (VL06/VL08 ingest) | ✅ Live | None — healthy |
| Database (PostgreSQL) | ✅ Live | None |
| REST API | ✅ Live | Set API_READ_TOKEN if needed |
| Dashboard | ✅ Live | None |
| User accounts | ✅ Created | Add more accounts as needed |
| PFDU device | ✅ Active | None |
| PNMB device | ⚠️ Offline since Apr 29 | Field investigation |
| Domain name | ❌ Not configured | NavorTech to create DNS A record |
| HTTPS / SSL | ❌ Not configured | Certbot after domain is live |
| Live dashboard refresh | ❌ Not implemented | Planned feature |
| Monitoring | ❌ Not configured | Recommended |
| Database backups | ❌ Not configured | Recommended |

---

## 6. Contact

For technical questions regarding this platform, contact:  
**4Safe Tecnologia** — pharrell.chatupa@4safetecnologia.com
