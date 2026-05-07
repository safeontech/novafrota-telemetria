import type { DbSink, PacketHandle } from "./db-sink.js";
import { NULL_DB_SINK } from "./db-sink.js";
import { logger } from "./lib/logger.js";
import {
  buildAckBuffer,
  isDeviceOriginated,
  parseEnvelope,
  splitFrames,
  verifyChecksum,
  xorChecksum,
} from "./lib/xvm.js";
import { parseEnvelope as parseEnvelopeRich } from "./parser.js";

export interface CaptureSink {
  write(line: string): void;
}

/**
 * Transport-agnostic ACK reply path.
 *
 * The packet handler doesn't know (and shouldn't care) whether the inbound
 * packet arrived over UDP or TCP — it just calls this with the ACK bytes
 * when a device-originated frame needs acknowledging. The transport-specific
 * adapter (UDP datagram back to source IP:port, or TCP write back over the
 * originating connection) is closed over by the caller.
 */
export type ReplyAck = (
  msg: Buffer,
  callback?: (err: Error | null) => void,
) => void;

export type PacketHandler = (
  buf: Buffer,
  peer: string,
  replyAck: ReplyAck,
  transport: "udp" | "tcp",
) => void;

function nowIso(): string {
  return new Date().toISOString();
}

function ndjson(record: Record<string, unknown>): string {
  return `${JSON.stringify(record)}\n`;
}

/**
 * Build the packet handler. Returns a function that processes one logical
 * XVM packet — for UDP, that's one datagram; for TCP, that's one frame
 * sequence delimited by a trailer-bearing frame (recovered upstream by
 * `lib/tcp-framer.ts`).
 *
 * The handler is intentionally synchronous up to the point of `replyAck`.
 * The ACK send completion is observed via the callback so a failed send is
 * logged, not silently dropped.
 *
 * @param capture  NDJSON capture sink (durable RX/ACK tape on disk).
 * @param dbSink   Optional Postgres persistence sink (Milestone 3). Defaults
 *                 to a no-op sink so the handler can be used in dev without a
 *                 database, and to keep the test surface light. The sink runs
 *                 fire-and-forget — the synchronous ACK path is never blocked
 *                 by DB latency or outages.
 */
