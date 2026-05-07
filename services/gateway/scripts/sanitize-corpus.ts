#!/usr/bin/env -S node --experimental-strip-types
// Sanitize a raw XVM capture into a committable golden corpus.
//
// Reads:  fixtures/xvm-live.txt          (gitignored — raw NDJSON written
//                                         by the live gateway on the VPS)
// Writes: services/gateway/test/fixtures/golden-corpus.txt
//                                        (committed — anonymized, drives
//                                         the replay test in Milestone 2)
//
// What gets sanitized (everything else passes through verbatim):
//
//   1. SIM ICCID in RUV00 frames (spec §9.3 last comma field).
//      `89551080157011558621` → `8955XXXXXXXXXXXXXXXX`
//      Keeps the 4-digit issuer prefix (89 = telecom, 55 = country) so the
//      operator/network is still inspectable; the unique subscriber digits
//      are masked.
//
//   2. Latitude / longitude in RGP and RUV01 frames (spec §9.2, §9.4,
//      §13.3). The sign and integer degrees are preserved (so the rough
//      country/region is still visible), the first fractional digit is
//      preserved (~10 km grid), and the remaining four fractional digits
//      are zeroed. e.g. `-3597296` → `-3590000` (still in Argentina, but
//      anonymized to a 10 km cell, not a customer parking lot).
//
// After every per-frame mutation the trailer's XOR-LRC is recomputed over
// the entire (possibly multi-frame) datagram using the same primitive the
// live gateway and replay test use — so the golden corpus continues to
// pass `verifyChecksum` end-to-end.
//
// Usage:
//   pnpm --filter @workspace/gateway run sanitize-corpus
//   pnpm --filter @workspace/gateway run sanitize-corpus -- --input <path> --output <path> [--dry-run]

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  parseEnvelope,
  splitFrames,
  verifyChecksum,
  xorChecksum,
} from "../src/lib/xvm.ts";

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");

interface CliArgs {
  input: string;
  output: string;
  dryRun: boolean;
}

function parseArgs(argv: readonly string[]): CliArgs {
  let input = path.join(repoRoot, "fixtures/xvm-live.txt");
  let output = path.join(
    repoRoot,
    "services/gateway/test/fixtures/golden-corpus.txt",
  );
  let dryRun = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--input" || a === "-i") {
      input = path.resolve(argv[++i] ?? "");
    } else if (a === "--output" || a === "-o") {
      output = path.resolve(argv[++i] ?? "");
    } else if (a === "--dry-run" || a === "-n") {
      dryRun = true;
    } else if (a === "--help" || a === "-h") {
      printHelpAndExit(0);
    } else {
      console.error(`unknown argument: ${a}`);
      printHelpAndExit(2);
    }
  }
  return { input, output, dryRun };
}

function printHelpAndExit(code: number): never {
  console.error(
    [
      "usage: sanitize-corpus [--input <path>] [--output <path>] [--dry-run]",
      "",
      "  --input,   -i  raw NDJSON capture (default fixtures/xvm-live.txt)",
      "  --output,  -o  sanitized text fixture (default services/gateway/test/fixtures/golden-corpus.txt)",
      "  --dry-run, -n  print stats, do not write the output file",
    ].join("\n"),
  );
  process.exit(code);
}

// ---------------------------------------------------------------------------
// Field-level masking
// ---------------------------------------------------------------------------

/**
 * Mask a SIM ICCID by keeping the first 4 digits (issuer prefix) and
 * replacing the remainder with `X`. Width is preserved.
 *
 * Returns the input unchanged if it does not look like an ICCID
 * (18–22 digits) — we never want to corrupt a non-ICCID field by accident.
 */
function maskIccid(s: string): string {
  if (!/^\d{18,22}$/.test(s)) return s;
  return s.slice(0, 4) + "X".repeat(s.length - 4);
}

