// End-to-end tests for the M4 read API.
//
// We boot the real Express app on an ephemeral port and hit it with
// `fetch`, going through the same DB the gateway writes to. Mocking
// would defeat the purpose: the whole reason the API exists is to
// project the schema we landed in M3 over HTTP, so the tests must
// verify the SQL/HTTP contract and not just the JavaScript layer.
//
// Each test uses unique synthetic device IDs so concurrent runs (and
// re-runs after a partial cleanup) don't collide. Fixtures are torn
// down in `after()` regardless of failure.

import { strict as assert } from "node:assert";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";

import {
  db,
  devicesTable,
  framesTable,
  packetsTable,
  reportsRgpTable,
  reportsRuv00Table,
  reportsRuv01Table,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

import app from "../src/app.ts";

// ---------------------------------------------------------------------------
// Server lifecycle
// ---------------------------------------------------------------------------

let baseUrl: string;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- node http server type churn
let server: any;

before(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const addr = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}/api`;
});

after(async () => {
  await Promise.all([
    cleanupDevices(SEEDED_DEVICE_IDS),
    cleanupOrphanPackets(SEEDED_ORPHAN_PACKET_IDS),
  ]);
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

// ---------------------------------------------------------------------------
// Test fixture helpers
// ---------------------------------------------------------------------------

const SEEDED_DEVICE_IDS: string[] = [];
const SEEDED_ORPHAN_PACKET_IDS: string[] = [];

let idCounter = 0;
function freshId(prefix = "T"): string {
  idCounter += 1;
  // 4-char id matching spec §3 width. Combine epoch with a counter so
  // parallel runs across CI shards don't collide.
  const n = (Date.now() % 1024) * 32 + idCounter;
  return `${prefix}${n.toString(36).toUpperCase().padStart(3, "0").slice(-3)}`;
}

async function cleanupDevices(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  // Order: reports (cascade from frames), then frames, then packets,
  // then the device row. Frames have a RESTRICT FK so they MUST be
  // dropped before the device.
  await db.delete(framesTable).where(inArray(framesTable.deviceId, ids));
  await db.delete(packetsTable).where(inArray(packetsTable.deviceId, ids));
  await db.delete(devicesTable).where(inArray(devicesTable.id, ids));
}

async function cleanupOrphanPackets(packetIds: string[]): Promise<void> {
  if (packetIds.length === 0) return;
  await db.delete(packetsTable).where(inArray(packetsTable.id, packetIds));
}

interface SeedDeviceOpts {
  id: string;
  model?: "VL06" | "VL08" | "unknown";
  lastIgnition?: boolean;
  lastSpeedKmh?: number;
  lastReportAt?: Date;
}

async function seedDevice(opts: SeedDeviceOpts): Promise<void> {
  await db.insert(devicesTable).values({
    id: opts.id,
    model: opts.model ?? "unknown",
    lastPeer: "9.9.9.9:6600",
    lastTransport: "udp",
    lastLat: -23.5505,
    lastLon: -46.6333,
    lastIgnition: opts.lastIgnition ?? true,
    lastSpeedKmh: opts.lastSpeedKmh ?? 42,
    lastReportAt: opts.lastReportAt ?? new Date(),
  });
}

interface SeedPacketOpts {
  deviceId: string | null;
  receivedAt: Date;
  parseStatus?: "ok" | "no_frames" | "checksum_mismatch" | "no_trailer" | "duplicate";
  msgnum?: string;
}

async function seedPacket(opts: SeedPacketOpts): Promise<string> {
  const ascii = `>RGP;ID=${opts.deviceId ?? "ORPH"};#${opts.msgnum ?? "0001"};*FF<\r\n`;
  const [row] = await db
    .insert(packetsTable)
    .values({
      receivedAt: opts.receivedAt,
      peer: "9.9.9.9:6600",
      transport: "udp",
      bytes: ascii.length,
      ascii,
      parseStatus: opts.parseStatus ?? "ok",
      frameCount: 1,
      deviceId: opts.deviceId,
      msgnum: opts.msgnum ?? "0001",
      ackedAt: opts.parseStatus === "ok" ? opts.receivedAt : null,
      ackAscii: opts.parseStatus === "ok" ? ascii : null,
    })
    .returning({ id: packetsTable.id });
  return row!.id;
}

