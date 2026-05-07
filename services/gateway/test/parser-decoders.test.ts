// Per-opcode decoder regression tests (spec §9, §13).
//
// These tests pin the field-map for each opcode against fixtures that were
// chosen because we can compute every expected value by hand from the spec.
// Two kinds of fixtures live here:
//
//   1. The literal worked example from the spec ("§9.2 sample"). If this
//      drifts, the parser has diverged from the protocol document.
//   2. A real packet captured from the live VPS gateway
//      (`fixtures/xvm-live.txt`). If this drifts, the parser has diverged
//      from what real devices actually emit.
//
// Background — KNOWN_ISSUES #1: a synthetic test packet of the form
//   `>RGP180826144632,-23123456,-46654321,180,15,1,80,2;...`
// was reported to produce `speedKmh = 321` and NULL lat/lon. That test
// packet was malformed: §9.2 RGP is a *packed* body (no commas). The
// parser correctly slices the packed payload; CSV-shaped input was the
// bug. This file pins both the spec sample and a real packet so the
// confusion does not recur.
//
// Run with:  pnpm --filter @workspace/gateway run test

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  decodeDigitalInputs,
  decodeLat,
  decodeLon,
  decodeRGP,
} from "../src/parser.ts";

// ---------------------------------------------------------------------------
// decodeLat / decodeLon — primitive scaling (spec §13.3)
// ---------------------------------------------------------------------------

test("decodeLat: spec §13.3 sample (-3597296 → -35.97296)", () => {
  assert.equal(decodeLat("-3597296"), -35.97296);
});

test("decodeLat: positive sign optional", () => {
  assert.equal(decodeLat("0012345"), 0.12345);
  assert.equal(decodeLat("+0012345"), 0.12345);
});

test("decodeLat: rejects wrong width or non-digits", () => {
  assert.equal(decodeLat("-359729"), undefined); // 6 digits, too short
  assert.equal(decodeLat("-35972960"), undefined); // 8 digits, too long
  assert.equal(decodeLat(",-359729"), undefined); // CSV leak (KI #1 cause)
  assert.equal(decodeLat("abcdefg"), undefined);
});

test("decodeLon: spec §13.3 sample (-06273557 → -62.73557)", () => {
  assert.equal(decodeLon("-06273557"), -62.73557);
});

test("decodeLon: rejects wrong width or non-digits", () => {
  assert.equal(decodeLon("-0627355"), undefined); // 7 digits, too short
  assert.equal(decodeLon("-062735570"), undefined); // 9 digits, too long
  assert.equal(decodeLon("56,-46654"), undefined); // CSV leak (KI #1 cause)
});

// ---------------------------------------------------------------------------
// decodeDigitalInputs — bitmask flags (spec §9.6, §9.8)
// ---------------------------------------------------------------------------

test("decodeDigitalInputs: ignition + mainPower bits", () => {
  // 0xC0 = 11000000 → ignition (bit7) + mainPower (bit6) both ON
  const di = decodeDigitalInputs("C0");
  assert.ok(di);
  assert.equal(di.raw, 0xc0);
  assert.equal(di.ignition, true);
  assert.equal(di.mainPower, true);
});

test("decodeDigitalInputs: 0x0A → both power flags off", () => {
  const di = decodeDigitalInputs("0A");
  assert.ok(di);
  assert.equal(di.raw, 0x0a);
  assert.equal(di.ignition, false);
  assert.equal(di.mainPower, false);
});

test("decodeDigitalInputs: rejects non-hex", () => {
  assert.equal(decodeDigitalInputs("ZZ"), undefined);
  assert.equal(decodeDigitalInputs("1"), undefined);
});

// ---------------------------------------------------------------------------
// decodeRGP — full field map (spec §9.2)
// ---------------------------------------------------------------------------

