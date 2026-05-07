// DB persistence sink for the gateway (Milestone 3).
//
// Wires the receive path into the Drizzle schema:
//
//   inbound bytes  ──► packets       (always — even rejects, for the audit tape)
//                  ╠═► frames        (only when parse status = ok and not a dup)
//                  ╠═► reports_*     (one row per opcode, decoded body)
//                  ╚═► devices       (upsert + denormalized "latest state")
//
// Design constraints (called out so downstream readers don't have to guess):
//
//   1. The hot RX path in `handler.ts` MUST stay synchronous and MUST NOT
//      be blocked by DB writes. Devices need quiet ACKs even when Postgres
//      is unreachable; the NDJSON capture file remains the durable backup.
//      So `beginPacket` returns *synchronously* with a `PacketHandle`, and
//      all DB work runs inside `void Promise` chains attached to that
//      handle. Errors are logged, never thrown back to the caller.
//
//   2. Dedup is application-layer, single-process: spec §6.1 says a device
//      that doesn't see our ACK retries the SAME (id, msgnum). We look up
//      the recent `frames` table via the `frames_device_msgnum_received_idx`
//      index. If we find one within `dedupeWindowMs`, we still persist the
//      `packets` row (status=`duplicate`, so dashboards can see retry storms)
//      but skip the frames + reports inserts so the body isn't double-counted.
//
//   3. The `(packets, frames, reports_*, devices)` writes for a NEW frame
//      run inside one transaction. If any insert fails the whole packet is
//      rolled back — better to lose one packet than to leave half-decoded
//      garbage in the report tables.
//
//   4. Multi-message packets (spec §7) produce multiple `frames` rows, but
//      only the trailer-bearing frame drives reports + device-latest update.
//      The inner frames are persisted with `is_trailer=false` and no body
//      decode (their opcode is captured but the body has no header to mine).
//
//   5. ACK metadata (`acked_at`, `ack_ascii`) is filled in via a chained
//      UPDATE after the transport callback fires. The chain is held on the
//      same `PacketHandle` so race conditions with the insert are impossible
//      — the UPDATE awaits the insert promise.

import { and, eq, gt, sql } from "drizzle-orm";
import type { db as Db } from "@workspace/db";
import {
  devicesTable,
  framesTable,
  packetsTable,
  reportsRgpTable,
  reportsRuv00Table,
  reportsRuv01Table,
  reportsRuv02Table,
  reportsRuv03Table,
} from "@workspace/db";

import { logger } from "./lib/logger.js";
import { decodeReport, type FrameEnvelope } from "./parser.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ParseStatus =
  | "ok"
  | "no_frames"
  | "checksum_mismatch"
  | "no_trailer"
  | "response_to_command"
  | "duplicate";

export interface BeginPacketArgs {
  receivedAt: Date;
  peer: string;
  transport: "udp" | "tcp";
  bytes: number;
  ascii: string;
  /** Trailer-bearing envelopes parsed from the packet (in arrival order).
   * Inner command echoes (multi-message, spec §7) have no trailer and are
   * NOT included here — they live verbatim in `ascii` only. */
  frames: FrameEnvelope[];
  /** Total `>…<` block count from the raw splitter, including the inner
   * command-echo frames that carry no trailer. Used as the schema's
   * `frame_count` so the audit row reflects what hit the wire, not what
   * the envelope parser kept. */
  rawFrameCount: number;
  /** The trailer frame, if any (spec §7) — drives the ACK + report decode. */
  trailer: FrameEnvelope | null;
  /** Result of the whole-packet checksum verification (only meaningful when `trailer` is set). */
  checksumOk: boolean;
}

export interface PacketHandle {
  /** Mark the packet as ACKed. Chains onto the insert promise. */
  markAcked(ackAscii: string, ackedAt: Date): void;
  /** Resolves when all pending DB ops for this packet have finished (used in shutdown + tests). */
  done(): Promise<void>;
}

export interface DbSink {
  beginPacket(args: BeginPacketArgs): PacketHandle;
  /** Wait for all in-flight packet writes to complete (graceful shutdown). */
  shutdown(timeoutMs?: number): Promise<void>;
}