// Common frame body / lrc — the parser splits these from the wire format,
// so we keep them as separate columns in the schema. The exact values
// don't matter for these tests; we just need the FK to resolve.
const FRAME_BODY = "RGP260426223015+1234567-1234567805023400581400003";
const FRAME_LRC = "00";

async function seedFrameAndRgp(
  deviceId: string,
  packetId: string,
  msgnum: string,
  receivedAt: Date,
): Promise<void> {
  const [frame] = await db
    .insert(framesTable)
    .values({
      packetId,
      deviceId,
      msgnum,
      msgnumDec: parseInt(msgnum, 16),
      opcode: "RGP",
      direction: "device_to_server",
      body: FRAME_BODY,
      lrc: FRAME_LRC,
      isTrailer: true,
      deviceTs: receivedAt,
      receivedAt,
    })
    .returning({ id: framesTable.id });

  await db.insert(reportsRgpTable).values({
    frameId: frame!.id,
    deviceId,
    receivedAt,
    deviceTs: receivedAt,
    rawBody: "260426223015+1234567-1234567805023400581400003",
    lat: -23.5505,
    lon: -46.6333,
    speedKmh: 42,
    headingDeg: 234,
    gpsStatus: 0,
    secondsSinceFix: 5,
    hdop: 3,
    diRaw: 0x81,
    ignition: true,
    mainPower: true,
  });
}

async function seedFrameAndRuv00(
  deviceId: string,
  packetId: string,
  msgnum: string,
  receivedAt: Date,
): Promise<void> {
  const [frame] = await db
    .insert(framesTable)
    .values({
      packetId,
      deviceId,
      msgnum,
      msgnumDec: parseInt(msgnum, 16),
      opcode: "RUV00",
      direction: "device_to_server",
      body: "RUV00100,NT003",
      lrc: FRAME_LRC,
      isTrailer: true,
      eventIndex: 100,
      protocolId: "NT003",
      deviceTs: receivedAt,
      receivedAt,
    })
    .returning({ id: framesTable.id });

  await db.insert(reportsRuv00Table).values({
    frameId: frame!.id,
    deviceId,
    receivedAt,
    deviceTs: receivedAt,
    eventIndex: 100,
    protocolId: "NT003",
    rawBody: "00100,NT003,fwfw,bvbv",
    backupBatteryV: 4.15,
    mainSupplyV: 13.87,
    serial: "SN12345",
    firmware: "FW1.2.3",
    board: "B7",
    script: "SCRIPT_v1",
    peripheral: "P0",
    rainSpeedFlag: 0,
    hourmeterSource: 1,
    sharpEventSource: 0,
    iccid: "8955010100000000000F",
  });
}

