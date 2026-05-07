# NavorTech XVM Gateway — VPS Runbook

Target host: **`38.247.130.26`** (NavorTech VPS, Ubuntu 22.04+)
Service:     **`navortech-gateway.service`** (systemd, UDP/6600 + TCP/6600)
Owner:       NavorTech (work-for-hire by Safeon)
Devices:     VL06 = `PNMB` (UDP only), VL08 = `0592` (UDP or TCP)

The gateway listens on **both UDP/6600 and TCP/6600** simultaneously.
Per Leonardo Dias (vendor, Homologação NAVOR channel, 2026-04-29):
  - VL06 firmware is UDP-only.
  - VL08 firmware supports both; in TCP mode it sends the SAME XVM ASCII
    frames, with the only difference being that ACKs travel back over
    the originating TCP connection instead of as UDP datagrams.

This runbook is the only document Pablo needs to bring the gateway up,
verify it is ACKing live tracker traffic, and pull the capture file back
for sanitization.

---

## 1. First-time deploy (15 minutes)

```bash
# 1.1 SSH in as a sudoer
ssh <your-user>@38.247.130.26

# 1.2 Clone the repo to the canonical install path
sudo mkdir -p /opt/navortech-gateway
sudo chown "$USER":"$USER" /opt/navortech-gateway
git clone <repo-url> /opt/navortech-gateway

# 1.3 Run the bootstrap (installs Node 24, pnpm, builds, installs systemd unit,
#     opens ufw, starts the service)
sudo bash /opt/navortech-gateway/services/gateway/deploy/setup-vps.sh
```

The script is idempotent — re-run it any time you pull a new commit.

When it finishes you will see:

```
[setup-vps] Service is active ✓
[setup-vps] Last 20 log lines:
… "transport":"udp" … "msg":"XVM gateway listening (UDP)"
… "transport":"tcp" … "msg":"XVM gateway listening (TCP)"
```

Both `listening` lines together are the readiness signal. The capture file is
ready at `/var/lib/navortech-gateway/xvm-live.txt` — the service writes one
NDJSON line per inbound packet (UDP datagram OR TCP-recovered packet) and
one per outbound ACK. Each line carries a `"transport":"udp"|"tcp"` tag so
post-hoc analysis can tell them apart.

---

## 2. Verify the listener is healthy

```bash
# Service state
systemctl status navortech-gateway

# Live log stream (Ctrl-C to exit)
journalctl -u navortech-gateway -f

# Confirm BOTH sockets are bound (UDP + TCP on 6600)
sudo ss -lunp | grep 6600   # UDP
sudo ss -ltnp | grep 6600   # TCP
# expected:
#   UDP    0  0  0.0.0.0:6600   0.0.0.0:*    users:(("node",pid=...))
#   LISTEN 0  ?  0.0.0.0:6600   0.0.0.0:*    users:(("node",pid=...))

# Optional smoke tests from another shell on the VPS — both transports use
# the same known-good frame to isolate the wire from the parser.
# UDP path:
echo -ne '>RGP011120174312-3597296-062735570000080010A100012;ID=PNMB;#0001;*5A<\r\n' \
  | nc -u -w1 127.0.0.1 6600
# TCP path (same frame, different transport):
echo -ne '>RGP011120174312-3597296-062735570000080010A100012;ID=PNMB;#0001;*5A<\r\n' \
  | nc -w1 127.0.0.1 6600
# Watch journalctl — you should see one rx line and one matching ack line per
# probe, with "transport":"udp" or "transport":"tcp" respectively.
```

---

## 3. Bring real devices online

1. Confirm the VL06/VL08 trackers on the Bobcats are configured to send
   to `38.247.130.26:6600/UDP` (per the protocol spec, this is the
   VIRLOC dispatcher endpoint).
2. Ask Pablo to power on at least one Bobcat. The tracker boots in a few
   seconds and sends an `RGP` (login) frame. The gateway logs are pino
   JSON via journald — every inbound datagram is `"msg":"rx"` and every
   outbound ACK is `"msg":"ack sent"`. Watch them in real time:
   ```bash
   journalctl -u navortech-gateway -f -o cat | grep -E '"msg":"(rx|ack sent)"'
   ```
   (`-o cat` strips the journald metadata so the pino JSON line itself is
   what `grep` sees.)
3. Once the gateway ACKs the `RGP`, the device will start pushing
   `RUV00` (presentation), `RUV01` (basic data) and either `RUV02`
   (end-of-trip) or `RUV03` (CAN telemetry) — exactly which one of
   `RUV01` vs `RUV03` answers the open question in the spec §11
   (V1.2_PUL vs V1.2_CAN).
4. Let it run for **at least 15 minutes**, ideally with the operator
   driving the Bobcat (so we capture motion, idle, and ignition cycles).

---

## 4. Pull the capture file back for sanitization

From your local workstation:

```bash
mkdir -p fixtures
scp navortech@38.247.130.26:/var/lib/navortech-gateway/xvm-live.txt \
    fixtures/xvm-live.txt
```

Then run the sanitizer to produce the committable golden corpus
(masks SIM ICCIDs, fuzzes lat/lon to a ~10 km grid, recomputes the
XOR-LRC so the replay test still passes):

```bash
pnpm --filter @workspace/gateway run sanitize-corpus
# Reads:  fixtures/xvm-live.txt
# Writes: services/gateway/test/fixtures/golden-corpus.txt
```

`fixtures/xvm-live.txt` is gitignored. **Never commit the raw file.**
Only the sanitized `golden-corpus.txt` goes into the repo.

---

## 5. Common issues

| Symptom                                            | Diagnosis / Fix                                                                                                |
|----------------------------------------------------|----------------------------------------------------------------------------------------------------------------|
| `journalctl` shows `EADDRINUSE :::6600`            | Another process holds the port. `sudo ss -lunp \| grep 6600` to find it; stop or reassign before retrying.     |
| Devices send frames but you see no `rx` lines      | Firewall is dropping UDP. Check `sudo ufw status` and the cloud provider security group. Re-run `setup-vps.sh`. |
| `rx` lines but no matching `ack` lines             | Check the warn level: `journalctl -u navortech-gateway \| grep checksum_mismatch`. If LRCs don't match, that's a real protocol bug — capture the frame and escalate.|
| Service crash-loops on startup                     | `journalctl -u navortech-gateway -n 100`. Most likely the build didn't produce `dist/index.mjs`; rerun `setup-vps.sh`. |
| Capture file growing very large                    | Expected: roughly one report every 10–60 s per device. Rotate with `logrotate` if it exceeds a few hundred MB. |

---

## 6. Stop / uninstall

```bash
sudo systemctl stop navortech-gateway
sudo systemctl disable navortech-gateway
sudo rm /etc/systemd/system/navortech-gateway.service
sudo systemctl daemon-reload
# Capture file is preserved at /var/lib/navortech-gateway/xvm-live.txt
```