/**
 * Fuzz a packed lat string: `<sign><7 digits>` → keep sign, keep the 2
 * integer digits and the first fractional digit, zero the remaining 4.
 * Width is preserved (8 chars).
 */
function fuzzLat(s: string): string {
  if (!/^[-+]\d{7}$/.test(s)) return s;
  return `${s[0]}${s.slice(1, 4)}0000`;
}

/**
 * Fuzz a packed lon string: `<sign><8 digits>` → keep sign, keep the 3
 * integer digits and the first fractional digit, zero the remaining 4.
 * Width is preserved (9 chars).
 */
function fuzzLon(s: string): string {
  if (!/^[-+]\d{8}$/.test(s)) return s;
  return `${s[0]}${s.slice(1, 5)}0000`;
}

// ---------------------------------------------------------------------------
// Per-opcode body sanitization. Each function takes the body (everything
// between `>` and `;ID=`) and returns the sanitized body of identical width.
// ---------------------------------------------------------------------------

/** RGP body: `RGP` + date(6) + time(6) + lat(8) + lon(9) + ... */
function sanitizeRgpBody(body: string): string {
  if (!body.startsWith("RGP") || body.length < 32) return body;
  const head = body.slice(0, 15);                // "RGP" + date(6) + time(6)
  const lat = body.slice(15, 23);                // sign+7
  const lon = body.slice(23, 32);                // sign+8
  const tail = body.slice(32);
  return `${head}${fuzzLat(lat)}${fuzzLon(lon)}${tail}`;
}

/** RUV00 body: comma-delimited; ICCID is the last (or near-last) field. */
function sanitizeRuv00Body(body: string): string {
  const parts = body.split(",");
  let mutated = false;
  for (let i = 0; i < parts.length; i++) {
    const masked = maskIccid(parts[i]!);
    if (masked !== parts[i]) {
      parts[i] = masked;
      mutated = true;
    }
  }
  return mutated ? parts.join(",") : body;
}

/**
 * Mask a driver identifier (RUV01 parts[16] per spec §9.4) by replacing
 * every char with `X` while preserving width. `-` (no driver assigned) and
 * empty values pass through unchanged so the parser still sees a sentinel.
 *
 * We do not preserve a prefix here: driver IDs are short enough that even
 * the first few chars can identify an operator at NavorTech's fleet size.
 */
function maskDriverId(s: string): string {
  if (s === "" || s === "-") return s;
  return "X".repeat(s.length);
}

/**
 * RUV01 body: `RUVxxx,protocolId,<gpsBlock>,<volts>,...,driverId`. The
 * gpsBlock at parts[2] is a 44-char packed string with the same lat/lon
 * layout as RGP (date(6) time(6) lat(8) lon(9) ...). The driver
 * identifier at parts[16] (spec §9.4) is also masked — it can leak
 * operator identity even at NavorTech's fleet size.
 */
function sanitizeRuv01Body(body: string): string {
  const parts = body.split(",");
  if (parts.length < 3) return body;
  const blk = parts[2]!;
  if (blk.length >= 29) {
    const head = blk.slice(0, 12);                 // date(6) + time(6)
    const lat = blk.slice(12, 20);                 // sign+7
    const lon = blk.slice(20, 29);                 // sign+8
    const tail = blk.slice(29);
    parts[2] = `${head}${fuzzLat(lat)}${fuzzLon(lon)}${tail}`;
  }
  if (parts.length > 16 && parts[16] !== undefined) {
    parts[16] = maskDriverId(parts[16]);
  }
  return parts.join(",");
}

function sanitizeBody(opcode: string, body: string): string {
  switch (opcode) {
    case "RGP":   return sanitizeRgpBody(body);
    case "RUV00": return sanitizeRuv00Body(body);
    case "RUV01": return sanitizeRuv01Body(body);
    // RUV02 (trip totals) and RUV03 (CAN telemetry) hold no PII / locations.
    default:      return body;
  }
}