export interface DbSinkOptions {
  /**
   * How far back to look for a duplicate (device_id, msgnum) in `frames`.
   * Spec §6.1 leaves the retry window unbounded but in practice trackers
   * give up within seconds. 60s is conservative — covers a long retry
   * burst without risking false-positive collisions when msgnum wraps
   * around 0x8000 (which would take >> 60s of normal traffic).
   */
  dedupeWindowMs?: number;
}

const DEFAULT_DEDUPE_WINDOW_MS = 60_000;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function makeDbSink(
  db: typeof Db,
  opts: DbSinkOptions = {},
): DbSink {
  const dedupeWindowMs = opts.dedupeWindowMs ?? DEFAULT_DEDUPE_WINDOW_MS;

  // Track every in-flight packet promise so shutdown can wait on them.
  const inflight = new Set<Promise<unknown>>();
  const track = <T>(p: Promise<T>): Promise<T> => {
    inflight.add(p);
    p.finally(() => inflight.delete(p));
    return p;
  };

  function beginPacket(args: BeginPacketArgs): PacketHandle {
    // Postgres TEXT columns reject NUL bytes (0x00) as invalid UTF-8. UDP
    // datagrams from VL06/VL08 trackers are commonly null-padded by the
    // network stack, so strip them here before any insert. Strip ZWNBSP
    // (BOM) too while we're at it. The original byte length stays in
    // `args.bytes` so wire-level diagnostics are unaffected.
    const sanitizedArgs: BeginPacketArgs = {
      ...args,
      ascii: args.ascii.replace(/[\u0000\uFEFF]/g, ""),
    };
    args = sanitizedArgs;
    // Resolves to the inserted packet UUID, or null when the insert failed
    // (we only INSERT on a non-rejected DB connection — error is logged and
    // the chain just no-ops downstream operations).
    const insertPromise: Promise<string | null> = track(
      runInsert(db, args, dedupeWindowMs).catch((err) => {
        logger.error(
          {
            err,
            peer: args.peer,
            transport: args.transport,
            bytes: args.bytes,
          },
          "db-sink: packet insert failed",
        );
        return null;
      }),
    );

    function markAcked(ackAscii: string, ackedAt: Date): void {
      const p = insertPromise.then(async (packetId) => {
        if (!packetId) return; // Insert failed; nothing to update.
        try {
          await db
            .update(packetsTable)
            .set({ ackedAt, ackAscii })
            .where(eq(packetsTable.id, packetId));
        } catch (err) {
          logger.error(
            { err, packetId, ackAscii },
            "db-sink: ack metadata update failed",
          );
        }
      });
      track(p);
    }

    return {
      markAcked,
      done: () => insertPromise.then(() => undefined),
    };
  }

  async function shutdown(timeoutMs = 5_000): Promise<void> {
    if (inflight.size === 0) return;
    logger.info(
      { pending: inflight.size, timeoutMs },
      "db-sink: waiting for pending writes",
    );

    // Drain in a loop: `markAcked` chains an UPDATE *after* its insert
    // promise settles, so new promises can be added to `inflight` while
    // we're already waiting. A single `Promise.allSettled([...inflight])`
    // would ignore those. Loop until either the set is empty or the
    // budget is gone, taking a fresh snapshot each iteration so late
    // ACK-metadata updates aren't dropped.
    const deadline = Date.now() + timeoutMs;
    while (inflight.size > 0) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) break;
      let timedOut = false;
      await Promise.race([
        Promise.allSettled([...inflight]),
        new Promise<void>((resolve) =>
          setTimeout(() => {
            timedOut = true;
            resolve();
          }, remaining),
        ),
      ]);
      if (timedOut) break;
    }

    if (inflight.size > 0) {
      logger.warn(
        { abandoned: inflight.size },
        "db-sink: shutdown timed out — abandoning pending writes",
      );
    }
  }

  return { beginPacket, shutdown };
}