export function makePacketHandler(
  capture: CaptureSink,
  dbSink: DbSink = NULL_DB_SINK,
): PacketHandler {
  return function handlePacket(buf, peer, replyAck, transport) {
    const rxDate = new Date();
    const rxTs = rxDate.toISOString();
    const ascii = buf.toString("ascii");

    // Always preserve raw evidence — same line shape as Milestone 0 so the
    // existing offline corpus stays valid. `transport` is added so post-hoc
    // analysis can tell UDP from TCP packets in the same capture file.
    logger.info({ ts: rxTs, peer, transport, bytes: buf.length, ascii }, "rx");
    capture.write(
      ndjson({
        ts: rxTs,
        event: "rx",
        peer,
        transport,
        bytes: buf.length,
        ascii,
      }),
    );

    const rawFrames = splitFrames(buf);

    // Walk all frames; only the trailer drives ACK + report decode (spec §7).
    let trailerEnv: ReturnType<typeof parseEnvelope> = null;
    let trailerRaw: string | null = null;

    for (const raw of rawFrames) {
      const env = parseEnvelope(raw);
      if (!env) {
        // Inner frame of a multi-message packet (spec §7) or a malformed
        // fragment — log and continue.
        logger.info(
          { peer, transport, raw },
          "frame has no envelope trailer (multi-message inner or malformed)",
        );
        continue;
      }
      // Spec guarantees one trailer per packet, but if a malformed packet
      // somehow has multiple, the LAST one wins (matches what the device
      // would have stamped).
      trailerEnv = env;
      trailerRaw = raw;
    }

    // ----------------------------------------------------------------------
    // Build the rich envelope list (with direction + msgnumDec + per-frame
    // checksum) for the DB sink. We do this before the early-return paths
    // so even rejected packets get a `packets` row written for the audit
    // tape — that's the whole point of having `parse_status` in the schema.
    // ----------------------------------------------------------------------
    const richFrames = rawFrames
      .map((raw) => parseEnvelopeRich(raw))
      .filter((f): f is NonNullable<typeof f> => f !== null);
    const richTrailer =
      trailerEnv === null
        ? null
        : richFrames.find(
            (f) => f.id === trailerEnv!.id && f.msgnum === trailerEnv!.msgnum,
          ) ?? null;
    const checksumOk =
      trailerEnv !== null && verifyChecksum(buf, trailerEnv);

    const dbHandle: PacketHandle = dbSink.beginPacket({
      receivedAt: rxDate,
      peer,
      transport,
      bytes: buf.length,
      ascii,
      frames: richFrames,
      // Pass the raw splitter count so multi-message packets (spec §7)
      // record the true on-wire frame count, including inner command
      // echoes that carry no trailer and never become envelope rows.
      rawFrameCount: rawFrames.length,
      trailer: richTrailer,
      checksumOk,
    });

    // ----------------------------------------------------------------------
    // From here on: rejection + ACK paths. Each early-return mirrors what
    // Milestone 1 already did; the DB write is already in flight via the
    // handle above and will land with the right `parse_status`.
    // ----------------------------------------------------------------------

    if (rawFrames.length === 0) {
      logger.warn({ peer, transport, ascii }, "packet contained no XVM frames");
      return;
    }

    if (!trailerEnv || !trailerRaw) {
      // No trailer at all → nothing to ACK. The inner frames were already
      // logged above.
      return;
    }

    if (!checksumOk) {
      const expected = xorChecksum(buf.toString("ascii"));
      logger.warn(
        {
          peer,
          transport,
          raw: trailerRaw,
          id: trailerEnv.id,
          msgnum: trailerEnv.msgnum,
          got: trailerEnv.lrc,
          expected,
        },
        "packet checksum mismatch — not acked, device will retry",
      );
      capture.write(
        ndjson({
          ts: nowIso(),
          event: "frame_invalid",
          reason: "checksum_mismatch",
          peer,
          transport,
          raw: trailerRaw,
          got: trailerEnv.lrc,
          expected,
        }),
      );
      return;
    }

    logger.info(
      {
        peer,
        transport,
        id: trailerEnv.id,
        msgnum: trailerEnv.msgnum,
        opcode: trailerEnv.opcode,
        body: trailerEnv.body,
        frames: rawFrames.length,
      },
      "packet parsed",
    );

    if (!isDeviceOriginated(trailerEnv.msgnum)) {
      // msgnum >= 0x8000 = response to one of OUR commands. We have not
      // issued any commands yet (Milestone 1 is receive-only on the command
      // channel), so this is unexpected. Log it and move on.
      logger.info(
        {
          peer,
          transport,
          id: trailerEnv.id,
          msgnum: trailerEnv.msgnum,
          opcode: trailerEnv.opcode,
        },
        "response to server command — no ack required",
      );
      return;
    }

    const ackBuf = buildAckBuffer(trailerEnv.id, trailerEnv.msgnum);
    const ackAscii = ackBuf.toString("ascii");

    replyAck(ackBuf, (err) => {
      if (err) {
        logger.error(
          { err, peer, transport, id: trailerEnv!.id, msgnum: trailerEnv!.msgnum },
          "ack send failed — device will retry",
        );
        return;
      }
      const ackedAt = new Date();
      logger.info(
        {
          peer,
          transport,
          id: trailerEnv!.id,
          msgnum: trailerEnv!.msgnum,
          ascii: ackAscii,
        },
        "ack sent",
      );
      capture.write(
        ndjson({
          ts: ackedAt.toISOString(),
          event: "ack",
          peer,
          transport,
          id: trailerEnv!.id,
          msgnum: trailerEnv!.msgnum,
          ascii: ackAscii,
        }),
      );
      dbHandle.markAcked(ackAscii, ackedAt);
    });
  };
}
