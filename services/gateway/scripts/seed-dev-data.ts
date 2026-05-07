/**
 * Dev-DB seeder: produces realistic device + telemetry rows so the dashboard
 * has something to render before any real tracker connects to the gateway.
 *
 * Generates two devices (PNMB / VL06 in Argentina, 0592 / VL08 in Brazil),
 * each with 5 RGP packets simulating a 30-minute movement track ending at
 * "now". Frames are constructed with valid XOR checksums and pushed through
 * the same parser + db-sink the gateway uses, so the resulting rows match
 * the production code path exactly.
 *
 * Run with `pnpm --filter @workspace/gateway run seed-dev`.
 */
import { db } from "@workspace/db";
import { makeDbSink } from "../src/db-sink";
import { parseEnvelope, decodeRGP } from "../src/parser";
import { splitFrames, xorChecksum, parseEnvelope as parseEnv2 } from "../src/lib/xvm";

interface Track {
  id: string;
  model: "VL06" | "VL08";
  startLat: number;
  startLon: number;
  driftPerStepDeg: number;
  ignition: boolean;
  speedRange: [number, number];
}

const TRACKS: Track[] = [
  {
    id: "PNMB",
    model: "VL06",
    startLat: -34.6037,
    startLon: -58.3816,
    driftPerStepDeg: 0.002,
    ignition: true,
    speedRange: [25, 65],
  },
  {
    id: "0592",
    model: "VL08",
    startLat: -23.5505,
    startLon: -46.6333,
    driftPerStepDeg: 0.0015,
    ignition: true,
    speedRange: [10, 45],
  },
];

const POINTS_PER_TRACK = 5;
const STEP_MS = 6 * 60 * 1000;

function pad(n: number, width: number): string {
  return n.toString().padStart(width, "0");
}

function encodeLat(lat: number): string {
  const sign = lat < 0 ? "-" : "+";
  const abs = Math.abs(lat);
  const intPart = Math.floor(abs);
  const fracDigits = Math.round((abs - intPart) * 100000);
  return `${sign}${pad(intPart, 2)}${pad(fracDigits, 5)}`;
}

function encodeLon(lon: number): string {
  const sign = lon < 0 ? "-" : "+";
  const abs = Math.abs(lon);
  const intPart = Math.floor(abs);
  const fracDigits = Math.round((abs - intPart) * 100000);
  return `${sign}${pad(intPart, 3)}${pad(fracDigits, 5)}`;
}

function encodeDateTime(d: Date): { date6: string; time6: string } {
  const yy = pad(d.getUTCFullYear() % 100, 2);
  const mm = pad(d.getUTCMonth() + 1, 2);
  const dd = pad(d.getUTCDate(), 2);
  const HH = pad(d.getUTCHours(), 2);
  const MM = pad(d.getUTCMinutes(), 2);
  const SS = pad(d.getUTCSeconds(), 2);
  return { date6: `${dd}${mm}${yy}`, time6: `${HH}${MM}${SS}` };
}

function buildRgpFrame(args: {
  id: string;
  msgnum: string;
  ts: Date;
  lat: number;
  lon: number;
  speedKmh: number;
  headingDeg: number;
  ignition: boolean;
}): string {
  const { date6, time6 } = encodeDateTime(args.ts);
  const lat = encodeLat(args.lat);
  const lon = encodeLon(args.lon);
  const speed = pad(Math.round(args.speedKmh), 3);
  const dir = pad(Math.round(args.headingDeg), 3);
  const gps = "1";
  const since = "01";
  const dimask = args.ignition ? "C0" : "40";
  const reserved = "00";
  const hdop = "01";
  const body = `RGP${date6}${time6}${lat}${lon}${speed}${dir}${gps}${since}${dimask}${reserved}${hdop}`;
  const prefix = `>${body};ID=${args.id};#${args.msgnum};`;
  const lrc = xorChecksum(prefix);
  return `${prefix}*${lrc}<\r\n`;
}

async function ingestFrame(
  sink: ReturnType<typeof makeDbSink>,
  ascii: string,
  receivedAt: Date,
): Promise<void> {
  const buf = Buffer.from(ascii, "ascii");
  const rawFrames = splitFrames(buf);
  if (rawFrames.length === 0) {
    console.warn("seed: no frames extracted from", ascii);
    return;
  }
  const trailerStr = rawFrames[rawFrames.length - 1]!;
  const trailerEnv = parseEnv2(trailerStr);
  if (!trailerEnv) {
    console.warn("seed: trailer envelope failed to parse:", trailerStr);
    return;
  }
  const env = parseEnvelope(trailerStr);
  if (!env) {
    console.warn("seed: parser.parseEnvelope failed:", trailerStr);
    return;
  }
  const handle = sink.beginPacket({
    receivedAt,
    peer: "127.0.0.1:60000",
    transport: "udp",
    bytes: buf.length,
    ascii,
    frames: [env],
    rawFrameCount: rawFrames.length,
    trailer: env,
    checksumOk: env.checksum.ok,
  });
  const ackBody = `>ACK;ID=${env.id};#${env.msgnum};`;
  const ackLrc = xorChecksum(ackBody);
  handle.markAcked(`${ackBody}*${ackLrc}<\r\n`, new Date(receivedAt.getTime() + 5));
  await handle.done();
}

async function main(): Promise<void> {
  if (!process.env["DATABASE_URL"]) {
    throw new Error("DATABASE_URL is not set; aborting seed.");
  }
  console.log(`seed: target DB = ${process.env["DATABASE_URL"]!.replace(/:[^@]*@/, ":****@")}`);

  const sink = makeDbSink(db);
  const now = Date.now();
  let total = 0;

  for (const track of TRACKS) {
    console.log(`seed: track ${track.id} (${track.model})`);
    for (let i = 0; i < POINTS_PER_TRACK; i++) {
      const stepBack = (POINTS_PER_TRACK - 1 - i) * STEP_MS;
      const ts = new Date(now - stepBack);
      const lat = track.startLat + i * track.driftPerStepDeg;
      const lon = track.startLon + i * track.driftPerStepDeg * 0.7;
      const speedKmh =
        track.speedRange[0] +
        Math.round(Math.random() * (track.speedRange[1] - track.speedRange[0]));
      const headingDeg = (45 + i * 15) % 360;
      const msgnum = pad(i + 1, 4).toUpperCase();
      const ascii = buildRgpFrame({
        id: track.id,
        msgnum,
        ts,
        lat,
        lon,
        speedKmh,
        headingDeg,
        ignition: track.ignition,
      });
      try {
        const decoded = decodeRGP(`RGP${ascii.split("RGP")[1]!.split(";")[0]!}`);
        if (decoded.lat == null || decoded.lon == null) {
          console.warn(`seed: ${track.id} #${msgnum} decode produced no lat/lon — frame:`, ascii);
        }
      } catch {
        // decode is just a sanity log — ignore.
      }
      await ingestFrame(sink, ascii, ts);
      total++;
    }
  }

  await sink.shutdown(10_000);

  // Backfill device.model — db-sink only sets it to "unknown" on first contact.
  const { eq } = await import("drizzle-orm");
  const { devicesTable } = await import("@workspace/db");
  for (const track of TRACKS) {
    await db.update(devicesTable).set({ model: track.model }).where(eq(devicesTable.id, track.id));
  }

  console.log(`seed: done — ingested ${total} frames across ${TRACKS.length} devices`);
  process.exit(0);
}

main().catch((err) => {
  console.error("seed: failed", err);
  process.exit(1);
});