test("decodeRGP: spec §9.2 worked example decodes every field", () => {
  // Spec §9.2 sample packet, body only (between `>` and `;ID=`):
  //   >RGP110715030802-3597296-062735570000000FF5F0000;ID=0001;#167A;*5F<
  // Expected per the spec table:
  //   date=110715 time=030802 lat=-3597296 lon=-06273557
  //   speed=000 dir=000 gps=0 since=FF dimask=5F reserved=00 hdop=00
  const r = decodeRGP("RGP110715030802-3597296-062735570000000FF5F0000");

  assert.equal(r.opcode, "RGP");
  assert.equal(r.ts, "2015-07-11T03:08:02Z");
  assert.equal(r.lat, -35.97296);
  assert.equal(r.lon, -62.73557);
  assert.equal(r.speedKmh, 0);
  assert.equal(r.headingDeg, 0);
  assert.equal(r.gpsStatus, 0);
  assert.equal(r.secondsSinceFix, 0xff); // hex → 255
  assert.equal(r.hdop, 0);

  assert.ok(r.digitalInputs);
  assert.equal(r.digitalInputs.raw, 0x5f);
  // 0x5F = 01011111 → ignition=0, mainPower=1
  assert.equal(r.digitalInputs.ignition, false);
  assert.equal(r.digitalInputs.mainPower, true);
});

test("decodeRGP: real live-capture packet (PNMB, 2020-11-01) — full field map", () => {
  // From services/gateway/fixtures/xvm-live.txt (NDJSON line 2). This is
  // the canonical regression for KNOWN_ISSUES #1.
  //
  // Full datagram on the wire:
  //   >RGP011120174312-3597296-062735570000080010A100012;ID=PNMB;#0001;*3A<\r\n
  //
  // Body (between `>` and `;ID=`):
  const r = decodeRGP("RGP011120174312-3597296-062735570000080010A100012");

  assert.equal(r.opcode, "RGP");
  // date=011120 → 01/11/2020, time=174312 → 17:43:12 UTC
  assert.equal(r.ts, "2020-11-01T17:43:12Z");
  // lat -3597296 → -35.97296° ; lon -06273557 → -62.73557°
  assert.equal(r.lat, -35.97296);
  assert.equal(r.lon, -62.73557);
  // KEY ASSERTION for KI #1: speed comes from chars 29..31 ("000"),
  // NOT from a comma-shifted slice. Synthetic CSV body produced 321 here.
  assert.equal(r.speedKmh, 0);
  assert.equal(r.headingDeg, 8); // dir = "008"
  assert.equal(r.gpsStatus, 0);
  assert.equal(r.secondsSinceFix, 0x01);
  assert.equal(r.hdop, 0); // hdop = "00"

  assert.ok(r.digitalInputs);
  assert.equal(r.digitalInputs.raw, 0x0a);
});

test("decodeRGP: short body → tolerant decode (no throw, undefined fields)", () => {
  // Spec §13.1: missing/short fields produce undefined for that field
  // rather than rejecting the whole frame.
  const r = decodeRGP("RGP110715030802-3597296"); // missing everything past lat
  assert.equal(r.opcode, "RGP");
  assert.equal(r.ts, "2015-07-11T03:08:02Z");
  assert.equal(r.lat, -35.97296);
  assert.equal(r.lon, undefined);
  assert.equal(r.speedKmh, undefined);
});

test("decodeRGP: rejects non-RGP body (returns shell with _raw)", () => {
  const r = decodeRGP("RUV01100,NT001,200422152216");
  assert.equal(r.opcode, "RGP");
  assert.equal(r.ts, undefined);
  assert.equal(r.lat, undefined);
});

test("decodeRGP: malformed CSV-shaped body (KI #1 reproduction) — every field undefined", () => {
  // The synthetic packet from the original KNOWN_ISSUES #1 report:
  //   >RGP180826144632,-23123456,-46654321,180,15,1,80,2;...
  // Spec §9.2 says RGP is a *packed* body. The decoder hardens itself by
  // bailing out as soon as it sees a comma in the post-opcode payload —
  // without that guard, fixed-width slicing can land on three consecutive
  // digits inside a comma-separated payload and read e.g. speedKmh=321
  // out of `15,1,80`. This test pins both the guard and the corrected
  // reading of #1: the bug was the synthetic test packet, not the
  // protocol-conformant parser logic.
  const r = decodeRGP("RGP180826144632,-23123456,-46654321,180,15,1,80,2");
  assert.equal(r.opcode, "RGP");
  assert.equal(r.ts, undefined);
  assert.equal(r.lat, undefined);
  assert.equal(r.lon, undefined);
  assert.equal(r.speedKmh, undefined);
  assert.equal(r.headingDeg, undefined);
  assert.equal(r.gpsStatus, undefined);
  assert.equal(r.digitalInputs, undefined);
});
