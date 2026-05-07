// XVM parser (vl06-protocol-spec §2, §4, §9).
//
// Two layers, on top of the pure framing/envelope/checksum primitives in
// `./lib/xvm.ts`:
//   1. `parseEnvelope` enriches the base envelope with `direction`,
//      `msgnumDec`, and a per-frame `checksum` result for callers that
//      verify one frame at a time (e.g. the offline replay test).
//   2. Per-opcode field decoders for RGP / RUV00 / RUV01 / RUV02 / RUV03.
//
// The decoders are deliberately tolerant: missing/short fields produce
// `undefined` for that one field rather than throwing the whole frame out.
// Spec §13.1: "Don't assume a fixed character count per field — use comma
// split for the body, then validate widths/types per opcode."
//
// The live UDP path uses the lower-level `lib/xvm.ts` + `handler.ts`
// directly; this module exists so the corpus replay test (and Milestone 2
// DB persistence) can extract structured fields per opcode without
// duplicating the framing/checksum logic.

import {
  parseEnvelope as parseEnvelopeBase,
  verifyChecksum as verifyChecksumBase,
  xorChecksum,
} from "./lib/xvm.js";

export type Direction = "device->server" | "server->device";

export interface ChecksumResult {
  ok: boolean;
  expected: string;
  got: string;
}

export interface FrameEnvelope {
  raw: string;
  /** Body between `>` and `;ID=` — opcode + payload, no trailer. */
  body: string;
  /** Device id (`ID=xxxx`), uppercase. */
  id: string;
  /** 4-hex-char message number, uppercase, zero-padded. */
  msgnum: string;
  /** Numeric form of msgnum (0..0xFFFF). */
  msgnumDec: number;
  /** Reported `*XX` checksum (uppercase, zero-padded to 2 chars for display). */
  lrc: string;
  /** Opcode prefix — `RGP`, `RUV01`, `ACK`, `RUS00`, etc. */
  opcode: string;
  /** Direction inferred from msgnum range (spec §4). */
  direction: Direction;
  /**
   * Result of recomputing the XOR-LRC over this single frame. NOTE: for
   * multi-message packets (spec §7) the device computes the LRC over the
   * ENTIRE datagram; use `lib/xvm.ts#verifyChecksum(packet, trailer)` from
   * the live UDP path. Per-frame verification here is correct for offline
   * replay where every line in the corpus is a single-frame datagram.
   */
  checksum: ChecksumResult;
}

/**
 * Parse a complete `>…<` frame and enrich with direction + checksum.
 *
 * Returns `null` when the frame has no `;ID=…;#…;*…` trailer — that is the
 * normal shape of inner frames inside a multi-message packet (spec §7) and
 * also of any malformed datagram.
 */
export function parseEnvelope(frame: string): FrameEnvelope | null {
  const trimmed = frame.replace(/\r?\n$/, "");
  const env = parseEnvelopeBase(trimmed);
  if (!env) return null;
  const dec = parseInt(env.msgnum, 16);
  if (!Number.isFinite(dec)) return null;
  const expected = xorChecksum(trimmed);
  const got = env.lrc.toUpperCase().padStart(2, "0");
  const ok = verifyChecksumBase(trimmed, env);
  return {
    raw: trimmed,
    body: env.body,
    id: env.id,
    msgnum: env.msgnum,
    msgnumDec: dec,
    lrc: got,
    opcode: env.opcode,
    direction: dec < 0x8000 ? "device->server" : "server->device",
    checksum: { ok, expected, got },
  };
}

// ---------------------------------------------------------------------------
// Field decoders (spec §9, §13)
// ---------------------------------------------------------------------------

/**
 * Lat is `sign + 7 digits`, last 5 digits fractional.
 * `-3597296` → `-35.97296°` (spec §13.3).
 */
export function decodeLat(s: string): number | undefined {
  if (!/^[-+]?\d{7}$/.test(s)) return undefined;
  const sign = s[0] === "-" ? -1 : 1;
  const digits = s.replace(/^[-+]/, "");
  if (digits.length !== 7) return undefined;
  const int = digits.slice(0, 2);
  const frac = digits.slice(2);
  return sign * Number(`${int}.${frac}`);
}

