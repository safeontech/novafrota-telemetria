# NavorTech Platform — Known Issues & Observations

Running log of bugs found, oddities observed, and decisions deferred.
Each entry: **what**, **where**, **discovered when**, **status**, **next step**.

---

## Open

### #2 — VPS install was not a git checkout

- **What**: The pre-existing `/opt/navortech-gateway` install on the VPS (from
  the M1 deploy) was `scp`'d directly, not cloned from a git repo. M3 deploy
  shipped only the `dist/` bundle the same way.
- **Where**: VPS at `38.247.130.26`, install path `/opt/navortech-gateway/`.
- **Discovered**: 2026-04-30, during M3 deploy.
- **Impact**: No way to know which exact source revision is running on the VPS
  short of checking the bundle hash. Future deploys also have to ship the
  whole bundle instead of `git pull`-ing.
- **Status**: Working as-is, but worth fixing eventually.
- **Next step**: Once code is in GitHub, convert the VPS install to a git
  checkout (`git init && git remote add origin … && git fetch && git reset
  --hard`), then deploys become `git pull && pnpm build && systemctl restart`.

### #3 — Validator anchored on Milestone 0

- **What**: The auto-validator that runs at task completion grades all gateway
  changes against the Milestone 0 spec (UDP-only smoke test, no parsing, no
  ACK, no DB), and flags everything from M1+ as "out of scope".
- **Where**: Project task validation pipeline (Replit-side, not in this repo).
- **Discovered**: 2026-04-29 (M2 task), again 2026-04-30 (M3 task).
- **Impact**: M2 and M3 tasks both had to be marked complete with
  `skip_validation_reason`.
- **Status**: Workaround in place.
- **Next step**: If the validator becomes blocking for future milestones,
  update the validator config to point at the current milestone spec instead
  of M0.

### #5 — Two Zod versions in the workspace; easy to mix up

- **What**: The Orval codegen emits `import * as zod from "zod"` (Zod v3
  surface), while hand-written schemas in `lib/db` and `services/gateway` use
  `import { z } from "zod/v4"`. The two `ZodError` classes are not
  `instanceof`-compatible, and `zod` v3 query parameter coercion has to be
  explicitly opted into per type (`coerce: { query: ['boolean','number','string','date'] }`
  in `lib/api-spec/orval.config.ts` — `'date'` was missing initially, which
  caused every cursor request to 400 with "Expected date, received string").
- **Where**: `artifacts/api-server/src/middlewares/errors.ts` (now imports
  `ZodError` from `"zod"` to match the throwing path),
  `lib/api-spec/orval.config.ts` (date coercion enabled).
- **Discovered**: 2026-04-30, during M4 read-API smoke testing.
- **Impact**: Currently green — both pitfalls are handled. Future Orval
  config bumps or new endpoints with non-trivial query params should keep an
  eye on the `coerce` array.
- **Status**: Resolved; documented here so the same trap isn't re-set.
- **Next step**: Long-term, pick one Zod version. Migrating to v4 everywhere
  requires Orval to support v4 (track the upstream); migrating to v3
  everywhere means giving up `drizzle-zod`'s v4 features.

### #6 — No deploy provenance (commit SHA / dist hash) recorded on the VPS

- **What**: When we scp a pre-built `dist/index.mjs` and run `setup-vps.sh`,
  the only check is "file exists and is non-empty". There is no record on
  the VPS of which git SHA the bundle was built from, or its SHA-256, so
  diagnosing "which build is actually running in production" requires
  trusting whoever last deployed.
- **Where**: `artifacts/api-server/deploy/setup-vps.sh`,
  `services/gateway/deploy/setup-vps.sh` (same gap).
- **Discovered**: 2026-04-30 architect review of API deploy.
- **Impact**: Operational, not security. If we ship a regression we cannot
  prove from the VPS what's running until we re-tar a new bundle locally
  and diff hashes. Rollback is also "by convention" (move dist.previous).
- **Next step**: Have the local build write `dist/RELEASE.json`
  (`{ commit, builtAt, sha256 }`), include it in the tarball, and have
  `setup-vps.sh` log it before restart. Cheap, ~30 lines.

---

### #7 — `DATABASE_URL` is duplicated across `/etc/navortech-gateway/env` and `/etc/navortech-api/env`

- **What**: Both services need the same Postgres URL, so I copied it from
  the gateway's env file into the API's env file at deploy time. Two
  copies of the same secret means rotation requires editing two files
  and restarting two units, with a real chance of drift.
- **Where**: `/etc/navortech-gateway/env`, `/etc/navortech-api/env` on the
  VPS; `services/gateway/deploy/setup-vps.sh`,
  `artifacts/api-server/deploy/setup-vps.sh`.
- **Discovered**: 2026-04-30 architect review of API deploy.
- **Impact**: Low today (single Postgres role, no rotation pressure). Will
  bite us the first time we rotate DB credentials.
- **Next step**: Introduce `/etc/navortech/shared-db.env` containing
  `DATABASE_URL` only, mode `0640 root:navortech`. Have both unit files
  reference it via `EnvironmentFile=-/etc/navortech/shared-db.env`
  *before* their service-specific env file. Service-specific files keep
  only the per-service secrets (`API_READ_TOKEN` for the API, nothing
  extra for the gateway today).

---

### #4 — Three replay tests fail locally (missing live capture)

