# NavorTech Platform

Fleet telemetry platform for the **NavorTech** Bobcat fleet, built on top of
**VIRLOC VL06 / VL08** GPS trackers speaking the **XVM ASCII** protocol.

> **Project owners**: NavorTech (operator) — built by Safeon as work-for-hire.
> **Tracker endpoint**: `38.247.130.26:6600` (VPS-hosted gateway).

---

## What this is

A monorepo (pnpm workspaces) containing every piece of the telemetry stack:

| Package / dir | Purpose |
|---|---|
| `services/gateway` | **XVM ingest gateway.** UDP+TCP listener on `:6600`. Splits frames, verifies XOR-LRC, decodes `RGP` / `RUV00..03`, ACKs every device-originated frame, persists to Postgres. |
| `lib/db` | Drizzle schema for the persistence layer: `devices`, `packets`, `frames`, `reports_{rgp,ruv00..03}`. |
| `lib/api-spec` | OpenAPI spec + Orval-generated client hooks and Zod schemas. |
| `services/api-server` | Express 5 read API in front of the persisted telemetry _(in progress)_. |
| `apps/*` | Frontend artifacts (fleet dashboard, ops console) _(in progress)_. |

---

## Hardware quick reference

| Model | Tracker ID prefix | Transport |
|---|---|---|
| **VL06** | `PNMB` | UDP only (firmware-locked) |
| **VL08** | `0592` | UDP **or** TCP — same XVM frames either way; in TCP mode the ACK travels back over the originating connection (confirmed by VIRLOC, Leonardo Dias, 2026-04-29). |

The gateway listens on both UDP and TCP on the same port and is transport-agnostic.

---

## Stack

- **Runtime**: Node.js 24
- **Package manager**: pnpm workspaces
- **Language**: TypeScript 5.9
- **Validation**: Zod (`zod/v4`) + `drizzle-zod`
- **Database**: PostgreSQL 16 + Drizzle ORM
- **API framework**: Express 5
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundles, single-file `dist/index.mjs`)
- **Test**: Vitest

---

## Common commands

```bash
pnpm run typecheck                                       # full repo typecheck
pnpm run build                                           # typecheck + build
pnpm --filter @workspace/api-spec run codegen            # regen API hooks + Zod
pnpm --filter @workspace/db run push                     # push schema (dev only)
pnpm --filter @workspace/gateway run dev                 # run gateway locally
pnpm --filter @workspace/gateway run test                # replay corpus tests
pnpm --filter @workspace/api-server run dev              # run read API locally
```

---

## Production deploy

The gateway runs as a systemd unit (`navortech-gateway.service`) on the
NavorTech VPS at `38.247.130.26`, owned by service user `navortech`, with
PostgreSQL 16 alongside on the same host (localhost-only bind).

Operational details — install paths, env file layout, backup schedule,
deploy procedure, rollback — are in
[`services/gateway/deploy/RUNBOOK.md`](./services/gateway/deploy/RUNBOOK.md).

---

## Known issues

Bugs, oddities, and deferred decisions are tracked in
[`KNOWN_ISSUES.md`](./KNOWN_ISSUES.md). Update it whenever something surprising
turns up so future work has the context.

---

## Milestones

- **M0** — UDP smoke-test gateway (no parsing, no ACK).
- **M1** — XVM parser + ACK + capture file. _Shipped to VPS._
- **M2** — Drizzle/Postgres schema for telemetry persistence.
- **M3** — Gateway → Postgres ingest sink (fire-and-forget, dedupe, latest-state projection). _Shipped to VPS, end-to-end verified._
- **M4** — Read API: fleet roster, latest position per device, history queries. _In progress._
- **M5** — Fleet dashboard frontend.
