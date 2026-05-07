// Offline replay test (Milestone 1 exit criterion):
//   "An offline test corpus is replayed into the parser to prove RGP /
//    RUV00 / RUV01 / RUV02 / RUV03 all decode."
//
// Reads `fixtures/xvm-live.txt` (NDJSON with `{ts, peer, bytes, ascii}`
// per line — same format the live gateway writes), pumps each datagram
// through the framing + envelope + per-opcode decoders, and asserts:
//   - every device-originated frame yields a valid ACK datagram
//   - bad-LRC and malformed-envelope frames are rejected (no ACK)
//   - server-originated responses (msgnum >= 0x8000) get NO ACK
//   - all five report opcodes (RGP, RUV00, RUV01, RUV02, RUV03) decode
//   - per-opcode field extraction (RUV01 hourmeter, RGP lat/lon)
//
// Lower-level framing/checksum/envelope unit tests live in `xvm.test.ts`
// (next to the primitives they cover); this file owns the corpus-level
// integration check that ties everything together.
//
// Run with:  pnpm --filter @workspace/gateway run test

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildAckBuffer,
  isDeviceOriginated,
  parseEnvelope as parseEnvelopeBase,
  splitFrames,
  verifyChecksum,
  xorChecksum,
} from "../src/lib/xvm.ts";
import { decodeReport, parseEnvelope } from "../src/parser.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.resolve(here, "../../../fixtures/xvm-live.txt");

interface CaptureLine {
  ts: string;
  peer: string;
  bytes: number;
  ascii: string;
}

function loadCorpus(): CaptureLine[] {
  const raw = readFileSync(fixturePath, "utf8");
  return raw
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as CaptureLine)
    .filter((l) => l.ascii && l.ascii.startsWith(">"));
}

interface ProcessedFrame {
  envelope: ReturnType<typeof parseEnvelope>;
  report: ReturnType<typeof decodeReport> | null;
  ackEmitted: boolean;
}

/**
 * Mirror what the live UDP handler does, but in-memory: split frames in the
 * datagram, parse the trailer, verify the checksum over the WHOLE datagram
 * (per spec §7), decode the opcode, and report whether an ACK would be sent.
 *
 * Returns one entry per frame whose envelope parsed and whose checksum
 * matched. Malformed and bad-LRC frames are dropped.
 */