async function seedFrameAndRuv01(
  deviceId: string,
  packetId: string,
  msgnum: string,
  receivedAt: Date,
): Promise<void> {
  const [frame] = await db
    .insert(framesTable)
    .values({
      packetId,
      deviceId,
      msgnum,
      msgnumDec: parseInt(msgnum, 16),
      opcode: "RUV01",
      direction: "device_to_server",
      body: "RUV01100,NT003",
      lrc: FRAME_LRC,
      isTrailer: true,
      eventIndex: 100,
      protocolId: "NT003",
      deviceTs: receivedAt,
      receivedAt,
    })
    .returning({ id: framesTable.id });

  await db.insert(reportsRuv01Table).values({
    frameId: frame!.id,
    deviceId,
    receivedAt,
    deviceTs: receivedAt,
    eventIndex: 100,
    protocolId: "NT003",
    rawBody: "01100,NT003,...",
    lat: -23.5505,
    lon: -46.6333,
    speedKmh: 42,
    headingDeg: 234,
    gpsStatus: 0,
    secondsSinceFix: 5,
    hdop: 3,
    diRaw: 0x81,
    ignition: true,
    mainPower: true,
    backupBatteryV: 4.15,
    mainSupplyV: 13.87,
    maxSpeedViolation: 0,
    maxRpmViolation: 0,
    hourmeterMin: 12345,
    odometerM: 2222222222,
    rpm: 1500,
    engineTempC: 85,
    oilPressureKpa: 350,
    fuelPct: 70,
    rainSpeedFlag: 0,
    online: true,
    network: "4G",
    driverId: "MOTORISTA1",
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("M4 read API", () => {
  describe("GET /devices", () => {
    it("returns the seeded devices, filterable by model", async () => {
      const a = freshId("A");
      const b = freshId("B");
      SEEDED_DEVICE_IDS.push(a, b);
      await seedDevice({ id: a, model: "VL06" });
      await seedDevice({ id: b, model: "VL08" });

      const all = await (await fetch(`${baseUrl}/devices`)).json();
      const ids = (all as Array<{ id: string }>).map((d) => d.id);
      assert.ok(ids.includes(a) && ids.includes(b), "both devices listed");

      const onlyVl08Resp = await fetch(`${baseUrl}/devices?model=VL08`);
      assert.equal(onlyVl08Resp.status, 200);
      const vl08 = (await onlyVl08Resp.json()) as Array<{
        id: string;
        model: string;
      }>;
      assert.ok(
        vl08.every((d) => d.model === "VL08"),
        "filter narrows to VL08 only",
      );
      assert.ok(vl08.some((d) => d.id === b));
      assert.ok(!vl08.some((d) => d.id === a));
    });

    it("rejects an invalid model with a 400 + zod issues", async () => {
      const resp = await fetch(`${baseUrl}/devices?model=NOPE`);
      assert.equal(resp.status, 400);
      const body = (await resp.json()) as {
        error: string;
        issues: unknown[];
      };
      assert.equal(body.error, "validation_error");
      assert.ok(Array.isArray(body.issues) && body.issues.length > 0);
    });
  });

  describe("GET /devices/{id}", () => {
    it("returns the device row when it exists", async () => {
      const id = freshId("D");
      SEEDED_DEVICE_IDS.push(id);
      await seedDevice({ id, model: "VL08", lastSpeedKmh: 88 });

      const resp = await fetch(`${baseUrl}/devices/${id}`);
      assert.equal(resp.status, 200);
      const body = (await resp.json()) as {
        id: string;
        model: string;
        lastSpeedKmh: number;
      };
      assert.equal(body.id, id);
      assert.equal(body.model, "VL08");
      assert.equal(body.lastSpeedKmh, 88);
    });

    it("returns 404 for an unknown device id", async () => {
      const resp = await fetch(`${baseUrl}/devices/Z999`);
      assert.equal(resp.status, 404);
      const body = (await resp.json()) as { error: string; message: string };
      assert.equal(body.error, "not_found");
      assert.match(body.message, /device 'Z999' not found/);
    });
  });

  describe("GET /devices/{id}/packets", () => {
    it("returns packets newest-first, filterable by parseStatus, paginated by `before`", async () => {
      const id = freshId("P");
      SEEDED_DEVICE_IDS.push(id);
      await seedDevice({ id });

      const t0 = new Date(Date.now() - 60_000); // 60s ago
      const t1 = new Date(Date.now() - 40_000);
      const t2 = new Date(Date.now() - 20_000);
      const t3 = new Date(Date.now() - 10_000);

      await seedPacket({ deviceId: id, receivedAt: t0, parseStatus: "ok", msgnum: "0001" });
      await seedPacket({ deviceId: id, receivedAt: t1, parseStatus: "duplicate", msgnum: "0001" });
      await seedPacket({ deviceId: id, receivedAt: t2, parseStatus: "ok", msgnum: "0002" });
      await seedPacket({ deviceId: id, receivedAt: t3, parseStatus: "no_trailer", msgnum: "0003" });

      // No filter: 4 rows, newest first.
      const all = (await (
        await fetch(`${baseUrl}/devices/${id}/packets`)
      ).json()) as Array<{ msgnum: string; parseStatus: string; receivedAt: string }>;
      assert.equal(all.length, 4);
      const times = all.map((p) => Date.parse(p.receivedAt));
      for (let i = 0; i < times.length - 1; i++) {
        assert.ok(times[i]! >= times[i + 1]!, "results are newest-first");
      }

      // parseStatus filter narrows to 2 'ok' rows.
      const okOnly = (await (
        await fetch(`${baseUrl}/devices/${id}/packets?parseStatus=ok`)
      ).json()) as Array<{ parseStatus: string }>;
      assert.equal(okOnly.length, 2);
      assert.ok(okOnly.every((p) => p.parseStatus === "ok"));

      // before-cursor pagination: ask for everything strictly older than t2.
      const olderThanT2 = (await (
        await fetch(
          `${baseUrl}/devices/${id}/packets?before=${encodeURIComponent(
            t2.toISOString(),
          )}`,
        )
      ).json()) as Array<{ msgnum: string; receivedAt: string }>;
      assert.equal(olderThanT2.length, 2, "two packets are strictly older than t2");
      for (const row of olderThanT2) {
        assert.ok(
          Date.parse(row.receivedAt) < t2.getTime(),
          "every paginated row is strictly older than the cursor",
        );
      }

      // limit=1 returns the most recent only.
      const top = (await (
        await fetch(`${baseUrl}/devices/${id}/packets?limit=1`)
      ).json()) as Array<{ msgnum: string }>;
      assert.equal(top.length, 1);
      assert.equal(top[0]!.msgnum, "0003", "newest packet returned first");
    });

    it("400s when limit exceeds the documented max (200)", async () => {
      const id = freshId("L");
      SEEDED_DEVICE_IDS.push(id);
      await seedDevice({ id });

      const resp = await fetch(`${baseUrl}/devices/${id}/packets?limit=999`);
      assert.equal(resp.status, 400);
      const body = (await resp.json()) as {
        error: string;
        issues: Array<{ path: string[] }>;
      };
      assert.equal(body.error, "validation_error");
      assert.ok(body.issues.some((i) => i.path.includes("limit")));
    });

    it("returns 404 when the device id does not exist", async () => {
      const resp = await fetch(`${baseUrl}/devices/Z999/packets`);
      assert.equal(resp.status, 404);
    });
  });

  describe("GET /devices/{id}/reports/{kind}", () => {
    it("returns RGP reports for the device", async () => {
      const id = freshId("R");
      SEEDED_DEVICE_IDS.push(id);
      await seedDevice({ id });

      const ts = new Date(Date.now() - 5_000);
      const pktId = await seedPacket({
        deviceId: id,
        receivedAt: ts,
        msgnum: "0010",
      });
      await seedFrameAndRgp(id, pktId, "0010", ts);

      const resp = await fetch(`${baseUrl}/devices/${id}/reports/rgp`);
      assert.equal(resp.status, 200);
      const rows = (await resp.json()) as Array<{
        deviceId: string;
        lat: number;
        lon: number;
        ignition: boolean;
      }>;
      assert.equal(rows.length, 1);
      assert.equal(rows[0]!.deviceId, id);
      assert.equal(typeof rows[0]!.lat, "number");
      assert.equal(typeof rows[0]!.lon, "number");
      assert.equal(rows[0]!.ignition, true);
    });

    it("returns RUV00 / RUV01 from their dedicated tables", async () => {
      const id = freshId("U");
      SEEDED_DEVICE_IDS.push(id);
      await seedDevice({ id });

      const ts0 = new Date(Date.now() - 6_000);
      const ts1 = new Date(Date.now() - 5_000);
      const p0 = await seedPacket({ deviceId: id, receivedAt: ts0, msgnum: "0020" });
      const p1 = await seedPacket({ deviceId: id, receivedAt: ts1, msgnum: "0021" });
      await seedFrameAndRuv00(id, p0, "0020", ts0);
      await seedFrameAndRuv01(id, p1, "0021", ts1);

      const ruv00 = (await (
        await fetch(`${baseUrl}/devices/${id}/reports/ruv00`)
      ).json()) as Array<{
        firmware: string;
        board: string;
        iccid: string;
      }>;
      assert.equal(ruv00.length, 1);
      assert.equal(ruv00[0]!.firmware, "FW1.2.3");
      assert.equal(ruv00[0]!.board, "B7");
      assert.equal(ruv00[0]!.iccid, "8955010100000000000F");

      const ruv01 = (await (
        await fetch(`${baseUrl}/devices/${id}/reports/ruv01`)
      ).json()) as Array<{
        odometerM: number;
        hourmeterMin: number;
        driverId: string;
      }>;
      assert.equal(ruv01.length, 1);
      assert.equal(
        ruv01[0]!.odometerM,
        2222222222,
        "bigint odometer survives the JSON roundtrip",
      );
      assert.equal(ruv01[0]!.hourmeterMin, 12345);
      assert.equal(ruv01[0]!.driverId, "MOTORISTA1");

      // Crossing tables: RUV02 and RUV03 should be empty for this device.
      const ruv02 = (await (
        await fetch(`${baseUrl}/devices/${id}/reports/ruv02`)
      ).json()) as unknown[];
      assert.equal(ruv02.length, 0);
    });

    it("returns 404 when the device id does not exist", async () => {
      const resp = await fetch(`${baseUrl}/devices/Z999/reports/rgp`);
      assert.equal(resp.status, 404);
    });

    it("orders RGP reports newest-first and honours `limit` + `before`", async () => {
      const id = freshId("O");
      SEEDED_DEVICE_IDS.push(id);
      await seedDevice({ id });

      // Three reports, one per second, newest to oldest.
      const t0 = new Date(Date.now() - 30_000);
      const t1 = new Date(Date.now() - 20_000);
      const t2 = new Date(Date.now() - 10_000);

      const p0 = await seedPacket({ deviceId: id, receivedAt: t0, msgnum: "0030" });
      const p1 = await seedPacket({ deviceId: id, receivedAt: t1, msgnum: "0031" });
      const p2 = await seedPacket({ deviceId: id, receivedAt: t2, msgnum: "0032" });
      await seedFrameAndRgp(id, p0, "0030", t0);
      await seedFrameAndRgp(id, p1, "0031", t1);
      await seedFrameAndRgp(id, p2, "0032", t2);

      // No filter — three rows, newest first.
      const all = (await (
        await fetch(`${baseUrl}/devices/${id}/reports/rgp`)
      ).json()) as Array<{ receivedAt: string }>;
      assert.equal(all.length, 3);
      const times = all.map((r) => Date.parse(r.receivedAt));
      for (let i = 0; i < times.length - 1; i++) {
        assert.ok(times[i]! >= times[i + 1]!, "newest-first ordering");
      }

      // limit=1 returns the most recent only.
      const top = (await (
        await fetch(`${baseUrl}/devices/${id}/reports/rgp?limit=1`)
      ).json()) as Array<{ receivedAt: string }>;
      assert.equal(top.length, 1);
      assert.equal(Date.parse(top[0]!.receivedAt), t2.getTime());

      // before=t1: only the t0 row qualifies (strict <).
      const older = (await (
        await fetch(
          `${baseUrl}/devices/${id}/reports/rgp?before=${encodeURIComponent(t1.toISOString())}`,
        )
      ).json()) as Array<{ receivedAt: string }>;
      assert.equal(older.length, 1);
      assert.equal(Date.parse(older[0]!.receivedAt), t0.getTime());
    });
  });

  describe("GET /fleet/recent-packets", () => {
    it("returns recent packets across all devices, newest first, limit honoured", async () => {
      const id = freshId("F");
      SEEDED_DEVICE_IDS.push(id);
      await seedDevice({ id });

      // Seed two packets so we have something definite to look for.
      // We deliberately do NOT assert "ours is at the top" because the
      // dev DB is shared with the gateway and another seed could land
      // between our insert and our fetch — what we do assert is that
      // (a) ours appears in the recent feed, (b) limit is honoured,
      // (c) the feed is sorted newest-first.
      const fresh = new Date();
      await seedPacket({ deviceId: id, receivedAt: fresh, parseStatus: "ok", msgnum: "00FF" });

      const rows = (await (
        await fetch(`${baseUrl}/fleet/recent-packets?limit=10`)
      ).json()) as Array<{ deviceId: string | null; receivedAt: string }>;

      assert.ok(
        rows.some((r) => r.deviceId === id),
        "our just-inserted packet appears in the recent feed",
      );
      assert.ok(rows.length <= 10, "limit honoured");

      // Verify global ordering across the whole window.
      const times = rows.map((r) => Date.parse(r.receivedAt));
      for (let i = 0; i < times.length - 1; i++) {
        assert.ok(times[i]! >= times[i + 1]!, "newest-first across the fleet");
      }
    });

    it("includes orphan packets (deviceId is null) — checksum_mismatch path", async () => {
      // Checksum-mismatch packets in M3 don't have a deviceId. The fleet
      // feed must still surface them so operators can see scanning attacks
      // / misconfigured trackers.
      const orphan = await seedPacket({
        deviceId: null,
        receivedAt: new Date(),
        parseStatus: "checksum_mismatch",
      });
      SEEDED_ORPHAN_PACKET_IDS.push(orphan);

      const rows = (await (
        await fetch(`${baseUrl}/fleet/recent-packets?limit=20`)
      ).json()) as Array<{ id: string; deviceId: string | null }>;
      const found = rows.find((r) => r.id === orphan);
      assert.ok(found, "orphan packet appears in the fleet feed");
      assert.equal(found!.deviceId, null);
    });
  });
});