/**
 * Lon is `sign + 8 digits`, last 5 digits fractional.
 * `-06273557` → `-62.73557°` (spec §13.3).
 */
export function decodeLon(s: string): number | undefined {
  if (!/^[-+]?\d{8}$/.test(s)) return undefined;
  const sign = s[0] === "-" ? -1 : 1;
  const digits = s.replace(/^[-+]/, "");
  if (digits.length !== 8) return undefined;
  const int = digits.slice(0, 3);
  const frac = digits.slice(3);
  return sign * Number(`${int}.${frac}`);
}

/**
 * Decode the digital-input bitmask (spec §9.8). Bit 7 = ignition (1=ON).
 * Bits 0–3 are inverted (1=OFF). Bits 4–5 are not present on VL06; we
 * decode them anyway and let the upper layer ignore them per device model.
 */
export function decodeDigitalInputs(hex: string): {
  raw: number;
  ignition: boolean;
  mainPower: boolean;
  in: [boolean, boolean, boolean, boolean, boolean, boolean]; // IN0..IN5 (true = ACTIVE)
} | undefined {
  if (!/^[0-9A-Fa-f]{2}$/.test(hex)) return undefined;
  const raw = parseInt(hex, 16);
  return {
    raw,
    ignition: (raw & 0x80) !== 0,
    mainPower: (raw & 0x40) !== 0,
    in: [
      (raw & 0x01) === 0, // IN0 inverted
      (raw & 0x02) === 0, // IN1 inverted
      (raw & 0x04) === 0, // IN2 inverted
      (raw & 0x08) === 0, // IN3 inverted
      (raw & 0x10) !== 0, // IN4 (not on VL06)
      (raw & 0x20) !== 0, // IN5 (not on VL06)
    ],
  };
}

/** `ddmmyy` + `hhmmss` UTC → ISO 8601 string. Returns undefined if malformed. */
export function decodeDateTime(date6: string, time6: string): string | undefined {
  if (!/^\d{6}$/.test(date6) || !/^\d{6}$/.test(time6)) return undefined;
  const dd = date6.slice(0, 2);
  const mm = date6.slice(2, 4);
  const yy = date6.slice(4, 6);
  const HH = time6.slice(0, 2);
  const MM = time6.slice(2, 4);
  const SS = time6.slice(4, 6);
  // 2-digit years: device clocks are post-2000.
  return `20${yy}-${mm}-${dd}T${HH}:${MM}:${SS}Z`;
}

// ---------------------------------------------------------------------------
// Per-opcode decoders. Each returns a structured object; `_raw` keeps the
// original payload string for downstream debugging / DB columns.
// ---------------------------------------------------------------------------

export interface RgpReport {
  opcode: "RGP";
  ts?: string;
  lat?: number;
  lon?: number;
  speedKmh?: number;
  headingDeg?: number;
  gpsStatus?: number;
  secondsSinceFix?: number;
  digitalInputs?: ReturnType<typeof decodeDigitalInputs>;
  hdop?: number;
  _raw: string;
}

/**
 * RGP login/handshake (spec §9.2). Single packed body, no commas:
 *   RGP + ddmmyy(6) + hhmmss(6) + lat(8) + lon(9) + speed(3) + dir(3)
 *       + gps(1) + sincefix(2) + dimask(2) + reserved(2) + hdop(2)
 */