function processDatagram(ascii: string): ProcessedFrame[] {
  const out: ProcessedFrame[] = [];
  const frames = splitFrames(ascii);
  for (const raw of frames) {
    const baseEnv = parseEnvelopeBase(raw);
    if (!baseEnv) continue; // multi-message inner frame or malformed
    if (!verifyChecksum(ascii, baseEnv)) continue; // bad LRC → no ACK
    const env = parseEnvelope(raw);
    if (!env) continue;
    out.push({
      envelope: env,
      report: decodeReport(env),
      ackEmitted: isDeviceOriginated(env.msgnum),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// envelope-level enrichment unique to parser.ts (direction inference).
// (Lower-level framing/checksum tests are in xvm.test.ts.)
// ---------------------------------------------------------------------------

test("envelope: direction inferred from msgnum range (spec §4)", () => {
  const dPrefix = ">ACK;ID=PNMB;#0001;";
  const sPrefix = ">ACK;ID=PNMB;#8001;";
  const deviceFrame = `${dPrefix}*${xorChecksum(dPrefix)}<`;
  const serverFrame = `${sPrefix}*${xorChecksum(sPrefix)}<`;
  assert.equal(parseEnvelope(deviceFrame)?.direction, "device->server");
  assert.equal(parseEnvelope(serverFrame)?.direction, "server->device");
});

test("envelope: per-frame checksum result is exposed for callers", () => {
  const prefix = ">ACK;ID=PNMB;#0001;";
  const frame = `${prefix}*${xorChecksum(prefix)}<`;
  const env = parseEnvelope(frame);
  assert.ok(env);
  assert.equal(env.checksum.ok, true);
  assert.equal(env.checksum.expected, env.checksum.got);

  // Tamper one byte → mismatch reported, but envelope still parses.
  const bad = frame.replace("PNMB", "QNMB");
  const tampered = parseEnvelope(bad);
  assert.ok(tampered);
  assert.equal(tampered.checksum.ok, false);
});

test("ack: buildAckBuffer round-trips with valid checksum", () => {
  const ack = buildAckBuffer("PNMB", "0001").toString("ascii");
  assert.match(ack, /^>ACK;ID=PNMB;#0001;\*[0-9A-F]{2}<\r\n$/);
  const env = parseEnvelopeBase(ack.replace(/\r\n$/, ""));
  assert.ok(env);
  assert.equal(env.opcode, "ACK");
  assert.equal(verifyChecksum(ack, env), true);
});

// ---------------------------------------------------------------------------
// Corpus replay — every fixture line is exercised end-to-end.
// ---------------------------------------------------------------------------

test("replay: every opcode in the corpus decodes correctly", () => {
  const corpus = loadCorpus();
  assert.ok(corpus.length >= 5, `expected ≥5 fixture lines, got ${corpus.length}`);

  const seenOpcodes = new Set<string>();
  let deviceOriginated = 0;
  let acksEmitted = 0;
  let rejected = 0;

  for (const line of corpus) {
    const processed = processDatagram(line.ascii);
    if (processed.length === 0) {
      rejected += 1;
      continue;
    }
    for (const p of processed) {
      assert.ok(p.envelope, `envelope null for ${line.ascii}`);
      assert.ok(p.report, `report null for ${line.ascii}`);
      seenOpcodes.add(p.envelope.opcode);
      if (p.envelope.direction === "device->server") {
        deviceOriginated += 1;
        if (p.ackEmitted) acksEmitted += 1;
      } else {
        // server-originated → must NOT ack
        assert.equal(p.ackEmitted, false,
          `ACK incorrectly emitted for server-originated frame ${line.ascii}`);
      }
    }
  }

  // Every device-originated frame in the corpus must have produced an ACK.
  assert.equal(acksEmitted, deviceOriginated,
    `${deviceOriginated - acksEmitted} device frames went unacked`);

  for (const op of ["RGP", "RUV00", "RUV01", "RUV02", "RUV03"] as const) {
    assert.ok(
      seenOpcodes.has(op),
      `opcode ${op} missing from decoded set: ${[...seenOpcodes].join(", ")}`,
    );
  }
  // Sanity: rejected pile shouldn't be the whole corpus.
  assert.ok(rejected < corpus.length, "every datagram was rejected — fixture broken?");
});

test("replay: bad-LRC frames are rejected and not ACKed", () => {
  const prefix = ">ACK;ID=PNMB;#0001;";
  const goodLrc = xorChecksum(prefix);
  const badFrame = `${prefix}*FF<`; // LRC almost certainly wrong
  assert.notEqual(goodLrc, "FF", "test setup: real LRC must differ from FF");
  const processed = processDatagram(badFrame);
  assert.equal(processed.length, 0, "bad-LRC frame must yield no processed entries");
});

test("replay: RUV01 hourmeter decodes (Milestone 1 must surface engine hours)", () => {
  const corpus = loadCorpus();
  const ruv01 = corpus
    .flatMap((l) => processDatagram(l.ascii))
    .filter((p) => p.envelope?.opcode === "RUV01")
    .map((p) => p.report)
    .filter((r): r is Extract<NonNullable<typeof r>, { opcode: "RUV01" }> =>
      !!r && r.opcode === "RUV01",
    );
  assert.ok(ruv01.length > 0, "no RUV01 frames decoded from corpus");
  for (const r of ruv01) {
    assert.equal(typeof r.hourmeterMin, "number",
      `RUV01 missing hourmeterMin: ${r._raw}`);
  }
});

test("replay: RGP lat/lon decode to plausible values (sign + decimal placement)", () => {
  const corpus = loadCorpus();
  const rgp = corpus
    .flatMap((l) => processDatagram(l.ascii))
    .filter((p) => p.envelope?.opcode === "RGP")
    .map((p) => p.report)
    .filter((r): r is Extract<NonNullable<typeof r>, { opcode: "RGP" }> =>
      !!r && r.opcode === "RGP",
    );
  assert.ok(rgp.length > 0, "no RGP frames decoded from corpus");
  for (const r of rgp) {
    assert.equal(typeof r.lat, "number", `RGP missing lat: ${r._raw}`);
    assert.equal(typeof r.lon, "number", `RGP missing lon: ${r._raw}`);
    assert.ok(Math.abs(r.lat!) <= 90, `RGP lat out of range: ${r.lat}`);
    assert.ok(Math.abs(r.lon!) <= 180, `RGP lon out of range: ${r.lon}`);
  }
});