- **What**: `services/gateway/test/replay.test.ts` cases
  ("every opcode in the corpus decodes correctly", "RUV01 hourmeter decodes",
  "RGP lat/lon decode to plausible values") fail because
  `services/gateway/test/fixtures/xvm-live.txt` is not committed (it's the
  live VPS capture file with sensitive data).
- **Where**: `services/gateway/test/replay.test.ts`,
  `services/gateway/test/fixtures/`.
- **Discovered**: M1 → still open through M3.
- **Impact**: 3 of 59 tests show as failing locally and in CI. Coverage gap
  for end-to-end opcode decoding.
- **Status**: Pre-existing, untouched by M3.
- **Next step**: Pull capture file from
  `/var/lib/navortech-gateway/xvm-live.txt`, run
  `services/gateway/scripts/sanitize-corpus.ts` (masks ICCIDs, fuzzes lat/lon
  to ~10 km grid, recomputes XOR-LRCs), commit the sanitized output as
  `services/gateway/test/fixtures/golden-corpus.txt`, point the replay tests
  at it. This will also resolve issue #1 (real packet fixture for parser
  verification).

---

### #9 — Gateway silently drops all packets when `DATABASE_URL` is unset

- **What**: When the gateway boots without `DATABASE_URL`, the dual-transport
  listener still binds and ACKs every device — but `db-sink` is wired to
  `NULL_DB_SINK`, so nothing is persisted. The capture file on disk is the
  only record, and there is only a single one-line `WARN` in the logs.
- **Where**: `services/gateway/src/index.ts` lines 105–114.
- **Discovered**: 2026-04-30, while investigating why the production VPS DB
  was empty despite 729 real frames received Apr 29 13:16–14:44 UTC from
  device PNMB. Root cause: VPS env file had no `DATABASE_URL` for that
  window.
- **Impact**: Real device data was lost from the DB for ~1.5 hours.
  Recovery required replaying the capture file (`xvm-live.txt`).
- **Status**: Open. Recovery completed (dev + VPS DBs both backfilled with
  the 736 real PNMB packets via `services/gateway/scripts/replay-capture.ts`).
- **Next step**: Make the gateway fail-fast when running in production
  (`NODE_ENV === "production"`) and `DATABASE_URL` is unset — refuse to bind
  the sockets and exit non-zero, matching the API server's behavior. Keep
  the dev no-DB mode as today (warn + continue).

---

## Resolved

### #8 — `db-sink` blew up on packets with trailing NUL bytes — RESOLVED 2026-04-30

- **What**: 608 of 741 real packets in the recovered VPS capture file had
  trailing `\u0000` padding (UDP buffer slack). Postgres `TEXT` rejects
  embedded NULs, so every persistence attempt threw
  `invalid byte sequence for encoding "UTF8": 0x00` and the packet was
  dropped.
- **Where**: `services/gateway/src/db-sink.ts`, `beginPacket()`.
- **Discovered**: 2026-04-30, during `replay-capture.ts` of the 1486-line
  capture file: only 123/741 rx packets persisted on the first replay.
- **Status**: **Fixed** — `beginPacket()` now strips
  `[\u0000\uFEFF]` from `args.ascii` defensively before insert. Re-replay
  lands all 741 packets clean (724 ok + 3 bad checksum + 9 duplicate-msgnum,
  matching the parser's view of the corpus).

---

## Older Resolved

### #1 — RGP body field mapping looks shifted (probable parser bug) — RESOLVED 2026-04-30

- **What was reported**: A synthetic packet sent during M3 deploy verification
  produced `last_speed_kmh = 321` from a body field whose raw value was `15`,
  and NULL lat/lon for a body containing `-23123456,-46654321` in the
  expected lat/lon positions. Reported test packet:
  `>RGP180826144632,-23123456,-46654321,180,15,1,80,2;ID=TST1;#0001;*2A<`
- **Root cause**: The synthetic test packet was malformed, not the parser.
  Spec §9.2 says RGP is a *packed* body (`ddmmyy + hhmmss + lat(8) + lon(9)
  + speed(3) + dir(3) + gps(1) + sincefix(2) + dimask(2) + reserved(2)
  + hdop(2)`), no commas. The CSV-shaped synthetic packet caused
  fixed-width slicing to land on `321` (three consecutive digits inside
  `15,1,80`) for the speed field. The real live capture in
  `services/gateway/fixtures/xvm-live.txt` decodes correctly:
  `>RGP011120174312-3597296-062735570000080010A100012;...` →
  `lat=-35.97296, lon=-62.73557, speed=0, heading=8°, ts=2020-11-01T17:43:12Z`.
- **What changed**:
  1. `services/gateway/src/parser.ts#decodeRGP` now early-returns when the
     post-opcode payload contains a comma. Spec-conformant packets are
     unaffected; malformed CSV-shaped bodies (the KI #1 reproduction case)
     now yield an empty `RgpReport` instead of silently extracting numbers
     from comma-shifted slices.
  2. New `services/gateway/test/parser-decoders.test.ts` pins both the
     spec §9.2 worked example AND the real PNMB live-capture packet, plus
     a KI #1 reproduction test that locks in the new defense.
- **What did NOT change**: `decodeLat`, `decodeLon`, `decodeDigitalInputs`,
  and the per-opcode field offsets are all correct against spec §9.2 and
  §13.3 — verified against the real live packet.

---