// ---------------------------------------------------------------------------
// Datagram-level rebuild
// ---------------------------------------------------------------------------

/**
 * Sanitize a single datagram (which may contain one or many frames per
 * spec §7) and recompute the trailer's XOR-LRC over the rebuilt bytes.
 *
 * Returns the original `ascii` unchanged if there is no trailer envelope
 * to checksum (malformed datagrams pass through verbatim — the replay
 * test still asserts they are rejected by the gateway).
 */
function sanitizeDatagram(ascii: string): {
  ascii: string;
  mutated: boolean;
  ackWouldChange: boolean;
} {
  // Preserve any trailing CR LF (or whitespace) so the rebuilt ASCII is
  // byte-identical for non-mutated datagrams.
  const trailingMatch = ascii.match(/(\r?\n|\s+)$/);
  const trailing = trailingMatch ? trailingMatch[0] : "";
  const core = trailing ? ascii.slice(0, -trailing.length) : ascii;

  const frames = splitFrames(core);
  if (frames.length === 0) return { ascii, mutated: false, ackWouldChange: false };

  // Mutate each frame's body if it has a sanitizable opcode. Only the
  // trailer frame has an envelope; inner frames of a multi-message packet
  // (server commands, e.g. `>SSXP01<>SSXP11<...`) carry no PII so they
  // pass through verbatim.
  let mutated = false;
  const rebuiltFrames: string[] = [];
  let trailerIdx = -1;
  let trailerEnv: ReturnType<typeof parseEnvelope> = null;

  for (let i = 0; i < frames.length; i++) {
    const raw = frames[i]!;
    const env = parseEnvelope(raw);
    if (!env) {
      rebuiltFrames.push(raw);
      continue;
    }
    trailerIdx = i;
    trailerEnv = env;
    const newBody = sanitizeBody(env.opcode, env.body);
    if (newBody === env.body) {
      rebuiltFrames.push(raw);
    } else {
      mutated = true;
      // Rebuild this frame WITHOUT the LRC — we re-checksum the whole
      // datagram below.
      rebuiltFrames.push(`>${newBody};ID=${env.id};#${env.msgnum};*00<`);
    }
  }

  if (trailerIdx < 0 || !trailerEnv) {
    return { ascii, mutated: false, ackWouldChange: false };
  }

  if (!mutated) {
    return { ascii, mutated: false, ackWouldChange: false };
  }

  // Recompute the trailer LRC over the entire rebuilt datagram (matches
  // the device's behavior per spec §5.1 + §7).
  const placeholderDatagram = rebuiltFrames.join("");
  const trailerRaw = rebuiltFrames[trailerIdx]!;
  // Strip the placeholder `*00<` to get everything up to and including the
  // final `;`, then xorChecksum() that prefix.
  const trailerPrefix = trailerRaw.slice(0, trailerRaw.length - "*00<".length);
  // The whole-datagram checksum is computed over the entire rebuilt packet
  // up to the byte before the `*` in the trailer.
  const datagramPrefix =
    placeholderDatagram.slice(0, placeholderDatagram.length - "*00<".length);
  const newLrc = xorChecksum(datagramPrefix);
  const newTrailer = `${trailerPrefix}*${newLrc}<`;
  rebuiltFrames[trailerIdx] = newTrailer;
  const rebuilt = rebuiltFrames.join("");

  // Sanity: the rebuilt trailer envelope must verify against the rebuilt
  // datagram. If not, refuse to emit garbage — fail loud so a parser bug
  // here can't poison the golden corpus.
  const verifyEnv = parseEnvelope(newTrailer);
  if (!verifyEnv || !verifyChecksum(rebuilt, verifyEnv)) {
    throw new Error(
      `sanitizer self-check failed for datagram: ${ascii.slice(0, 80)}…`,
    );
  }

  // The ACK that the gateway will produce for this datagram is keyed by
  // (id, msgnum) only — neither of which we mutate — so the `ack` lines
  // in the input remain valid for the sanitized datagram. We surface this
  // explicitly so the caller can drop stale `ack` lines if it ever wants
  // to (we don't — see below).
  return { ascii: rebuilt + trailing, mutated: true, ackWouldChange: false };
}