// ---------------------------------------------------------------------------
// The actual insert path. Pure async; all error-logging happens in the
// caller wrapper. Returns the inserted packet UUID, or null when no row
// was inserted (currently never — even the "no trailer" path inserts a
// packet — but the type allows future "drop on the floor" branches).
// ---------------------------------------------------------------------------

async function runInsert(
  db: typeof Db,
  args: BeginPacketArgs,
  dedupeWindowMs: number,
): Promise<string> {
  const status = computeStatus(args);

  // Path 1 — non-trailer outcomes. Insert just the packet row, no device
  // upsert (we don't have a reliable id), no frames/reports.
  if (
    status === "no_frames" ||
    status === "checksum_mismatch" ||
    status === "no_trailer"
  ) {
    const [row] = await db
      .insert(packetsTable)
      .values({
        receivedAt: args.receivedAt,
        peer: args.peer,
        transport: args.transport,
        bytes: args.bytes,
        ascii: args.ascii,
        parseStatus: status,
        frameCount: args.rawFrameCount,
      })
      .returning({ id: packetsTable.id });
    return row!.id;
  }

  // From here on we have a trailer frame with id + msgnum.
  const trailer = args.trailer!;
  const deviceId = trailer.id;
  const msgnum = trailer.msgnum;

  // Path 2 — server-originated response. We log it for completeness but
  // there are no reports to decode and no device-latest update to do (the
  // RX timestamp doesn't reflect the device's clock here).
  if (status === "response_to_command") {
    await upsertDeviceContact(db, deviceId, args);
    const [row] = await db
      .insert(packetsTable)
      .values({
        receivedAt: args.receivedAt,
        peer: args.peer,
        transport: args.transport,
        bytes: args.bytes,
        ascii: args.ascii,
        parseStatus: status,
        frameCount: args.rawFrameCount,
        deviceId,
        msgnum,
      })
      .returning({ id: packetsTable.id });
    return row!.id;
  }

  // Paths 3 + 4 — dedupe + insert under a single transaction guarded by a
  // Postgres advisory transaction lock keyed on `(deviceId, msgnum)`.
  //
  // Why the lock: the previous design did SELECT-then-INSERT outside any
  // transaction, which races even in a single Node.js process. Two
  // packets with the same `(deviceId, msgnum)` arriving back-to-back can
  // both pass the SELECT before either commits its frames row, producing
  // double-decoded reports. The advisory lock serializes work on the
  // same key; concurrent callers wait until the holder commits, then
  // re-check. The lock is released automatically at COMMIT/ROLLBACK
  // (`pg_advisory_xact_lock`), so we don't need explicit cleanup.
  //
  // Lock key: 64-bit signed integer derived from a stable hash of
  // `<deviceId>:<msgnum>`. We use Postgres' `hashtextextended` for
  // determinism + uniform distribution. `deviceId` and `msgnum` are
  // ASCII so this is collision-equivalent to hashing them concatenated.
  const dedupeCutoff = new Date(args.receivedAt.getTime() - dedupeWindowMs);

  return await db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${deviceId}:${msgnum}`}, 0))`,
    );

    // Now safe to dedupe-check inside the transaction; any concurrent
    // packet with the same key is blocked behind us on the advisory lock.
    const dup = await tx
      .select({ id: framesTable.id })
      .from(framesTable)
      .where(
        and(
          eq(framesTable.deviceId, deviceId),
          eq(framesTable.msgnum, msgnum),
          gt(framesTable.receivedAt, dedupeCutoff),
        ),
      )
      .limit(1);

    if (dup.length > 0) {
      // Duplicate — device retried because it didn't see our prior ACK.
      // Persist the audit-tape packet with status=duplicate, but skip the
      // frames + reports inserts. The device upsert still runs so
      // `last_seen_at` reflects we heard from it.
      await upsertDeviceContact(tx, deviceId, args);
      const [row] = await tx
        .insert(packetsTable)
        .values({
          receivedAt: args.receivedAt,
          peer: args.peer,
          transport: args.transport,
          bytes: args.bytes,
          ascii: args.ascii,
          parseStatus: "duplicate",
          frameCount: args.rawFrameCount,
          deviceId,
          msgnum,
        })
        .returning({ id: packetsTable.id });
      logger.info(
        { deviceId, msgnum, peer: args.peer, packetId: row!.id },
        "db-sink: duplicate (device, msgnum) — packet persisted, frames skipped",
      );
      return row!.id;
    }

    // Path 4 — new frame. Insert packet + frames + reports + device
    // upsert (with denormalized latest-state from the trailer's decoded
    // body). The advisory lock guarantees no other transaction is
    // simultaneously trying to insert the same `(deviceId, msgnum)`.
    await upsertDeviceContact(tx, deviceId, args);

    const [packetRow] = await tx
      .insert(packetsTable)
      .values({
        receivedAt: args.receivedAt,
        peer: args.peer,
        transport: args.transport,
        bytes: args.bytes,
        ascii: args.ascii,
        parseStatus: "ok",
        frameCount: args.rawFrameCount,
        deviceId,
        msgnum,
      })
      .returning({ id: packetsTable.id });
    const packetId = packetRow!.id;

    // One row per frame. We tag the trailer frame; inner frames have
    // empty bodies in the spec §7 form (`>SSXP01<`, etc.) but we still
    // record the opcode so dashboards can see them.
    const frameValues = args.frames.map((f) => {
      const isTrailer = f === trailer;
      const decoded = isTrailer ? decodeReport(f) : null;
      // Narrow via dedicated extractor; the union contains an "unknown
      // opcode" branch with no header fields, so `in` checks alone widen
      // to `{}` and the column types reject it.
      const header = extractRuvHeader(decoded);
      return {
        packetId,
        deviceId,
        msgnum: f.msgnum,
        msgnumDec: f.msgnumDec,
        opcode: f.opcode,
        direction:
          f.direction === "device->server"
            ? ("device_to_server" as const)
            : ("server_to_device" as const),
        body: f.body,
        lrc: f.lrc,
        isTrailer,
        eventIndex: header.event,
        protocolId: header.protocolId,
        deviceTs: extractDeviceTs(decoded),
        receivedAt: args.receivedAt,
      };
    });

    const insertedFrames = await tx
      .insert(framesTable)
      .values(frameValues)
      .returning({ id: framesTable.id, isTrailer: framesTable.isTrailer });

    // The trailer's frame_id — we need it for the report row's FK.
    const trailerFrameId = insertedFrames.find((r) => r.isTrailer)?.id;
    if (!trailerFrameId) {
      throw new Error(
        "db-sink invariant: trailer frame missing from insert RETURNING",
      );
    }

    // Decode + insert the matching report_* row. If the opcode is unknown
    // we skip the report insert (the frames row is enough — the body is
    // preserved verbatim there).
    const decoded = decodeReport(trailer);
    await insertReport(tx, {
      frameId: trailerFrameId,
      deviceId,
      receivedAt: args.receivedAt,
      decoded,
      rawBody: trailer.body,
    });

    // Denormalized latest-state update — drives the dashboard.
    await updateDeviceLatest(tx, deviceId, decoded, args.receivedAt);

    return packetId;
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeStatus(args: BeginPacketArgs): ParseStatus {
  // `args.frames` only contains trailer-bearing envelopes; raw `>...<`
  // blocks (including inner command echoes from spec §7 multi-message
  // packets) aren't reflected there. We must derive `no_frames` from the
  // RAW count so a packet of inner-only echoes is correctly tagged
  // `no_trailer` rather than `no_frames`.
  if (args.rawFrameCount === 0) return "no_frames";
  if (!args.trailer) return "no_trailer";
  if (!args.checksumOk) return "checksum_mismatch";
  if (args.trailer.direction === "server->device") return "response_to_command";
  return "ok";
}

