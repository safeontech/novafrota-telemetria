# NavorTech Fleet Telemetry — Deployment Status & Current Blocker

**Prepared by:** Safeon (work-for-hire engineering, NavorTech-owned platform)
**Date:** April 29, 2026
**Server:** `38.247.130.26:6600` (Safeon-operated VPS, dedicated to NavorTech)
**Status:** Gateway fully deployed and listening. Awaiting one network change at the hosting provider before live device traffic can flow.

---

## Executive summary

The XVM ingest gateway built for the NavorTech / Bobcat fleet is **complete, deployed, and currently running** on the production server at `38.247.130.26`. It is healthy and ready to receive frames from VL06 (`PNMB`) and VL08 (`0592`) trackers.

We are blocked on a single, well-understood issue: the hosting provider that runs the network for `38.247.130.26` is silently dropping all inbound UDP traffic at their network edge — that is, before the packets ever reach our server. This is a default configuration on many Brazilian dedicated-server providers (UDP is filtered by default to prevent reflection attacks) and is corrected by a one-line ACL change on the provider's side.

**There is nothing NavorTech needs to do.** The trackers do not need to be re-flashed, re-pointed, or rebooted. Their existing destination of `38.247.130.26:6600` is exactly correct. As soon as the hosting-provider ACL is updated, telemetry will start landing within seconds — automatically, without any field action.

Safeon has already opened the support ticket with the hosting provider. Typical turnaround for this kind of request is **2–48 hours** depending on the provider's tier-1 queue.

---

## What's working today

| Component | Status |
| --- | --- |
| Gateway binary built and installed | ✓ `/opt/navortech-gateway` |
| `navortech-gateway.service` | ✓ active, will auto-restart on reboot |
| Listening socket | ✓ `0.0.0.0:6600/udp` (verified via `ss`) |
| Capture file | ✓ `/var/lib/navortech-gateway/xvm-live.txt` open in append mode |
| Frame parser (RGP, RUV00, RUV01, RUV02, RUV03) | ✓ |
| ACK transmitter (per spec §6) | ✓ devices will not retry once ACKed |
| Protocol checksum (XOR-LRC) verification | ✓ |
| Server-side firewall | ✓ inactive — not the cause of the block |
| Server hardening (systemd unit) | ✓ runs as unprivileged `navortech` user, restricted filesystem |

The gateway has been receiving zero datagrams not because it isn't ready, but because no datagrams are physically arriving at the server.

---

## What's blocking us

### What we observed

After deployment, we monitored the live UDP socket for several minutes. Zero packets arrived. To rule out the gateway code or the trackers, we then sent test UDP packets from a separate, known-good source (an external workstation) directly at `38.247.130.26:6600`, `:6601`, and `:22000`. **Every single test packet was lost** before reaching the server.

Meanwhile, TCP traffic to the same server (SSH on port 22) works flawlessly. The asymmetry — TCP fine, UDP lost on every port — is the textbook signature of a network-edge UDP filter applied by the hosting provider's upstream equipment.

### How we know it isn't on our side

We verified all three places a Linux server can drop traffic:

- The application: gateway is bound and idle, waiting for input.
- The OS firewall (`ufw`): `Status: inactive`.
- The kernel packet filters (`iptables`, `nftables`): both empty, default policy `ACCEPT`.

We then ran `tcpdump` directly on the network interface — this sits **below** the firewall in the Linux network stack, so even traffic that *would* be dropped by a local firewall is still visible to it. `tcpdump` reported `0 packets received by filter` over a full 60-second window. The packets aren't being dropped on the server; they aren't reaching the server.

### How we know it isn't on the trackers' side

The external test packets we sent — from a completely different network, with the gateway code uninvolved — were lost identically to the (presumably normal) packets the Bobcats are emitting. Anything from any source, on any UDP port, hitting `38.247.130.26` is being filtered upstream.

The trackers are almost certainly transmitting correctly. We just can't see them yet.

---

## The fix

The hosting provider must allow inbound UDP traffic on port 6600 to `38.247.130.26` from any source IP. This is a single ACL line on their network equipment. Once applied, no further action is needed from anyone — the gateway is already running and will pick up incoming frames immediately.

Safeon has filed this ticket with technical evidence (the `tcpdump` output, the routing table, the empty firewall counters) so the provider's NOC can validate it without back-and-forth. We will notify NavorTech the moment the change lands.

---

## Verification once the port opens

The moment the provider confirms the change, we will:

1. Send a test UDP probe to `38.247.130.26:6600` from an external machine and confirm it lands in the gateway's log within one second.
2. Watch the live journal for the first real device frames (`rx peer=...:... ascii=">RGP...;ID=PNMB;...<"`).
3. Send a sample to NavorTech showing that the trackers are emitting correctly and being ACKed.
4. Allow ~15 minutes of accumulation, then pull the capture file back, run our anonymization tool over it, and commit the resulting golden corpus into the test suite — locking in real device behavior as a regression baseline.

NavorTech does not need to be on a call for any of this. We will send a written confirmation with the first decoded frames as the milestone.

---

## What Safeon is building in parallel while we wait

The provider's ticket queue is the only thing holding back live traffic — the engineering work continues. While we wait, Safeon is starting **Milestone 2: telemetry persistence**:

- PostgreSQL schema for `machine`, `device`, `telemetry_raw`, and `device_state` (per the implementation guide §5)
- Drizzle ORM bindings and migration baseline
- Wiring the existing parser output into database writes (each parsed frame becomes one `telemetry_raw` row plus a `device_state` upsert)

When the network is unblocked and the first frame lands, it won't merely appear in a log file — it will land as queryable rows ready for the dashboard layer. No additional integration work between the listener and the database will be needed at that point.

---

## Summary of what's needed from each party

| Party | Action | Status |
| --- | --- | --- |
| Safeon | Build, deploy, harden gateway | ✅ Done |
| Safeon | Diagnose blocker, file provider ticket | ✅ Done |
| Safeon | Build database layer in parallel | ⏳ In progress |
| Hosting provider | Allow inbound UDP/6600 to 38.247.130.26 | ⏳ Awaiting response |
| NavorTech | (none) | — |
| Bobcat operators | (none) | — |

When the provider responds, the project resumes automatically.
