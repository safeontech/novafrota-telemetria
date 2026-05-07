import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { makePacketHandler, type CaptureSink } from "../src/handler.ts";
import { buildAckBuffer, xorChecksum } from "../src/lib/xvm.ts";

interface Captured {
  lines: string[];
  records: Record<string, unknown>[];
}

function makeSink(): { sink: CaptureSink; captured: Captured } {
  const captured: Captured = { lines: [], records: [] };
  const sink: CaptureSink = {
    write(line: string): void {
      captured.lines.push(line);
      captured.records.push(JSON.parse(line.trimEnd()));
    },
  };
  return { sink, captured };
}

interface ReplyCall {
  msg: Buffer;
  ascii: string;
}

function makeReplyAck(): {
  replyAck: (msg: Buffer, cb?: (e: Error | null) => void) => void;
  calls: ReplyCall[];
} {
  const calls: ReplyCall[] = [];
  return {
    replyAck(msg, cb) {
      calls.push({ msg, ascii: msg.toString("ascii") });
      cb?.(null);
    },
    calls,
  };
}

function deviceFrame(opcode: string, id = "PNMB", msgnum = "0001"): Buffer {
  const prefix = `>${opcode};ID=${id};#${msgnum};`;
  const lrc = xorChecksum(prefix);
  return Buffer.from(`${prefix}*${lrc}<\r\n`, "ascii");
}

describe("makePacketHandler", () => {
  it("emits an ACK for a device-originated UDP packet", () => {
    const { sink, captured } = makeSink();
    const { replyAck, calls } = makeReplyAck();
    const handle = makePacketHandler(sink);

    const pkt = deviceFrame("RGP", "PNMB", "0001");
    handle(pkt, "1.2.3.4:6600", replyAck, "udp");

    assert.equal(calls.length, 1, "exactly one ACK reply expected");
    const expected = buildAckBuffer("PNMB", "0001").toString("ascii");
    assert.equal(calls[0]!.ascii, expected);

    // Capture must include the rx event AND the ack event, both tagged udp.
    const events = captured.records.map((r) => r["event"]);
    assert.deepEqual(events, ["rx", "ack"]);
    for (const r of captured.records) {
      assert.equal(r["transport"], "udp");
    }
  });

  it("emits an ACK for a device-originated TCP packet (transport tagged tcp)", () => {
    const { sink, captured } = makeSink();
    const { replyAck, calls } = makeReplyAck();
    const handle = makePacketHandler(sink);

    const pkt = deviceFrame("RGP", "0592", "0042");
    handle(pkt, "5.6.7.8:54321", replyAck, "tcp");

    assert.equal(calls.length, 1);
    const expected = buildAckBuffer("0592", "0042").toString("ascii");
    assert.equal(calls[0]!.ascii, expected);

    for (const r of captured.records) {
      assert.equal(r["transport"], "tcp", `record not tagged tcp: ${JSON.stringify(r)}`);
    }
  });

  it("does NOT ACK a server-originated frame (msgnum >= 0x8000)", () => {
    const { sink, captured } = makeSink();
    const { replyAck, calls } = makeReplyAck();
    const handle = makePacketHandler(sink);

    const pkt = deviceFrame("ACK", "PNMB", "8001");
    handle(pkt, "1.2.3.4:6600", replyAck, "udp");

    assert.equal(calls.length, 0, "server-originated frame must not be ACKed");
    // Capture should still record the rx, but no ack event.
    const events = captured.records.map((r) => r["event"]);
    assert.deepEqual(events, ["rx"]);
  });

  it("does NOT ACK a frame whose checksum is wrong", () => {
    const { sink, captured } = makeSink();
    const { replyAck, calls } = makeReplyAck();
    const handle = makePacketHandler(sink);

    const bad = Buffer.from(">RGP;ID=PNMB;#0001;*FF<\r\n", "ascii");
    handle(bad, "1.2.3.4:6600", replyAck, "udp");

    assert.equal(calls.length, 0, "bad-LRC frame must not be ACKed");
    const events = captured.records.map((r) => r["event"]);
    assert.deepEqual(events, ["rx", "frame_invalid"]);
  });

  it("ACKs the trailer of a multi-message packet (spec §7) over TCP", () => {
    const { sink } = makeSink();
    const { replyAck, calls } = makeReplyAck();
    const handle = makePacketHandler(sink);

    const prefix = ">SSXP01<>SSXP11<>STD;ID=PNMB;#0010;";
    const lrc = xorChecksum(prefix);
    const pkt = Buffer.from(`${prefix}*${lrc}<\r\n`, "ascii");

    handle(pkt, "10.0.0.1:9999", replyAck, "tcp");

    assert.equal(calls.length, 1);
    const expected = buildAckBuffer("PNMB", "0010").toString("ascii");
    assert.equal(calls[0]!.ascii, expected);
  });

  it("propagates a transport-level send error to the log path (no throw)", () => {
    const { sink } = makeSink();
    let observedErr: Error | null = null;
    const replyAck = (
      _msg: Buffer,
      cb?: (e: Error | null) => void,
    ): void => {
      const err = new Error("simulated transport failure");
      observedErr = err;
      cb?.(err);
    };
    const handle = makePacketHandler(sink);

    // Must not throw — the failure is logged via pino, observed by callback.
    handle(deviceFrame("RGP"), "1.2.3.4:6600", replyAck, "udp");
    assert.ok(observedErr, "callback was invoked with an error");
  });
});