type Tx = Parameters<Parameters<typeof Db.transaction>[0]>[0] | typeof Db;

/**
 * Upsert the row in `devices`. On conflict we bump `lastSeenAt` (any
 * contact, even invalid) + `lastPeer` + `lastTransport` + `updatedAt`.
 * Latest-telemetry fields are left alone here — those are written by
 * `updateDeviceLatest` only on a successful trailer decode.
 */
async function upsertDeviceContact(
  tx: Tx,
  deviceId: string,
  args: BeginPacketArgs,
): Promise<void> {
  await tx
    .insert(devicesTable)
    .values({
      id: deviceId,
      lastSeenAt: args.receivedAt,
      lastPeer: args.peer,
      lastTransport: args.transport,
      updatedAt: args.receivedAt,
    })
    .onConflictDoUpdate({
      target: devicesTable.id,
      set: {
        lastSeenAt: args.receivedAt,
        lastPeer: args.peer,
        lastTransport: args.transport,
        updatedAt: args.receivedAt,
      },
    });
}

/**
 * After a successful new-frame decode, project the latest GPS / engine /
 * ignition values into the `devices` row. Done unconditionally per
 * received report — the dashboard wants "what does the device think
 * RIGHT NOW", which is by definition the most recent message we got.
 *
 * We only update fields the report opcode actually carries; e.g. RUV02
 * (end-of-trip) has no GPS so it doesn't clobber lat/lon.
 */
