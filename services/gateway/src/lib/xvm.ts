// VIRLOC XVM protocol — pure logic.
//
// Authoritative reference: attached_assets/vl06-protocol-spec_1777447136923.md
//   §2  Envelope                — `>BODY;ID=XXXX;#YYYY;*ZZ<[CR][LF]`
//   §4  Message number          — 16-bit hex, < 0x8000 = device-originated
//   §5  Checksum                — 8-bit XOR over `>` through last `;` inclusive
//   §6  ACK                     — `>ACK;ID=…;#…;*ZZ<[CR][LF]`, msgnum mirrored
//   §7  Multi-message packets   — only the LAST inner frame carries the trailer
//
// Everything in this file is pure: no I/O, no logging, no time. The handler
// composes these primitives with the UDP socket and the capture sink.

const FRAME_RE = /(>[^<]*<)/g;

/**
 * Pull every `>...<` frame out of a single UDP datagram.
 *
 * A datagram may contain one frame (the common case) or many (multi-message
 * packets, spec §7). Whitespace, CR, and LF between frames is ignored.
 * Returns the frames in wire order. Bytes outside `>...<` pairs are dropped
 * silently — they are not part of XVM.
 */
export function splitFrames(datagram: Buffer | string): string[] {
  const text =
    typeof datagram === "string" ? datagram : datagram.toString("ascii");
  const matches = text.match(FRAME_RE);
  return matches ?? [];
}

/**
 * 8-bit XOR checksum, 2-char zero-padded uppercase hex.
 *
 * Coverage: every byte of `frame` from index 0 onward, stopping at the byte
 * BEFORE a `*` that is preceded by `;`. Mirrors the vendor C reference in
 * spec §5.1 exactly. Crucially, the closing `;` IS included (XORed in the
 * iteration before the break) and the `*` and trailing `XX<` are NOT.
 *
 * Works for both directions:
 *   - Verifying a received frame: pass the full `>BODY;ID=...;*ZZ<` and
 *     compare the result to the parsed `*ZZ`.
 *   - Building an outbound frame: pass the prefix ending in `;` (e.g.
 *     `>ACK;ID=PNMB;#0001;`) and the result is the value to append after `*`.
 */
export function xorChecksum(frame: string): string {
  let lrc = 0;
  for (let i = 0; i < frame.length; i++) {
    const ch = frame.charCodeAt(i) & 0xff;
    if (ch === 0x2a /* '*' */ && i > 0 && frame.charCodeAt(i - 1) === 0x3b /* ';' */) {
      break;
    }
    lrc ^= ch;
  }
  return lrc.toString(16).toUpperCase().padStart(2, "0");
}

export interface XvmEnvelope {
  /** raw frame including outer `>` and `<` */
  raw: string;
  /** body between `>` and the trailer (everything before `;ID=`) */
  body: string;
  /** opcode at the head of the body — `RGP`, `RUV01`, `ACK`, `RUS00`, etc. */
  opcode: string;
  /** 4-char alphanumeric device ID, normalized to uppercase */
  id: string;
  /** 4-char hex message number, normalized to uppercase */
  msgnum: string;
  /** raw checksum field as it appeared on the wire (1 or 2 hex chars) */
  lrc: string;
}

// Anchored on both ends. Body may contain `;` (lots, in RUV01/02/03) so the
// `.+` is greedy and backtracks until the trailer matches.
//   - ID is 4 chars [A-Z0-9] per spec §3.
//   - msgnum is 4 hex digits per spec §4.
//   - LRC is 1–2 hex digits — vendor C# `ToString("X")` does NOT zero-pad.
const ENVELOPE_RE =
  /^>(.+);ID=([A-Z0-9]{4});#([0-9A-Fa-f]{4});\*([0-9A-Fa-f]{1,2})<$/;

/**
 * Parse a single frame's envelope.
 *
 * Returns `null` for frames that have no `;ID=…;#…;*…` trailer — that is the
 * normal shape of inner frames inside a multi-message packet (spec §7), and
 * also the shape of a malformed datagram.
 */