export function decodeRGP(body: string): RgpReport {
  const out: RgpReport = { opcode: "RGP", _raw: body };
  if (!body.startsWith("RGP")) return out;
  const p = body.slice(3);
  // Spec §9.2: RGP is a *packed* payload — no commas. Any comma in the
  // body means the packet is misshapen (e.g. RUV-style fields glued
  // behind an `RGP` opcode, or a hand-crafted synthetic test packet).
  // Without this guard, fixed-width slicing happily produces values out
  // of comma-shifted positions — that was the root cause behind
  // KNOWN_ISSUES #1 (speed=321 read out of `15` followed by punctuation).
  if (p.includes(",")) return out;
  // Field offsets relative to p
  const date = p.slice(0, 6);
  const time = p.slice(6, 12);
  const lat = p.slice(12, 20);
  const lon = p.slice(20, 29);
  const speed = p.slice(29, 32);
  const dir = p.slice(32, 35);
  const gps = p.slice(35, 36);
  const since = p.slice(36, 38);
  const dimask = p.slice(38, 40);
  // bytes 40–41 reserved
  const hdop = p.slice(42, 44);

  out.ts = decodeDateTime(date, time);
  out.lat = decodeLat(lat);
  out.lon = decodeLon(lon);
  if (/^\d{3}$/.test(speed)) out.speedKmh = Number(speed);
  if (/^\d{3}$/.test(dir)) out.headingDeg = Number(dir);
  if (/^\d$/.test(gps)) out.gpsStatus = Number(gps);
  if (/^[0-9A-Fa-f]{2}$/.test(since)) out.secondsSinceFix = parseInt(since, 16);
  out.digitalInputs = decodeDigitalInputs(dimask);
  if (/^\d{2}$/.test(hdop)) out.hdop = Number(hdop);
  return out;
}

/** Common RUV header parser (spec §9.1). */
function decodeRuvHeader(parts: string[]): {
  event?: number;
  protocolId?: string;
  ts?: string;
} {
  // parts[0] e.g. "RUV01100"  → opcode + 3-digit event
  // parts[1] = protocol id (NT001/NT003/...)
  // parts[2] starts with date(6)+time(6)+...
  const head = parts[0] ?? "";
  const event = head.length >= 8 ? Number(head.slice(5, 8)) : undefined;
  const protocolId = parts[1];
  let ts: string | undefined;
  if (parts[2] && parts[2].length >= 12) {
    ts = decodeDateTime(parts[2].slice(0, 6), parts[2].slice(6, 12));
  }
  return {
    event: Number.isFinite(event) ? event : undefined,
    protocolId,
    ts,
  };
}

export interface Ruv00Report {
  opcode: "RUV00";
  event?: number;
  protocolId?: string;
  ts?: string;
  backupBatteryV?: number;
  mainSupplyV?: number;
  serial?: string;
  firmware?: string;
  board?: string;
  script?: string;
  peripheral?: string;
  rainSpeedFlag?: number;
  hourmeterSource?: number;
  sharpEventSource?: number;
  iccid?: string;
  _raw: string;
}

/**
 * RUV00 presentation/installation report (spec §9.3).
 * Sample: RUV00154,NT003,200422152216,04141337,05F12244,9.20_,BR59,V1.2_CAN,-,0,1,0,89551080157011558621
 */
export function decodeRUV00(body: string): Ruv00Report {
  const out: Ruv00Report = { opcode: "RUV00", _raw: body };
  const parts = body.split(",");
  const hdr = decodeRuvHeader(parts);
  Object.assign(out, hdr);

  // parts[3] = "0414" + "1337" packed (V × 100 each)
  const volts = parts[3];
  if (volts && /^\d{8}$/.test(volts)) {
    out.backupBatteryV = Number(volts.slice(0, 4)) / 100;
    out.mainSupplyV = Number(volts.slice(4, 8)) / 100;
  }
  if (parts[4]) out.serial = parts[4];
  if (parts[5]) out.firmware = parts[5].replace(/_+$/, ""); // trailing `_` is padding
  if (parts[6]) out.board = parts[6];
  if (parts[7]) out.script = parts[7];
  if (parts[8]) out.peripheral = parts[8];
  if (parts[9] && /^\d$/.test(parts[9])) out.rainSpeedFlag = Number(parts[9]);
  if (parts[10] && /^\d$/.test(parts[10])) out.hourmeterSource = Number(parts[10]);
  if (parts[11] && /^\d$/.test(parts[11])) out.sharpEventSource = Number(parts[11]);
  if (parts[12]) out.iccid = parts[12];
  return out;
}