async function updateDeviceLatest(
  tx: Tx,
  deviceId: string,
  report: ReturnType<typeof decodeReport>,
  receivedAt: Date,
): Promise<void> {
  const set: Partial<typeof devicesTable.$inferInsert> = {
    lastReportAt: receivedAt,
    updatedAt: receivedAt,
  };

  switch (report.opcode) {
    case "RGP": {
      const r = report as Extract<typeof report, { opcode: "RGP" }>;
      if (r.lat !== undefined) set.lastLat = r.lat;
      if (r.lon !== undefined) set.lastLon = r.lon;
      if (r.speedKmh !== undefined) set.lastSpeedKmh = r.speedKmh;
      if (r.digitalInputs) set.lastIgnition = r.digitalInputs.ignition;
      if (r.ts) set.lastDeviceTs = new Date(r.ts);
      break;
    }
    case "RUV01": {
      const r = report as Extract<typeof report, { opcode: "RUV01" }>;
      if (r.lat !== undefined) set.lastLat = r.lat;
      if (r.lon !== undefined) set.lastLon = r.lon;
      if (r.speedKmh !== undefined) set.lastSpeedKmh = r.speedKmh;
      if (r.digitalInputs) set.lastIgnition = r.digitalInputs.ignition;
      if (r.hourmeterMin !== undefined) set.lastHourmeterMin = r.hourmeterMin;
      if (r.odometerM !== undefined) set.lastOdometerM = r.odometerM;
      if (r.ts) set.lastDeviceTs = new Date(r.ts);
      break;
    }
    case "RUV03": {
      const r = report as Extract<typeof report, { opcode: "RUV03" }>;
      if (r.speedKmh !== undefined) set.lastSpeedKmh = r.speedKmh;
      if (r.hourmeterMin !== undefined) set.lastHourmeterMin = r.hourmeterMin;
      if (r.odometerM !== undefined) set.lastOdometerM = r.odometerM;
      if (r.ts) set.lastDeviceTs = new Date(r.ts);
      break;
    }
    case "RUV00":
    case "RUV02":
    default:
      // RUV00 = installation snapshot (no telemetry).
      // RUV02 = end-of-trip (no GPS or instantaneous values).
      // Unknown opcode = skip — we still bumped lastReportAt above.
      break;
  }

  await tx.update(devicesTable).set(set).where(eq(devicesTable.id, deviceId));
}

/**
 * Insert into the matching `reports_*` table. Unknown opcodes are
 * deliberately a no-op: the body is preserved in the `frames` row, and
 * adding a column-typed projection only makes sense once we know the
 * opcode's semantics.
 */
