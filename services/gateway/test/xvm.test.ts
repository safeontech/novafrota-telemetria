import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  buildAckBuffer,
  extractOpcode,
  isDeviceOriginated,
  parseEnvelope,
  splitFrames,
  verifyChecksum,
  xorChecksum,
} from "../src/lib/xvm.ts";

// Worked examples come from the protocol spec attachment:
//   §6 :  >ACK;ID=1017;#0093;*52<
//   §8.1: >RGP110715030802...;ID=0001;#167A;*5F<  → ACK *2F
//         >RUV0237,000,...;ID=0001;#167B;*33<     → ACK *2C
//         >RUV0322,666,...;ID=0001;#167C;*36<     → ACK *2D

describe("xorChecksum", () => {
  it("matches the spec §6 reference ACK", () => {
    assert.equal(xorChecksum(">ACK;ID=1017;#0093;*52<"), "52");
  });

  it("matches every ACK from the spec §8.1 bootstrap log", () => {
    assert.equal(xorChecksum(">ACK;ID=0001;#167A;*2F<"), "2F");
    assert.equal(xorChecksum(">ACK;ID=0001;#167B;*2C<"), "2C");
    assert.equal(xorChecksum(">ACK;ID=0001;#167C;*2D<"), "2D");
  });

  it("matches when given the prefix only (TX side, no `*XX<`)", () => {
    // The TX path gives us `>ACK;ID=PNMB;#0001;` and we need the LRC to
    // append. The function must produce the same value as if we had passed
    // the full frame.
    const prefix = ">ACK;ID=0001;#167A;";
    assert.equal(xorChecksum(prefix), "2F");
  });

  it("zero-pads single-digit results to 2 chars", () => {
    // Construct a payload whose XOR is 0x0F. `>` (0x3E) XOR `1` (0x31) = 0x0F.
    assert.equal(xorChecksum(">1"), "0F");
  });
});

describe("splitFrames", () => {
  it("returns a single frame from a single-frame datagram", () => {
    const frames = splitFrames(">RGP;ID=PNMB;#0001;*5F<\r\n");
    assert.deepEqual(frames, [">RGP;ID=PNMB;#0001;*5F<"]);
  });

  it("returns every inner frame of a multi-message packet (spec §7)", () => {
    const dgr = ">SSXP01<>SSXP11<>STD090025000010000600;ID=1234;#FAEC;*XX<";
    const frames = splitFrames(dgr);
    assert.deepEqual(frames, [
      ">SSXP01<",
      ">SSXP11<",
      ">STD090025000010000600;ID=1234;#FAEC;*XX<",
    ]);
  });

  it("accepts a Buffer", () => {
    const buf = Buffer.from(">ACK;ID=0001;#167A;*2F<", "ascii");
    assert.deepEqual(splitFrames(buf), [">ACK;ID=0001;#167A;*2F<"]);
  });

  it("returns an empty array for non-XVM bytes", () => {
    assert.deepEqual(splitFrames("not an xvm frame at all"), []);
  });
});