export interface Ruv01Report {
  opcode: "RUV01";
  event?: number;
  protocolId?: string;
  ts?: string;
  lat?: number;
  lon?: number;
  speedKmh?: number;
  headingDeg?: number;
  gpsStatus?: number;
  secondsSinceFix?: number;
  digitalInputs?: ReturnType<typeof decodeDigitalInputs>;
  hdop?: number;
  backupBatteryV?: number;
  mainSupplyV?: number;
  maxSpeedViolation?: number;
  maxRpmViolation?: number;
  hourmeterMin?: number;
  odometerM?: number;
  rpm?: number;
  engineTempC?: number;
  oilPressureKpa?: number;
  fuelPct?: number;
  rainSpeedFlag?: number;
  online?: boolean;
  network?: string;
  driverId?: string;
  _raw: string;
}

/**
 * RUV01 basic data report (spec §9.4). The "GPS block" (lat..hdop) lives in
 * parts[2] as a single packed string of width 44; everything else is
 * comma-delimited.
 */
export function decodeRUV01(body: string): Ruv01Report {
  const out: Ruv01Report = { opcode: "RUV01", _raw: body };
  const parts = body.split(",");
  Object.assign(out, decodeRuvHeader(parts));

  // parts[2] = date(6) time(6) lat(8) lon(9) speed(3) dir(3) gps(1) since(2) dimask(2) reserved(2) hdop(2)
  const blk = parts[2];
  if (blk && blk.length >= 44) {
    const lat = blk.slice(12, 20);
    const lon = blk.slice(20, 29);
    const speed = blk.slice(29, 32);
    const dir = blk.slice(32, 35);
    const gps = blk.slice(35, 36);
    const since = blk.slice(36, 38);
    const dimask = blk.slice(38, 40);
    const hdop = blk.slice(42, 44);
    out.lat = decodeLat(lat);
    out.lon = decodeLon(lon);
    if (/^\d{3}$/.test(speed)) out.speedKmh = Number(speed);
    if (/^\d{3}$/.test(dir)) out.headingDeg = Number(dir);
    if (/^\d$/.test(gps)) out.gpsStatus = Number(gps);
    if (/^[0-9A-Fa-f]{2}$/.test(since)) out.secondsSinceFix = parseInt(since, 16);
    out.digitalInputs = decodeDigitalInputs(dimask);
    if (/^\d{2}$/.test(hdop)) out.hdop = Number(hdop);
  }

  // parts[3] = "0415" + "1387" packed voltages
  const volts = parts[3];
  if (volts && /^\d{8}$/.test(volts)) {
    out.backupBatteryV = Number(volts.slice(0, 4)) / 100;
    out.mainSupplyV = Number(volts.slice(4, 8)) / 100;
  }
  if (parts[4] && /^\d+$/.test(parts[4])) out.maxSpeedViolation = Number(parts[4]);
  if (parts[5] && /^\d+$/.test(parts[5])) out.maxRpmViolation = Number(parts[5]);
  // parts[6] reserved
  if (parts[7] && /^\d+$/.test(parts[7])) out.hourmeterMin = Number(parts[7]);
  if (parts[8] && /^\d+$/.test(parts[8])) out.odometerM = Number(parts[8]);
  if (parts[9] && /^\d+$/.test(parts[9])) out.rpm = Number(parts[9]);
  if (parts[10] && /^\d+$/.test(parts[10])) out.engineTempC = Number(parts[10]);
  if (parts[11] && /^\d+$/.test(parts[11])) out.oilPressureKpa = Number(parts[11]);
  if (parts[12] && /^\d+$/.test(parts[12])) out.fuelPct = Number(parts[12]);
  if (parts[13] && /^\d$/.test(parts[13])) out.rainSpeedFlag = Number(parts[13]);
  if (parts[14] && /^\d$/.test(parts[14])) out.online = parts[14] === "1";
  if (parts[15]) out.network = parts[15];
  if (parts[16]) out.driverId = parts[16];
  return out;
}

export interface Ruv02Report {
  opcode: "RUV02";
  event?: number;
  protocolId?: string;
  ts?: string;
  rpmRangeSec?: [number, number, number, number, number];
  inertialSec?: number;
  engineBrakingSec?: number;
  coastingSec?: number;
  travelTimeMin?: number;
  distanceM?: number;
  fuelConsumedDecilitres?: number;
  _raw: string;
}

