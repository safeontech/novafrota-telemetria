// Streaming XVM frame extractor for TCP transport.
//
// XVM was designed for UDP datagrams (one packet = one self-contained logical
// message). Per Leonardo Dias (vendor, 2026-04-29 homologation channel),
// VL08 in TCP mode sends the SAME XVM frames over a TCP byte stream — the
// only delta is that the ACK is written back over the same TCP connection
// instead of as a UDP datagram.
//
// TCP gives us no message boundaries, so we have to recover them. Fortunately
// every XVM frame has explicit `>` start and `<` end markers (spec §2), and
// every logical packet ends in a "trailer" frame whose envelope carries
// `;ID=…;#…;*LRC` — `parseEnvelope()` returns non-null exactly for trailer
// frames (multi-message inner frames `>cmd<` parse as null per spec §7).
//
// Extraction algorithm:
//   1. Scan the buffer for every `>…<` frame in order.
//   2. The first frame whose envelope parses closes a logical packet.
//   3. Slice from byte 0 through the end of that frame (plus optional CRLF)
//      and emit it as a "datagram-equivalent" — the existing handler can
//      process it identically to a UDP datagram.
//   4. Repeat until no trailer-bearing frame remains.
//
// This handles correctly:
//   - Single-frame packets (`>RGP…;ID=…;#…;*LRC<\r\n`).
//   - Multi-message packets (`>cmd1<>cmd2<>STD…;ID=…;#…;*LRC<\r\n`) — the
//     inner frames come along inside the slice, so checksum verification
//     (which spans the whole packet, spec §7) works unchanged.
//   - Partial reads — we exit cleanly when no trailer is present yet.
//   - Multiple back-to-back packets in one TCP chunk — the loop drains them.
//   - Inter-packet whitespace / garbage — `splitFrames` skips it naturally,
//     and the per-packet slice consumes any prefix garbage along with the
//     packet that closes it.
//
// Pure: no I/O, no logging, no time.

import { parseEnvelope } from "./xvm.js";

/**
 * Hard cap on the per-connection accumulator. A misbehaving peer that streams
 * non-XVM bytes forever would otherwise pin memory. 64 KiB is ~1000 typical
 * XVM frames — well above any plausible legitimate burst between trailer
 * frames, so a buffer this large means the peer is broken.
 *
 * Exported for tests; the live server treats overflow as a connection-level
 * error (drop everything, log, keep listening).
 */
export const MAX_BUFFER_BYTES = 64 * 1024;

export interface ExtractResult {
  /** Complete logical packets ready to feed into the existing packet handler. */
  packets: Buffer[];
  /** Bytes left over for the next chunk (incomplete frame in flight, or empty). */
  remainder: Buffer;
  /**
   * `true` iff overflow was detected. Two distinct overflow conditions are
   * collapsed into this flag (caller treats both as "drop the connection"):
   *
   *   1. `remainder` exceeds `MAX_BUFFER_BYTES` — peer is streaming bytes
   *      with no recognizable XVM trailer. Classic accumulator-pin DoS.
   *
   *   2. A would-be packet (cursor → trailer end) exceeds `MAX_BUFFER_BYTES`.
   *      Without this check, a peer could send `>` then ~1 MiB of garbage,
   *      then `;ID=…;#…;*LRC<` — the trailer would close the packet and
   *      we'd happily emit a megabyte of "frame" through to the LRC check.
   *      This rejects such packets BEFORE emission. The packet is NOT
   *      added to `packets`; the connection is over from the caller's POV.
   *
   * In either case the caller should drop the connection. When set,
   * `remainder` is returned UNTRUNCATED so the caller can log a sample.
   */
  overflow: boolean;
}

/**
 * Extract complete XVM packets from a per-connection accumulator buffer.
 *
 * @param buf  current accumulator state (any prior unconsumed bytes plus the
 *             newly-arrived chunk, already concatenated by the caller).
 */
export function extractPackets(buf: Buffer): ExtractResult {
  const packets: Buffer[] = [];
  let cursor = 0;

  while (cursor < buf.length) {
    const text = buf.toString("ascii", cursor);
    const re = /(>[^<]*<)/g;
    let trailerEndAbs = -1;
    let m: RegExpExecArray | null;

    while ((m = re.exec(text)) !== null) {
      const env = parseEnvelope(m[1]!);
      if (env) {
        trailerEndAbs = cursor + m.index + m[0].length;
        break;
      }
    }

    if (trailerEndAbs === -1) {
      // No complete packet in what remains — wait for more bytes.
      break;
    }

    // Consume the trailer's optional CRLF (XVM emits `\r\n` after each
    // packet on the wire — spec §2). We include them in the slice so the
    // packet looks identical to its UDP counterpart for downstream code.
    let end = trailerEndAbs;
    if (end < buf.length && buf[end] === 0x0d /* \r */) end++;
    if (end < buf.length && buf[end] === 0x0a /* \n */) end++;

    // Per-packet size guard: an emitted packet larger than the cap must
    // not flow downstream. Stop here, return what we've already extracted,
    // and signal overflow with the oversized region as remainder so the
    // caller can sample/log and drop the connection.
    if (end - cursor > MAX_BUFFER_BYTES) {
      return {
        packets,
        remainder: buf.subarray(cursor),
        overflow: true,
      };
    }

    packets.push(buf.subarray(cursor, end));
    cursor = end;
  }

  const remainder = cursor === 0 ? buf : buf.subarray(cursor);
  const overflow = remainder.length > MAX_BUFFER_BYTES;

  return { packets, remainder, overflow };
}
