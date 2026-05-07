// End-to-end tests for the gateway's DB persistence path (Milestone 3).
//
// We exercise the *real* Postgres DB (DATABASE_URL is provisioned by the
// Replit environment) rather than mocking Drizzle. Mocking would make the
// tests pass while leaving SQL-level bugs (column types, FK cascades,
// enum values) undetected — exactly the class of bug that broke
// Milestone 2 review (`bigint` vs `int4` for odometer).
//
// Each test uses a unique synthetic device id so concurrent runs don't
// collide. Cleanup happens via cascade-delete on the device row.

import { strict as assert } from "node:assert";
import { after, before, beforeEach, describe, it } from "node:test";

import {
  db,
  devicesTable,
  framesTable,
  packetsTable,
  reportsRgpTable,
  reportsRuv01Table,
  reportsRuv02Table,
  reportsRuv03Table,
} from "@workspace/db";
import { and, count, eq } from "drizzle-orm";

import { makeDbSink, type DbSink } from "../src/db-sink.ts";
import {
  makePacketHandler,
  type CaptureSink,
  type ReplyAck,
} from "../src/handler.ts";
import { xorChecksum } from "../src/lib/xvm.ts";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

// Use a 4-char id with a stable prefix so leftover rows from a partial test
// run can be spotted and pruned manually if needed.
let idCounter = 0;
function freshId(): string {
  idCounter += 1;
  // 4 chars: "T" + 3 base32 chars derived from time + counter so parallel
  // runs don't collide. Postgres `text` PK doesn't care about width but we
  // honour the spec §3 4-char convention so the value is realistic.
  const n = (Date.now() % 1024) * 32 + idCounter;
  return `T${n.toString(36).toUpperCase().padStart(3, "0").slice(-3)}`;
}

function frame(opcode: string, id: string, msgnum: string, body = ""): Buffer {
  // For RGP / RUV*: the body lives BETWEEN `>` and `;ID=`. The opcode is
  // the first 3-or-5 chars of the body. We just inline whatever the caller
  // passed (with the opcode prepended) so this helper is opcode-agnostic.
  const payload = body ? `${opcode}${body}` : opcode;
  const prefix = `>${payload};ID=${id};#${msgnum};`;
  const lrc = xorChecksum(prefix);
  return Buffer.from(`${prefix}*${lrc}<\r\n`, "ascii");
}

function makeSink(): { sink: CaptureSink; lines: string[] } {
  const lines: string[] = [];
  return {
    sink: { write: (l) => lines.push(l) },
    lines,
  };
}

function makeReplyAck(): {
  replyAck: ReplyAck;
  calls: { ascii: string }[];
} {
  const calls: { ascii: string }[] = [];
  return {
    replyAck: (msg, cb) => {
      calls.push({ ascii: msg.toString("ascii") });
      cb?.(null);
    },
    calls,
  };
}

async function cleanupDevice(id: string): Promise<void> {
  // Cascade chain: deleting the device drops nothing directly (devices is
  // RESTRICT on frames/reports, SET NULL on packets), so we delete in the
  // right order: reports → frames → packets → device. Reports cascade from
  // frames, so frames-delete handles them.
  await db.delete(framesTable).where(eq(framesTable.deviceId, id));
  await db.delete(packetsTable).where(eq(packetsTable.deviceId, id));
  await db.delete(devicesTable).where(eq(devicesTable.id, id));
}

// ---------------------------------------------------------------------------
// Spec-shape sample bodies. Lifted from `parser.ts` doc comments + spec §9.
// ---------------------------------------------------------------------------

// GPS block layout (44 chars): ddmmyy(6) hhmmss(6) lat(8=sign+7) lon(9=sign+8)
//   speed(3) dir(3) gps(1) sincefix(2) dimask(2) reserved(2) hdop(2)
// Decoded: ts 2026-04-26 22:30:15Z, lat +12.34567, lon -123.45678,
//   speed 050 km/h, heading 234, gps=0, sincefix=05, dimask=81
//   (ignition ON, mainPower bit set), reserved=40, hdop=03.
const GPS_BLOCK_44 = "260426223015+1234567-1234567805023400581400003";
const RGP_BODY = GPS_BLOCK_44; // RGP has the GPS block immediately after "RGP"