async function insertReport(
  tx: Tx,
  args: {
    frameId: string;
    deviceId: string;
    receivedAt: Date;
    decoded: ReturnType<typeof decodeReport>;
    rawBody: string;
  },
): Promise<void> {
  const { frameId, deviceId, receivedAt, decoded, rawBody } = args;
  const common = {
    frameId,
    deviceId,
    receivedAt,
    rawBody,
  };
  switch (decoded.opcode) {
    case "RGP": {
      const r = decoded as Extract<typeof decoded, { opcode: "RGP" }>;
      await tx.insert(reportsRgpTable).values({
        ...common,
        // RGP has no event/protocol header.
        deviceTs: r.ts ? new Date(r.ts) : null,
        lat: r.lat ?? null,
        lon: r.lon ?? null,
        speedKmh: r.speedKmh ?? null,
        headingDeg: r.headingDeg ?? null,
        gpsStatus: r.gpsStatus ?? null,
        secondsSinceFix: r.secondsSinceFix ?? null,
        hdop: r.hdop ?? null,
        diRaw: r.digitalInputs?.raw ?? null,
        ignition: r.digitalInputs?.ignition ?? null,
        mainPower: r.digitalInputs?.mainPower ?? null,
      });
      return;
    }
    case "RUV00": {
      const r = decoded as Extract<typeof decoded, { opcode: "RUV00" }>;
      await tx.insert(reportsRuv00Table).values({
        ...common,
        eventIndex: r.event ?? null,
        protocolId: r.protocolId ?? null,
        deviceTs: r.ts ? new Date(r.ts) : null,
        backupBatteryV: r.backupBatteryV ?? null,
        mainSupplyV: r.mainSupplyV ?? null,
        serial: r.serial ?? null,
        firmware: r.firmware ?? null,
        board: r.board ?? null,
        script: r.script ?? null,
        peripheral: r.peripheral ?? null,
        rainSpeedFlag: r.rainSpeedFlag ?? null,
        hourmeterSource: r.hourmeterSource ?? null,
        sharpEventSource: r.sharpEventSource ?? null,
        iccid: r.iccid ?? null,
      });
      return;
    }
    case "RUV01": {
      const r = decoded as Extract<typeof decoded, { opcode: "RUV01" }>;
      await tx.insert(reportsRuv01Table).values({
        ...common,
        eventIndex: r.event ?? null,
        protocolId: r.protocolId ?? null,
        deviceTs: r.ts ? new Date(r.ts) : null,
        lat: r.lat ?? null,
        lon: r.lon ?? null,
        speedKmh: r.speedKmh ?? null,
        headingDeg: r.headingDeg ?? null,
        gpsStatus: r.gpsStatus ?? null,
        secondsSinceFix: r.secondsSinceFix ?? null,
        hdop: r.hdop ?? null,
        diRaw: r.digitalInputs?.raw ?? null,
        ignition: r.digitalInputs?.ignition ?? null,
        mainPower: r.digitalInputs?.mainPower ?? null,
        backupBatteryV: r.backupBatteryV ?? null,
        mainSupplyV: r.mainSupplyV ?? null,
        maxSpeedViolation: r.maxSpeedViolation ?? null,
        maxRpmViolation: r.maxRpmViolation ?? null,
        hourmeterMin: r.hourmeterMin ?? null,
        odometerM: r.odometerM ?? null,
        rpm: r.rpm ?? null,
        engineTempC: r.engineTempC ?? null,
        oilPressureKpa: r.oilPressureKpa ?? null,
        fuelPct: r.fuelPct ?? null,
        rainSpeedFlag: r.rainSpeedFlag ?? null,
        online: r.online ?? null,
        network: r.network ?? null,
        driverId: r.driverId ?? null,
      });
      return;
    }
    case "RUV02": {
      const r = decoded as Extract<typeof decoded, { opcode: "RUV02" }>;
      await tx.insert(reportsRuv02Table).values({
        ...common,
        eventIndex: r.event ?? null,
        protocolId: r.protocolId ?? null,
        deviceTs: r.ts ? new Date(r.ts) : null,
        rpmRange1Sec: r.rpmRangeSec?.[0] ?? null,
        rpmRange2Sec: r.rpmRangeSec?.[1] ?? null,
        rpmRange3Sec: r.rpmRangeSec?.[2] ?? null,
        rpmRange4Sec: r.rpmRangeSec?.[3] ?? null,
        rpmRange5Sec: r.rpmRangeSec?.[4] ?? null,
        inertialSec: r.inertialSec ?? null,
        engineBrakingSec: r.engineBrakingSec ?? null,
        coastingSec: r.coastingSec ?? null,
        travelTimeMin: r.travelTimeMin ?? null,
        distanceM: r.distanceM ?? null,
        fuelConsumedDecilitres: r.fuelConsumedDecilitres ?? null,
      });
      return;
    }
    case "RUV03": {
      const r = decoded as Extract<typeof decoded, { opcode: "RUV03" }>;
      await tx.insert(reportsRuv03Table).values({
        ...common,
        eventIndex: r.event ?? null,
        protocolId: r.protocolId ?? null,
        deviceTs: r.ts ? new Date(r.ts) : null,
        acceleratorPct: r.acceleratorPct ?? null,
        hourmeterMin: r.hourmeterMin ?? null,
        odometerM: r.odometerM ?? null,
        rpm: r.rpm ?? null,
        engineTempC: r.engineTempC ?? null,
        enginePressureKpa: r.enginePressureKpa ?? null,
        fuelPct: r.fuelPct ?? null,
        cumulativeFuelDecilitres: r.cumulativeFuelDecilitres ?? null,
        speedKmh: r.speedKmh ?? null,
        engineTorquePct: r.engineTorquePct ?? null,
        engineBrakePct: r.engineBrakePct ?? null,
        cruiseControl: r.cruiseControl ?? null,
        clutch: r.clutch ?? null,
        parkingBrake: r.parkingBrake ?? null,
        serviceBrake: r.serviceBrake ?? null,
      });
      return;
    }
    default:
      // Unknown opcode (e.g. RUS00, future RUVxx). Frame row already holds
      // the opcode + body; no typed table to project into. Soft-skip.
      logger.debug(
        { opcode: decoded.opcode, deviceId, frameId },
        "db-sink: no report table for opcode — skipping report insert",
      );
      return;
  }
}