describe("parseEnvelope", () => {
  it("parses an RGP frame", () => {
    const env = parseEnvelope(
      ">RGP110715030802-3597296-062735570000000FF5F2500;ID=0001;#167A;*5F<",
    );
    assert.ok(env);
    assert.equal(env.id, "0001");
    assert.equal(env.msgnum, "167A");
    assert.equal(env.lrc, "5F");
    assert.equal(env.opcode, "RGP");
    assert.equal(
      env.body,
      "RGP110715030802-3597296-062735570000000FF5F2500",
    );
  });

  it("parses an RUV01 frame and recognizes the 5-char opcode", () => {
    const env = parseEnvelope(
      ">RUV01100,NT001,090322190103-1998285-043945200000003FFDB0000,04151387,0,0,0,1111111111,2222222222,3333,444,55555,100,1,1,4G:0,1644991399;ID=LN61;#0E16;*49<",
    );
    assert.ok(env);
    assert.equal(env.id, "LN61");
    assert.equal(env.msgnum, "0E16");
    assert.equal(env.opcode, "RUV01");
  });

  it("returns null for an inner frame that has no trailer", () => {
    assert.equal(parseEnvelope(">SSXP01<"), null);
  });

  it("returns null for malformed input", () => {
    assert.equal(parseEnvelope("garbage"), null);
    assert.equal(parseEnvelope(">no_trailer<"), null);
    assert.equal(parseEnvelope(">RGP;ID=TOO_LONG;#0001;*5F<"), null);
  });

  it("normalizes ID and msgnum to uppercase", () => {
    const env = parseEnvelope(">RGP;ID=PNMB;#abcd;*00<");
    assert.ok(env);
    assert.equal(env.id, "PNMB");
    assert.equal(env.msgnum, "ABCD");
  });
});

describe("extractOpcode", () => {
  it("returns the 3-char opcode for RGP", () => {
    assert.equal(extractOpcode("RGP110715030802"), "RGP");
  });
  it("returns the 5-char opcode for RUV01/02/03", () => {
    assert.equal(extractOpcode("RUV01100,NT001,..."), "RUV01");
    assert.equal(extractOpcode("RUV02108,NT001,..."), "RUV02");
    assert.equal(extractOpcode("RUV03150,NT001,..."), "RUV03");
    assert.equal(extractOpcode("RUV00154,NT003,..."), "RUV00");
  });
  it("returns ACK for an ACK body", () => {
    assert.equal(extractOpcode("ACK"), "ACK");
  });
  it("returns RUS00 for a manual-report response", () => {
    assert.equal(extractOpcode("RUS00,NT003,..."), "RUS00");
  });
});

describe("isDeviceOriginated", () => {
  it("classifies low message numbers as device-originated", () => {
    assert.equal(isDeviceOriginated("0001"), true);
    assert.equal(isDeviceOriginated("167A"), true);
    assert.equal(isDeviceOriginated("7FFF"), true);
  });
  it("classifies high message numbers as server responses", () => {
    assert.equal(isDeviceOriginated("8000"), false);
    assert.equal(isDeviceOriginated("FFFF"), false);
  });
});

