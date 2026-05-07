import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  extractPackets,
  MAX_BUFFER_BYTES,
} from "../src/lib/tcp-framer.ts";
import { xorChecksum } from "../src/lib/xvm.ts";

// Build a real, checksum-valid trailer-bearing frame for an arbitrary opcode.
function trailerFrame(opcode: string, id = "0001", msgnum = "0001"): string {
  const prefix = `>${opcode};ID=${id};#${msgnum};`;
  return `${prefix}*${xorChecksum(prefix)}<\r\n`;
}

describe("extractPackets", () => {
  it("extracts a single complete packet and consumes its CRLF", () => {
    const pkt = trailerFrame("RGP");
    const { packets, remainder, overflow } = extractPackets(Buffer.from(pkt));
    assert.equal(packets.length, 1);
    assert.equal(packets[0]!.toString("ascii"), pkt);
    assert.equal(remainder.length, 0);
    assert.equal(overflow, false);
  });

  it("extracts multiple back-to-back packets in one chunk", () => {
    const a = trailerFrame("RGP", "PNMB", "0001");
    const b = trailerFrame("ACK", "PNMB", "0002");
    const c = trailerFrame("RGP", "0592", "0003");
    const buf = Buffer.from(a + b + c);
    const { packets, remainder } = extractPackets(buf);
    assert.equal(packets.length, 3);
    assert.equal(packets[0]!.toString("ascii"), a);
    assert.equal(packets[1]!.toString("ascii"), b);
    assert.equal(packets[2]!.toString("ascii"), c);
    assert.equal(remainder.length, 0);
  });

  it("keeps an incomplete trailing frame in the remainder", () => {
    const complete = trailerFrame("RGP");
    const partial = ">RUV01100,NT001,090322190103-19982"; // no `<` yet
    const buf = Buffer.from(complete + partial);
    const { packets, remainder } = extractPackets(buf);
    assert.equal(packets.length, 1);
    assert.equal(packets[0]!.toString("ascii"), complete);
    assert.equal(remainder.toString("ascii"), partial);
  });

  it("survives a frame split across two chunks (simulated reassembly)", () => {
    const full = trailerFrame("RGP");
    const cut = Math.floor(full.length / 2);
    const chunk1 = Buffer.from(full.slice(0, cut));
    const chunk2 = Buffer.from(full.slice(cut));

    // Round 1: only chunk1 — no complete frame yet.
    let acc = chunk1;
    let r = extractPackets(acc);
    assert.equal(r.packets.length, 0);
    assert.equal(r.remainder.length, chunk1.length);

    // Round 2: append chunk2 — the trailer now resolves.
    acc = Buffer.concat([r.remainder, chunk2]);
    r = extractPackets(acc);
    assert.equal(r.packets.length, 1);
    assert.equal(r.packets[0]!.toString("ascii"), full);
    assert.equal(r.remainder.length, 0);
  });

  it("handles a multi-message packet with inner non-trailer frames (spec §7)", () => {
    // Inner frames `>SSXP01<` and `>SSXP11<` have no `;ID=…` trailer; the
    // packet is closed by the trailer-bearing frame. The slice must include
    // ALL inner frames so the downstream checksum verification (which spans
    // the whole packet) works.
    const prefix = ">SSXP01<>SSXP11<>STD;ID=0001;#0001;";
    const lrc = xorChecksum(prefix);
    const fullPacket = `${prefix}*${lrc}<\r\n`;

    const { packets, remainder } = extractPackets(Buffer.from(fullPacket));
    assert.equal(packets.length, 1);
    assert.equal(packets[0]!.toString("ascii"), fullPacket);
    assert.equal(remainder.length, 0);
  });

  it("absorbs garbage between packets along with the next packet", () => {
    const a = trailerFrame("RGP", "PNMB", "0001");
    const garbage = "SOME_NON_XVM_NOISE";
    const b = trailerFrame("ACK", "PNMB", "0002");
    const buf = Buffer.from(a + garbage + b);
    const { packets, remainder } = extractPackets(buf);
    // Two packets emerge; garbage gets consumed inside packet B's slice
    // (everything from the end of A up through B's trailer + CRLF).
    assert.equal(packets.length, 2);
    assert.equal(packets[0]!.toString("ascii"), a);
    assert.equal(packets[1]!.toString("ascii"), garbage + b);
    assert.equal(remainder.length, 0);
  });

  it("returns empty result for an empty buffer", () => {
    const { packets, remainder, overflow } = extractPackets(Buffer.alloc(0));
    assert.equal(packets.length, 0);
    assert.equal(remainder.length, 0);
    assert.equal(overflow, false);
  });

  it("flags overflow when the accumulator grows past the cap with no trailer", () => {
    // Make the buffer longer than MAX_BUFFER_BYTES with no `>...<` trailer
    // anywhere. extractPackets must report overflow=true.
    const garbage = Buffer.alloc(MAX_BUFFER_BYTES + 1, 0x41 /* 'A' */);
    const { packets, remainder, overflow } = extractPackets(garbage);
    assert.equal(packets.length, 0);
    assert.equal(remainder.length, MAX_BUFFER_BYTES + 1);
    assert.equal(overflow, true);
  });

  it("does NOT flag overflow when a trailer IS present and the slice fits", () => {
    const pkt = trailerFrame("RGP");
    const buf = Buffer.from(pkt);
    const { overflow } = extractPackets(buf);
    assert.equal(overflow, false);
  });

  it("does not consume CRLF that belongs to a trailing partial frame", () => {
    // A complete packet followed by `\r\n` that's part of the NEXT (still
    // arriving) packet's prefix garbage — not a thing on real wires, but
    // exercises the bounds check.
    const a = trailerFrame("RGP");
    const buf = Buffer.from(a + "\r\n>partial");
    const { packets, remainder } = extractPackets(buf);
    assert.equal(packets.length, 1);
    assert.equal(packets[0]!.toString("ascii"), a);
    // The leftover `\r\n>partial` stays in the remainder verbatim.
    assert.equal(remainder.toString("ascii"), "\r\n>partial");
  });

  it("REJECTS an oversized packet that opens with `>`, fills past the cap, then closes with a real trailer (DoS-bypass guard)", () => {
    // Without the per-packet size guard, a peer could send `>` then 1 MiB
    // of garbage, then a valid trailer — the regex would happily match a
    // trailer-bearing closing frame and we'd emit a megabyte-sized "packet"
    // through to the LRC check. The guard must reject it BEFORE emission.
    const trailer = trailerFrame("RGP", "PNMB", "0001");
    // 80 KiB of garbage between the spurious `>` and the legit trailer.
    const garbage = "X".repeat(80 * 1024);
    const buf = Buffer.from(">" + garbage + trailer);

    const { packets, overflow, remainder } = extractPackets(buf);
    assert.equal(packets.length, 0, "must NOT emit oversized packet");
    assert.equal(overflow, true, "must signal overflow");
    // Remainder is returned untruncated for caller-side logging/sampling.
    assert.ok(
      remainder.length > MAX_BUFFER_BYTES,
      "remainder retained for caller diagnostic logging",
    );
  });

  it("emits earlier well-formed packets before bailing on a later oversized one", () => {
    // A clean packet, then a runaway packet — the framer should still hand
    // back the clean one for processing, then signal overflow on the rest.
    const clean = trailerFrame("RGP", "PNMB", "0001");
    const trailer = trailerFrame("RGP", "PNMB", "0002");
    const garbage = "X".repeat(80 * 1024);
    const buf = Buffer.from(clean + ">" + garbage + trailer);

    const { packets, overflow } = extractPackets(buf);
    assert.equal(packets.length, 1, "the clean packet still flows through");
    assert.equal(packets[0]!.toString("ascii"), clean);
    assert.equal(overflow, true, "and overflow is still signaled for the runaway");
  });
});