/**
 * RUV02 end-of-trip report (spec §9.5).
 * Sample: RUV02108,NT001,090322200225,11111,22222,33333,44444,55555,111,222,333,360,88888,302
 */
export function decodeRUV02(body: string): Ruv02Report {
  const out: Ruv02Report = { opcode: "RUV02", _raw: body };
  const parts = body.split(",");
  Object.assign(out, decodeRuvHeader(parts));
  const num = (i: number): number | undefined =>
    parts[i] && /^\d+$/.test(parts[i]) ? Number(parts[i]) : undefined;
  const r1 = num(3), r2 = num(4), r3 = num(5), r4 = num(6), r5 = num(7);
  if (r1 !== undefined && r2 !== undefined && r3 !== undefined && r4 !== undefined && r5 !== undefined) {
    out.rpmRangeSec = [r1, r2, r3, r4, r5];
  }
  out.inertialSec = num(8);
  out.engineBrakingSec = num(9);
  out.coastingSec = num(10);
  out.travelTimeMin = num(11);
  out.distanceM = num(12);
  out.fuelConsumedDecilitres = num(13);
  return out;
}

export interface Ruv03Report {
  opcode: "RUV03";
  event?: number;
  protocolId?: string;
  ts?: string;
  acceleratorPct?: number;
  hourmeterMin?: number;
  odometerM?: number;
  rpm?: number;
  engineTempC?: number;
  enginePressureKpa?: number;
  fuelPct?: number;
  cumulativeFuelDecilitres?: number;
  speedKmh?: number;
  engineTorquePct?: number;
  engineBrakePct?: number;
  cruiseControl?: boolean;
  clutch?: boolean;
  parkingBrake?: boolean;
  serviceBrake?: boolean;
  _raw: string;
}

/**
 * RUV03 CAN telemetry (spec §9.6).
 * Sample: RUV03150,NT001,090322201243,111,2222222,333333333,444444444,555,6666,777,888880,0,0,22,0,0,0,0,0,0,0,0,0
 */
export function decodeRUV03(body: string): Ruv03Report {
  const out: Ruv03Report = { opcode: "RUV03", _raw: body };
  const parts = body.split(",");
  Object.assign(out, decodeRuvHeader(parts));
  const num = (i: number): number | undefined =>
    parts[i] && /^\d+$/.test(parts[i]) ? Number(parts[i]) : undefined;

  out.acceleratorPct = num(3);
  out.hourmeterMin = num(4);
  out.odometerM = num(5);
  out.rpm = num(6);
  out.engineTempC = num(7);
  out.enginePressureKpa = num(8);
  out.fuelPct = num(9);
  out.cumulativeFuelDecilitres = num(10);
  // parts[11] reserved
  out.speedKmh = num(12);
  out.engineTorquePct = num(13);
  // parts[14] reserved
  out.engineBrakePct = num(15);
  // parts[16..18] reserved
  const cc = num(19); if (cc !== undefined) out.cruiseControl = cc === 1;
  const cl = num(20); if (cl !== undefined) out.clutch = cl === 64;
  const pb = num(21); if (pb !== undefined) out.parkingBrake = pb === 4;
  const sb = num(22); if (sb !== undefined) out.serviceBrake = sb === 8;
  return out;
}

export type Report =
  | RgpReport
  | Ruv00Report
  | Ruv01Report
  | Ruv02Report
  | Ruv03Report
  | { opcode: string; _raw: string }; // unknown opcode passthrough

/** Decode the body of a parsed envelope into a typed report. */
export function decodeReport(env: FrameEnvelope): Report {
  switch (env.opcode) {
    case "RGP": return decodeRGP(env.body);
    case "RUV00": return decodeRUV00(env.body);
    case "RUV01": return decodeRUV01(env.body);
    case "RUV02": return decodeRUV02(env.body);
    case "RUV03": return decodeRUV03(env.body);
    default:      return { opcode: env.opcode, _raw: env.body };
  }
}