// ---------------------------------------------------------------------------
// NDJSON line transformer
// ---------------------------------------------------------------------------

interface CaptureLine {
  ts?: string;
  event?: string;
  peer?: string;
  bytes?: number;
  ascii?: string;
  [k: string]: unknown;
}

interface Stats {
  total: number;
  rxLines: number;
  ackLines: number;
  invalidLines: number;
  startupMarkers: number;
  rxMutated: number;
  rxUnchanged: number;
  malformedJson: number;
}

function sanitizeLine(raw: string, lineNo: number, stats: Stats): string | null {
  const trimmed = raw.trimEnd();
  if (trimmed.length === 0) return null;

  let obj: CaptureLine;
  try {
    obj = JSON.parse(trimmed);
  } catch (err) {
    stats.malformedJson++;
    // Fail loud. Passing the raw line through could leak unsanitized data
    // into the committed golden corpus — exactly the failure mode this
    // tool exists to prevent. The capture file is NDJSON written by our
    // own gateway; malformed lines indicate corruption and require human
    // attention before sanitization can be trusted.
    throw new Error(
      `sanitize-corpus: malformed JSON at line ${lineNo}: ${(err as Error).message}\n` +
        `  source: ${trimmed.slice(0, 120)}${trimmed.length > 120 ? "…" : ""}`,
    );
  }

  stats.total++;
  if (obj.event === "gateway_started") stats.startupMarkers++;
  if (obj.event === "ack") stats.ackLines++;
  if (obj.event === "frame_invalid") stats.invalidLines++;

  if (obj.event !== "rx" || typeof obj.ascii !== "string") {
    return JSON.stringify(obj);
  }

  stats.rxLines++;
  const out = sanitizeDatagram(obj.ascii);
  if (out.mutated) {
    stats.rxMutated++;
    obj.ascii = out.ascii;
    if (typeof obj.bytes === "number") {
      obj.bytes = Buffer.byteLength(out.ascii, "ascii");
    }
  } else {
    stats.rxUnchanged++;
  }
  return JSON.stringify(obj);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const args = parseArgs(process.argv.slice(2));

  let input: string;
  try {
    input = readFileSync(args.input, "utf8");
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") {
      console.error(
        `sanitize-corpus: input not found at ${args.input}\n` +
          `  Did you scp the capture file from the VPS?\n` +
          `    scp navortech@38.247.130.26:/var/lib/navortech-gateway/xvm-live.txt ${args.input}`,
      );
      process.exit(1);
    }
    throw err;
  }

  const stats: Stats = {
    total: 0,
    rxLines: 0,
    ackLines: 0,
    invalidLines: 0,
    startupMarkers: 0,
    rxMutated: 0,
    rxUnchanged: 0,
    malformedJson: 0,
  };

  const outLines: string[] = [];
  const rawLines = input.split("\n");
  for (let i = 0; i < rawLines.length; i++) {
    const sanitized = sanitizeLine(rawLines[i]!, i + 1, stats);
    if (sanitized !== null) outLines.push(sanitized);
  }
  const outputBody = outLines.join("\n") + (outLines.length > 0 ? "\n" : "");

  if (args.dryRun) {
    console.log("[dry-run] would write:", args.output);
  } else {
    mkdirSync(path.dirname(args.output), { recursive: true });
    writeFileSync(args.output, outputBody, "utf8");
  }

  console.log(
    JSON.stringify(
      {
        input: args.input,
        output: args.dryRun ? "(dry-run, not written)" : args.output,
        stats,
      },
      null,
      2,
    ),
  );
}

main();
