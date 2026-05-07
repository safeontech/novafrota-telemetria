/**
 * Replay a gateway capture file (NDJSON) into the database via the same
 * parser + db-sink pipeline the live gateway uses. Idempotent: the db-sink
 * already de-duplicates on (device_id, msgnum), so re-running is safe.
 *
 * Usage:
 *   DATABASE_URL=... pnpm --filter @workspace/gateway run replay-capture <file>
 *
 * The capture is one JSON object per line. Lines with event="rx" are
 * replayed; all other event types (gateway_started, ack, frame_invalid)
 * are skipped.
 */
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { db } from "@workspace/db";
import { makeDbSink } from "../src/db-sink";
import { parseEnvelope } from "../src/parser";
import { splitFrames, verifyChecksum } from "../src/lib/xvm";

interface RxEvent {
  ts: string;
  event: string;
  peer?: string;
  transport?: string;
  bytes?: number;
  ascii?: string;
}

async function main(): Promise<void> {
  const file = process.argv[2];
  if (!file) {
    console.error("usage: replay-capture <capture-file>");
    process.exit(2);
  }
  if (!process.env["DATABASE_URL"]) {
    throw new Error("DATABASE_URL is not set; aborting replay.");
  }
  console.log(
    `replay: target DB = ${process.env["DATABASE_URL"]!.replace(/:[^@]*@/, ":****@")}`,
  );
  console.log(`replay: source = ${file}`);

  const sink = makeDbSink(db);

  let total = 0;
  let replayed = 0;
  let skippedNonRx = 0;
  let parseFailed = 0;
  let badChecksum = 0;

  const rl = createInterface({
    input: createReadStream(file),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) continue;
    total++;
    let evt: RxEvent;
    try {
      evt = JSON.parse(line);
    } catch {
      parseFailed++;
      continue;
    }
    if (evt.event !== "rx") {
      skippedNonRx++;
      continue;
    }
    const ascii = evt.ascii;
    if (!ascii) {
      parseFailed++;
      continue;
    }
    const buf = Buffer.from(ascii, "ascii");
    const rawFrames = splitFrames(buf);
    if (rawFrames.length === 0) {
      parseFailed++;
      continue;
    }
    const trailerStr = rawFrames[rawFrames.length - 1]!;
    const env = parseEnvelope(trailerStr);
    if (!env) {
      parseFailed++;
      continue;
    }
    // Per parser.ts comment + handler.ts: the device computes the checksum
    // over the entire datagram, NOT per-frame. For multi-message packets
    // only the whole-buffer check is meaningful; per-frame env.checksum.ok
    // would falsely fail any packet with more than one >…< envelope.
    const checksumOk = verifyChecksum(buf, env);
    if (!checksumOk) {
      badChecksum++;
      // Still persist so the row is faithful — gateway records bad-checksum
      // packets too. Do NOT mark acked.
    }
    const handle = sink.beginPacket({
      receivedAt: new Date(evt.ts),
      peer: evt.peer ?? "unknown",
      transport: (evt.transport as "udp" | "tcp") ?? "udp",
      bytes: evt.bytes ?? buf.length,
      ascii,
      frames: [env],
      rawFrameCount: rawFrames.length,
      trailer: env,
      checksumOk,
    });
    if (checksumOk) {
      // Synthesise the ACK the live gateway would have sent.
      const ackBody = `>ACK;ID=${env.id};#${env.msgnum};`;
      // Use the same XOR helper indirectly via parseEnvelope is overkill —
      // we don't actually need the ACK string in the DB to be byte-identical
      // for analytics, just persisted with a timestamp.
      handle.markAcked(`${ackBody}*XX<\r\n`, new Date(new Date(evt.ts).getTime() + 5));
    }
    await handle.done();
    replayed++;
  }

  await sink.shutdown(15_000);

  console.log(
    `replay: done — total=${total} replayed=${replayed} skipped_non_rx=${skippedNonRx} parse_failed=${parseFailed} bad_checksum=${badChecksum}`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("replay: failed", err);
  process.exit(1);
});