describe("verifyChecksum", () => {
  it("accepts every ACK example from spec §8.1", () => {
    for (const raw of [
      ">ACK;ID=0001;#167A;*2F<",
      ">ACK;ID=0001;#167B;*2C<",
      ">ACK;ID=0001;#167C;*2D<",
      ">ACK;ID=1017;#0093;*52<",
    ]) {
      const env = parseEnvelope(raw);
      assert.ok(env, `parse failed for ${raw}`);
      assert.equal(
        verifyChecksum(raw, env),
        true,
        `verify failed for ${raw}`,
      );
    }
  });

  it("accepts a single-frame datagram with trailing CRLF", () => {
    const raw = ">ACK;ID=0001;#167A;*2F<";
    const datagram = `${raw}\r\n`;
    const env = parseEnvelope(raw);
    assert.ok(env);
    assert.equal(verifyChecksum(datagram, env), true);
  });

  it("accepts a multi-message packet whose checksum spans inner frames (spec §7)", () => {
    // Build a multi-message datagram with two leading inner frames and a
    // trailer-bearing final frame. The LRC must be computed over the WHOLE
    // packet (vendor C reference §5.1), so verifying only the trailer frame
    // would (incorrectly) reject this.
    const prefix = ">SSXP01<>SSXP11<>STD;ID=0001;#0001;";
    const lrc = xorChecksum(prefix);
    const datagram = `${prefix}*${lrc}<\r\n`;

    const frames = splitFrames(datagram);
    assert.equal(frames.length, 3, "three frames expected");
    const trailerFrame = frames[2]!;
    const trailerEnv = parseEnvelope(trailerFrame);
    assert.ok(trailerEnv, "trailer envelope must parse");

    // Whole-datagram verification: must pass.
    assert.equal(
      verifyChecksum(datagram, trailerEnv),
      true,
      "multi-message verification over whole datagram must pass",
    );

    // Trailer-frame-only verification: would reject (proves the bug we fixed).
    assert.equal(
      verifyChecksum(trailerFrame, trailerEnv),
      false,
      "trailer-frame-only verification must reject (sanity check)",
    );
  });

  it("rejects a frame with a wrong checksum", () => {
    const env = parseEnvelope(">ACK;ID=0001;#167A;*FF<");
    assert.ok(env);
    assert.equal(verifyChecksum(">ACK;ID=0001;#167A;*FF<", env), false);
  });

  it("tolerates the vendor C# non-zero-padded LRC quirk", () => {
    // Per spec §5.2 note: vendor C# `ToString("X")` emits `F` instead of `0F`
    // for single-digit results. Build a real frame whose true LRC starts with
    // `0` by searching the msgnum space — keeps the test deterministic without
    // hand-computing XOR.
    // Search both ID and msgnum so the test is not at the mercy of any
    // single prefix's top-nibble parity. Trying a handful of well-known IDs
    // is enough to guarantee we hit a leading-zero LRC fast.
    // Vary opcode + ID + msgnum so we are not at the mercy of any single
    // prefix's top-nibble parity (some opcode/ID combos can only produce
    // top-nibbles in a restricted set).
    const opcodes = ["AP", "RGP", "ACK", "QSN", "RUV01"];
    const ids = ["0000", "AAAA", "PNMB", "0001", "AB12"];
    let found: { opcode: string; id: string; msgnum: string; lrc: string } | null =
      null;
    outer: for (const opcode of opcodes) {
      for (const id of ids) {
        for (let n = 1; n <= 0xffff; n++) {
          const msgnum = n.toString(16).toUpperCase().padStart(4, "0");
          const prefix = `>${opcode};ID=${id};#${msgnum};`;
          const lrc = xorChecksum(prefix);
          if (lrc[0] === "0") {
            found = { opcode, id, msgnum, lrc };
            break outer;
          }
        }
      }
    }
    assert.ok(found, "could not find a frame with leading-zero LRC");

    const paddedRaw = `>${found.opcode};ID=${found.id};#${found.msgnum};*${found.lrc}<`;
    const strippedRaw = `>${found.opcode};ID=${found.id};#${found.msgnum};*${found.lrc[1]}<`;
    const padded = parseEnvelope(paddedRaw);
    const stripped = parseEnvelope(strippedRaw);
    assert.ok(padded);
    assert.ok(stripped);
    assert.equal(
      verifyChecksum(paddedRaw, padded),
      true,
      "zero-padded LRC must verify",
    );
    assert.equal(
      verifyChecksum(strippedRaw, stripped),
      true,
      "single-digit LRC must verify (vendor C# quirk)",
    );
  });
});

describe("buildAckBuffer", () => {
  it("produces the exact ACK bytes from spec §8.1 (with CRLF)", () => {
    const ack = buildAckBuffer("0001", "167A");
    assert.equal(ack.toString("ascii"), ">ACK;ID=0001;#167A;*2F<\r\n");
  });

  it("rebuilds an ACK whose checksum verifies via parseEnvelope+verifyChecksum", () => {
    const ack = buildAckBuffer("PNMB", "0001");
    // Strip CRLF before parsing — splitFrames would handle it but parseEnvelope
    // expects the bare frame.
    const frames = splitFrames(ack);
    assert.equal(frames.length, 1);
    const env = parseEnvelope(frames[0]!);
    assert.ok(env);
    assert.equal(env.opcode, "ACK");
    assert.equal(env.id, "PNMB");
    assert.equal(env.msgnum, "0001");
    assert.equal(verifyChecksum(frames[0]!, env), true);
  });
});
