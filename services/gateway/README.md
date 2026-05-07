# @workspace/gateway

NavorTech XVM ingest gateway — **Milestone 1: parse + ACK** (Milestone 0
raw-capture behaviour preserved alongside it).

This service binds a UDP socket and:

1. Appends every inbound datagram, untouched, to an NDJSON capture file
   (one line per datagram, evidence-before-decode per spec §13.6).
2. Splits each datagram into individual `>…<` frames (multi-message packets
   per spec §7).
3. Verifies the XOR-LRC `*XX` on each frame and rejects malformed ones with
   a clear log (no ACK is sent for a bad LRC, so the device will retransmit
   per spec §6).
4. Decodes the body for `RGP`, `RUV00`, `RUV01`, `RUV02`, `RUV03` into a
   typed report and emits one structured log line per frame.
5. Sends a matching `>ACK;ID=…;#…;*XX<` back to the sender's `rinfo` for
   every device-originated frame (msgnum < 0x8000), so the tracker stops
   retransmitting.

Persistence to Postgres and `(id, msgnum)` dedupe are scoped for Milestone 2.

## Environment

| Variable                | Default              | Notes                                     |
|-------------------------|----------------------|-------------------------------------------|
| `GATEWAY_PORT`          | `6600`               | UDP port to bind                          |
| `GATEWAY_HOST`          | `0.0.0.0`            | bind address                              |
| `GATEWAY_CAPTURE_FILE`  | `fixtures/xvm-live.txt` | resolved relative to `process.cwd()`  |
| `LOG_LEVEL`             | `info`               | pino level                                |
| `NODE_ENV`              | unset                | set to `production` to disable pretty log |

Invalid `GATEWAY_PORT` values cause the process to exit on startup. There are
no silent fallbacks for malformed configuration.

## Run locally

```bash
pnpm --filter @workspace/gateway run dev
```

## Replay test (offline)

The parser, framing, and ACK layers have an offline replay test that pumps
every line of `fixtures/xvm-live.txt` through `processDatagram` and asserts
each opcode decodes:

```bash
pnpm --filter @workspace/gateway run test
```

The fixture seeded in this repo is hand-rolled from the worked examples in
`vl06-protocol-spec.md` §6 / §8 / §9 with valid LRCs computed by the same
function the gateway uses to verify them. Once Milestone 0 produces a real
capture from `PNMB` (VL06) and `0592` (VL08), append those datagrams to the
same file and the test will exercise them automatically.

## Smoke test (live)

In another shell, send a real XVM frame at the listener:

```bash
echo -n '>RGP280426143501-2354123-046729800000003FF80FF00;ID=PNMB;#0001;*46<' \
  | nc -u -w1 127.0.0.1 6600
```

The gateway will reply with an ACK datagram:

```
>ACK;ID=PNMB;#0001;*4F<
```

…and `tail -n1 fixtures/xvm-live.txt` will show the raw inbound line.

## Production deployment (NavorTech VPS)

The service must run on the host that owns `38.247.130.26` — the public IP the
trackers were configured to send to. Turn-key deployment artifacts live in
[`deploy/`](./deploy/):

| File                            | Purpose                                                       |
|---------------------------------|---------------------------------------------------------------|
| `deploy/navortech-gateway.service` | systemd unit (Type=simple, Restart=always, hardened)        |
| `deploy/setup-vps.sh`           | idempotent bootstrap: Node 24, pnpm, build, unit install, ufw |
| `deploy/RUNBOOK.md`             | step-by-step runbook for Pablo / NavorTech ops                |

Quick start on the VPS (Ubuntu 22.04+):

```bash
# Clone to the canonical install path, then run the bootstrap
sudo mkdir -p /opt/navortech-gateway
sudo chown "$USER":"$USER" /opt/navortech-gateway
git clone <repo-url> /opt/navortech-gateway
sudo bash /opt/navortech-gateway/services/gateway/deploy/setup-vps.sh
```

After devices have been transmitting for ~15 minutes, scp the capture file
back and run the sanitizer to produce the committable golden corpus:

```bash
scp navortech@38.247.130.26:/var/lib/navortech-gateway/xvm-live.txt \
    fixtures/xvm-live.txt
pnpm --filter @workspace/gateway run sanitize-corpus
# Reads:  fixtures/xvm-live.txt          (gitignored — raw)
# Writes: services/gateway/test/fixtures/golden-corpus.txt   (committed)
```

The sanitizer in [`scripts/sanitize-corpus.ts`](./scripts/sanitize-corpus.ts):

- masks SIM ICCIDs in `RUV00` frames (keeps the 4-digit issuer prefix);
- fuzzes lat/lon in `RGP` and `RUV01` frames to a ~10 km grid (preserves
  sign, integer degrees, and the first fractional digit);
- recomputes the XOR-LRC over each rebuilt datagram (single-frame and
  multi-message) using the same primitive the live gateway and replay
  test use, and self-checks with `verifyChecksum` before writing.

## What this service is **not** doing yet

- No persistence to Postgres (frames decode and ACK fine, but `telemetry_raw`
  / `device_state` writes are Milestone 2).
- No `(id, msgnum)` dedupe — every retransmit is decoded and re-ACK'd.
- No outbound command tracking — server-originated responses (msgnum ≥
  `0x8000`) are logged but not correlated against any pending command.

Milestone 2 (persistence + idempotency) addresses all three.