// RUV01 sample (spec §9.4): event=100 (basic), protocol=NT003,
// then GPS block, voltages 04151387, two violation fields, reserved=0,
// then CAN: hourmeter=12345 min, odometer=2222222222 m (the bigint test
// case — 2.22 billion exceeds int4 max ~2.14B), rpm=1500, eng_temp=85,
// oil=350, fuel=70, rain=0, online=1, network=4G, driver="MOTORISTA1".
// Note: opcode "RUV" is added by the frame() helper, body starts with
// "01100,…" so parts[0] becomes "RUV01100" after concatenation.
const RUV01_BODY = `01100,NT003,${GPS_BLOCK_44},04151387,0,0,0,12345,2222222222,1500,85,350,70,0,1,4G,MOTORISTA1`;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("db-sink end-to-end (Milestone 3)", () => {
  let sink: DbSink;
  const createdIds: string[] = [];

  before(() => {
    sink = makeDbSink(db);
  });

  after(async () => {
    await sink.shutdown(2_000);
    for (const id of createdIds) {
      await cleanupDevice(id).catch(() => undefined);
    }
  });

  beforeEach(() => {
    // Re-bump idCounter to keep IDs unique even on fast runs.
    idCounter += 1;
  });

  it("persists a new RGP packet end-to-end (devices, packets, frames, reports_rgp)", async () => {
    const id = freshId();
    createdIds.push(id);

    const { sink: cap } = makeSink();
    const { replyAck, calls } = makeReplyAck();
    const handle = makePacketHandler(cap, sink);

    handle(frame("RGP", id, "0001", RGP_BODY), "9.9.9.9:6600", replyAck, "udp");

    // Wait for fire-and-forget DB writes to flush.
    await sink.shutdown(3_000);

    assert.equal(calls.length, 1, "ACK should be sent for device-originated RGP");

    const [device] = await db
      .select()
      .from(devicesTable)
      .where(eq(devicesTable.id, id));
    assert.ok(device, "device row created on first contact");
    assert.equal(device.lastPeer, "9.9.9.9:6600");
    assert.equal(device.lastTransport, "udp");
    assert.ok(
      device.lastReportAt !== null,
      "lastReportAt set on successful trailer decode",
    );
    assert.equal(typeof device.lastLat, "number", "lat projected to device row");
    assert.equal(typeof device.lastLon, "number", "lon projected to device row");
    assert.equal(typeof device.lastIgnition, "boolean", "ignition projected");

    const packets = await db
      .select()
      .from(packetsTable)
      .where(eq(packetsTable.deviceId, id));
    assert.equal(packets.length, 1, "exactly one packet row for one RX");
    assert.equal(packets[0]!.parseStatus, "ok");
    assert.equal(packets[0]!.frameCount, 1);
    assert.equal(packets[0]!.transport, "udp");
    assert.ok(packets[0]!.ackedAt, "ack metadata filled in");
    assert.ok(
      packets[0]!.ackAscii && packets[0]!.ackAscii.includes(`;ID=${id};`),
      "ack ascii recorded",
    );

    const frames = await db
      .select()
      .from(framesTable)
      .where(eq(framesTable.deviceId, id));
    assert.equal(frames.length, 1, "single trailer frame inserted");
    assert.equal(frames[0]!.opcode, "RGP");
    assert.equal(frames[0]!.isTrailer, true);
    assert.equal(frames[0]!.direction, "device_to_server");

    const reports = await db
      .select()
      .from(reportsRgpTable)
      .where(eq(reportsRgpTable.deviceId, id));
    assert.equal(reports.length, 1, "RGP report inserted");
    assert.equal(typeof reports[0]!.lat, "number");
    assert.equal(typeof reports[0]!.lon, "number");
    assert.equal(typeof reports[0]!.ignition, "boolean");
  });

  it("persists a new RUV01 packet with bigint odometer (>int4 range)", async () => {
    const id = freshId();
    createdIds.push(id);

    const { sink: cap } = makeSink();
    const { replyAck } = makeReplyAck();
    const handle = makePacketHandler(cap, sink);

    handle(
      // RUV01 body — note prefix is `RUV` not `RUV01` because frame() adds
      // the opcode itself, and the rest of the body starts with "01100,…"
      // (event 100 + comma-separated tail).
      frame("RUV", id, "0002", RUV01_BODY),
      "9.9.9.9:6600",
      replyAck,
      "udp",
    );
    await sink.shutdown(3_000);

    const reports = await db
      .select()
      .from(reportsRuv01Table)
      .where(eq(reportsRuv01Table.deviceId, id));
    assert.equal(reports.length, 1, "RUV01 report inserted");
    assert.equal(
      reports[0]!.odometerM,
      2222222222,
      "bigint odometer roundtripped as JS number (>int4 max)",
    );
    assert.equal(reports[0]!.hourmeterMin, 12345);
    assert.equal(reports[0]!.driverId, "MOTORISTA1");
    assert.equal(reports[0]!.eventIndex, 100);
    assert.equal(reports[0]!.protocolId, "NT003");

    // device_state projection
    const [dev] = await db
      .select()
      .from(devicesTable)
      .where(eq(devicesTable.id, id));
    assert.equal(dev!.lastOdometerM, 2222222222);
    assert.equal(dev!.lastHourmeterMin, 12345);
  });

  it("dedup: second packet with same (device, msgnum) within window writes status=duplicate, no extra frame", async () => {
    const id = freshId();
    createdIds.push(id);

    const { sink: cap } = makeSink();
    const { replyAck } = makeReplyAck();
    const handle = makePacketHandler(cap, sink);

    const pkt = frame("RGP", id, "00AA", RGP_BODY);
    handle(pkt, "9.9.9.9:6600", replyAck, "udp");
    await sink.shutdown(3_000);

    // Re-send the same bytes — device retried because it didn't see ACK.
    handle(pkt, "9.9.9.9:6600", replyAck, "udp");
    await sink.shutdown(3_000);

    const packets = await db
      .select()
      .from(packetsTable)
      .where(eq(packetsTable.deviceId, id));
    assert.equal(packets.length, 2, "both packets persisted as audit tape");

    const statuses = packets.map((p) => p.parseStatus).sort();
    assert.deepEqual(
      statuses,
      ["duplicate", "ok"],
      "first ok, second flagged duplicate",
    );

    const [{ value: frameCount }] = await db
      .select({ value: count() })
      .from(framesTable)
      .where(eq(framesTable.deviceId, id));
    assert.equal(frameCount, 1, "no second frames row for the dup");

    const [{ value: rgpCount }] = await db
      .select({ value: count() })
      .from(reportsRgpTable)
      .where(eq(reportsRgpTable.deviceId, id));
    assert.equal(rgpCount, 1, "no second RGP report for the dup");
  });

  it("checksum-mismatch packet: persisted with status=checksum_mismatch, no frames/reports", async () => {
    const id = freshId();
    createdIds.push(id);

    const { sink: cap } = makeSink();
    const { replyAck, calls } = makeReplyAck();
    const handle = makePacketHandler(cap, sink);

    // Hand-craft a wrong LRC.
    const bad = Buffer.from(`>RGP;ID=${id};#0001;*FF<\r\n`, "ascii");
    handle(bad, "9.9.9.9:6600", replyAck, "udp");
    await sink.shutdown(3_000);

    assert.equal(calls.length, 0, "bad LRC must not be ACKed");

    const packets = await db
      .select()
      .from(packetsTable)
      .where(
        and(
          eq(packetsTable.peer, "9.9.9.9:6600"),
          eq(packetsTable.parseStatus, "checksum_mismatch"),
        ),
      );
    // We can't filter by deviceId — checksum_mismatch path doesn't set it.
    // Instead assert at least one matching row exists with our exact ascii.
    const ours = packets.filter((p) => p.ascii.includes(`ID=${id}`));
    assert.equal(ours.length, 1, "exactly one checksum_mismatch packet row");

    const [{ value: f }] = await db
      .select({ value: count() })
      .from(framesTable)
      .where(eq(framesTable.deviceId, id));
    assert.equal(f, 0, "no frames row for rejected packet");
  });

  it("multi-message packet (spec §7): trailer becomes frames row; inner echoes preserved in packet ascii", async () => {
    const id = freshId();
    createdIds.push(id);

    const { sink: cap } = makeSink();
    const { replyAck, calls } = makeReplyAck();
    const handle = makePacketHandler(cap, sink);

    // Two inner command-echo frames precede the trailer in one datagram.
    // Whole-packet LRC is computed up to (but not including) the trailing
    // `*` per spec §5.
    const prefix = `>SSXP01<>SSXP11<>RGP${RGP_BODY};ID=${id};#0010;`;
    const lrc = xorChecksum(prefix);
    const pkt = Buffer.from(`${prefix}*${lrc}<\r\n`, "ascii");
    const asciiText = pkt.toString("ascii");

    handle(pkt, "9.9.9.9:6600", replyAck, "tcp");
    await sink.shutdown(3_000);

    assert.equal(calls.length, 1, "trailer drives the ACK");

    // Per the M1 envelope-parser contract, only frames carrying a trailer
    // (`;ID=…;#…;*…`) become `frames` rows — inner command echoes are
    // captured verbatim in `packets.ascii` and the NDJSON tape, but they
    // don't get individually projected into the schema. This keeps
    // `frames` semantically meaningful (one row = one ACK-able report).
    const frames = await db
      .select()
      .from(framesTable)
      .where(eq(framesTable.deviceId, id));
    assert.equal(frames.length, 1, "only the trailer-bearing frame is rowed");
    assert.equal(frames[0]!.isTrailer, true);
    assert.equal(frames[0]!.opcode, "RGP");

    // Confirm the inner echoes survive in the packet ascii blob.
    const packets = await db
      .select()
      .from(packetsTable)
      .where(eq(packetsTable.deviceId, id));
    assert.equal(packets.length, 1);
    assert.equal(packets[0]!.frameCount, 3, "framer counted all 3 raw frames");
    assert.ok(
      packets[0]!.ascii.includes(">SSXP01<") &&
        packets[0]!.ascii.includes(">SSXP11<"),
      "inner command echoes preserved in packet ascii audit",
    );
    assert.equal(packets[0]!.ascii, asciiText);

    const reports = await db
      .select()
      .from(reportsRgpTable)
      .where(eq(reportsRgpTable.deviceId, id));
    assert.equal(reports.length, 1, "only the trailer produces a report row");
  });

  it("concurrent identical (deviceId, msgnum) packets serialize via advisory lock — exactly one report", async () => {
    // This is the regression test for the SELECT-then-INSERT race the
    // architect flagged: even in a single Node.js process, two retries
    // arriving within the same event-loop tick can both pass the dedupe
    // SELECT before either commits its frames row. The advisory xact
    // lock keyed on (deviceId, msgnum) must serialize them.
    const id = freshId();
    createdIds.push(id);

    const { sink: cap } = makeSink();
    const { replyAck } = makeReplyAck();
    const handle = makePacketHandler(cap, sink);

    // Fire 5 identical packets back-to-back without awaiting between them.
    // beginPacket is sync, so all 5 insertPromises kick off concurrently.
    const pkt = frame("RGP", id, "00BB", RGP_BODY);
    for (let i = 0; i < 5; i++) {
      handle(pkt, "9.9.9.9:6600", replyAck, "udp");
    }
    await sink.shutdown(5_000);

    const packets = await db
      .select()
      .from(packetsTable)
      .where(eq(packetsTable.deviceId, id));
    assert.equal(packets.length, 5, "audit tape preserves all 5 retries");

    const okCount = packets.filter((p) => p.parseStatus === "ok").length;
    const dupCount = packets.filter((p) => p.parseStatus === "duplicate").length;
    assert.equal(okCount, 1, "exactly one packet committed as ok (race lost)");
    assert.equal(dupCount, 4, "the other four flagged as duplicate");

    const [{ value: frames }] = await db
      .select({ value: count() })
      .from(framesTable)
      .where(eq(framesTable.deviceId, id));
    assert.equal(frames, 1, "exactly one frames row");

    const [{ value: reports }] = await db
      .select({ value: count() })
      .from(reportsRgpTable)
      .where(eq(reportsRgpTable.deviceId, id));
    assert.equal(reports, 1, "exactly one report row — race did not double-write");
  });

  it("computeStatus: packet with raw inner frames but no trailer is `no_trailer`, not `no_frames`", async () => {
    const { sink: cap } = makeSink();
    const { replyAck, calls } = makeReplyAck();
    const handle = makePacketHandler(cap, sink);

    // Two inner-only command echoes, no trailer at all.
    const pkt = Buffer.from(">SSXP01<>SSXP11<\r\n", "ascii");
    handle(pkt, "9.9.9.9:6600", replyAck, "udp");
    await sink.shutdown(3_000);

    assert.equal(calls.length, 0, "no trailer, no ACK");

    const packets = await db
      .select()
      .from(packetsTable)
      .where(
        and(
          eq(packetsTable.peer, "9.9.9.9:6600"),
          eq(packetsTable.parseStatus, "no_trailer"),
        ),
      );
    const ours = packets.filter((p) => p.ascii === ">SSXP01<>SSXP11<\r\n");
    assert.ok(
      ours.length >= 1,
      "inner-only multi-message packet correctly classified as no_trailer",
    );
    // Cleanup these orphan packets (deviceId is null so cascade can't help).
    for (const p of ours) {
      await db.delete(packetsTable).where(eq(packetsTable.id, p.id));
    }
  });

  it("device upsert is idempotent across multiple contacts", async () => {
    const id = freshId();
    createdIds.push(id);

    const { sink: cap } = makeSink();
    const { replyAck } = makeReplyAck();
    const handle = makePacketHandler(cap, sink);

    handle(frame("RGP", id, "0010", RGP_BODY), "1.1.1.1:6600", replyAck, "udp");
    await sink.shutdown(3_000);
    const [first] = await db
      .select()
      .from(devicesTable)
      .where(eq(devicesTable.id, id));

    handle(frame("RGP", id, "0011", RGP_BODY), "2.2.2.2:6600", replyAck, "tcp");
    await sink.shutdown(3_000);
    const [second] = await db
      .select()
      .from(devicesTable)
      .where(eq(devicesTable.id, id));

    assert.equal(
      first!.firstSeenAt.toISOString(),
      second!.firstSeenAt.toISOString(),
      "first_seen_at is set on insert and never overwritten on conflict",
    );
    assert.equal(second!.lastPeer, "2.2.2.2:6600", "lastPeer updated");
    assert.equal(second!.lastTransport, "tcp", "lastTransport updated");
  });
});