export function parseEnvelope(frame: string): XvmEnvelope | null {
  const m = ENVELOPE_RE.exec(frame);
  if (!m) return null;
  const body = m[1]!;
  const id = m[2]!.toUpperCase();
  const msgnum = m[3]!.toUpperCase();
  const lrc = m[4]!.toUpperCase();
  return { raw: frame, body, opcode: extractOpcode(body), id, msgnum, lrc };
}

/**
 * Best-effort opcode classification for telemetry / logging.
 *
 * Spec §9.1 reserves 5 chars for the `RUVxx` / `RUSxx` family (`xx` is the
 * format index 00–03). For everything else the opcode is the leading run of
 * uppercase letters — `RGP`, `ACK`, `QSN`, `RVR`, etc.
 *
 * This is *not* used to decide whether to ACK — that decision is taken solely
 * from `msgnum` per spec §4.
 */
export function extractOpcode(body: string): string {
  const ruvRus = body.match(/^(RUV\d{2}|RUS\d{2})/);
  if (ruvRus) return ruvRus[1]!;
  const letters = body.match(/^[A-Z]+/);
  return letters ? letters[0]! : "";
}

/**
 * `true` iff the given message number is in the device-originated range
 * (`0x0001`–`0x7FFF` per spec §4). Such frames MUST be ACK'd; otherwise the
 * tracker retries forever (spec §6.1).
 */
export function isDeviceOriginated(msgnum: string): boolean {
  const n = parseInt(msgnum, 16);
  if (!Number.isFinite(n)) return false;
  return n >= 0x0001 && n < 0x8000;
}

/**
 * Verify a parsed trailer's LRC against the XOR of the entire datagram.
 *
 * Works uniformly for both single-frame and multi-message packets (spec §7):
 *
 *   - Single-frame:  `>BODY;ID=…;#…;*ZZ<\r\n`
 *     The whole datagram IS the frame; XOR coverage is identical.
 *
 *   - Multi-message: `>cmd1<>cmd2<>cmdN;ID=…;#…;*ZZ<\r\n`
 *     The device computed the checksum over its entire output buffer (vendor
 *     C reference in spec §5.1). That includes the inner `>cmd<` frames.
 *     Verifying against only the trailer frame would give the WRONG XOR and
 *     reject the packet, leaving the tracker to retry forever.
 *
 * Coverage starts at the first `>` byte (so leading whitespace, if any, is
 * ignored) and runs through the `;` just before the `*` (per `xorChecksum`,
 * matching the vendor C reference exactly). Trailing `*ZZ<\r\n` is excluded.
 *
 * Tolerates the vendor C# `ToString("X")` quirk where the LRC is emitted as
 * one hex char instead of zero-padded to two (spec §5.2 note).
 */
export function verifyChecksum(
  packet: Buffer | string,
  trailer: XvmEnvelope,
): boolean {
  const text = typeof packet === "string" ? packet : packet.toString("ascii");
  const start = text.indexOf(">");
  const window = start < 0 ? text : text.substring(start);
  const expected = xorChecksum(window);
  const got = trailer.lrc.toUpperCase();
  if (got === expected) return true;
  // Single-digit LRC against a two-digit expected starting with '0'.
  if (got.length === 1 && expected.length === 2 && expected[0] === "0") {
    return got === expected[1];
  }
  return false;
}

/**
 * Build the ACK datagram for a received device-originated frame.
 *
 * Format per spec §6 / §8.1:  `>ACK;ID=<id>;#<msgnum>;*<lrc><CR><LF>`.
 * The msgnum is mirrored from the incoming frame so the device can correlate
 * the ACK with its outstanding retry slot.
 */
export function buildAckBuffer(id: string, msgnum: string): Buffer {
  const prefix = `>ACK;ID=${id};#${msgnum};`;
  const lrc = xorChecksum(prefix);
  return Buffer.from(`${prefix}*${lrc}<\r\n`, "ascii");
}