/**
 * Type guard helper — extracts a device-clock timestamp from any decoded
 * report that exposes one. Used when populating the `frames.deviceTs`
 * column so per-frame queries don't need to join a report table.
 */
function extractDeviceTs(
  decoded: ReturnType<typeof decodeReport> | null,
): Date | null {
  if (!decoded) return null;
  switch (decoded.opcode) {
    case "RGP":
    case "RUV00":
    case "RUV01":
    case "RUV02":
    case "RUV03": {
      const r = decoded as { ts?: string };
      return r.ts ? new Date(r.ts) : null;
    }
    default:
      return null;
  }
}

/**
 * Pull the RUV common header (event + protocolId) into a strongly-typed
 * shape. Unknown opcodes and RGP (which has no header) yield nulls so
 * the caller can spread the result directly into the `frames` insert
 * payload without TS widening to `{}` via `in` narrowing.
 */
function extractRuvHeader(
  decoded: ReturnType<typeof decodeReport> | null,
): { event: number | null; protocolId: string | null } {
  if (!decoded) return { event: null, protocolId: null };
  switch (decoded.opcode) {
    case "RUV00":
    case "RUV01":
    case "RUV02":
    case "RUV03": {
      const r = decoded as { event?: number; protocolId?: string };
      return {
        event: r.event ?? null,
        protocolId: r.protocolId ?? null,
      };
    }
    default:
      return { event: null, protocolId: null };
  }
}

// Tiny re-export so callers can build a no-op sink in tests/dev without
// pulling in the whole module.
export const NULL_DB_SINK: DbSink = {
  beginPacket() {
    return {
      markAcked() {
        /* noop */
      },
      done() {
        return Promise.resolve();
      },
    };
  },
  shutdown() {
    return Promise.resolve();
  },
};

// Suppress unused-import warning when sql() helpers aren't used in this
// module's current shape. Kept available for future filter expressions.
void sql;
