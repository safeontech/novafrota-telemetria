import dgram from "node:dgram";
import net from "node:net";
import { createWriteStream, mkdirSync, type WriteStream } from "node:fs";
import path from "node:path";
import {
  makePacketHandler,
  type CaptureSink,
  type ReplyAck,
} from "./handler.js";
import { makeDbSink, NULL_DB_SINK, type DbSink } from "./db-sink.js";
import { extractPackets, MAX_BUFFER_BYTES } from "./lib/tcp-framer.js";
import { logger } from "./lib/logger.js";

const DEFAULT_PORT = 6600;
const DEFAULT_HOST = "0.0.0.0";
const DEFAULT_CAPTURE_FILE = "fixtures/xvm-live.txt";
const TCP_IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 min

function parsePort(raw: string | undefined): number {
  if (raw === undefined || raw === "") return DEFAULT_PORT;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0 || n > 65535) {
    throw new Error(
      `Invalid GATEWAY_PORT value: "${raw}" (expected integer 1..65535)`,
    );
  }
  return n;
}

function resolveHost(raw: string | undefined): string {
  if (raw === undefined || raw === "") return DEFAULT_HOST;
  return raw;
}

function resolveCaptureFile(raw: string | undefined): string {
  const rel = raw && raw !== "" ? raw : DEFAULT_CAPTURE_FILE;
  return path.resolve(process.cwd(), rel);
}

function openCaptureStream(filePath: string): WriteStream {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const stream = createWriteStream(filePath, { flags: "a" });
  stream.on("error", (err) => {
    // Fail loud: if we cannot durably append the corpus, the only acceptable
    // outcome is process death. Silent fallback would mean we are "listening
    // but not capturing", which defeats the entire purpose of the gateway.
    logger.fatal({ err, filePath }, "capture stream error — exiting");
    process.exit(1);
  });
  return stream;
}

async function main(): Promise<void> {
  const port = parsePort(process.env["GATEWAY_PORT"]);
  const host = resolveHost(process.env["GATEWAY_HOST"]);
  const captureFile = resolveCaptureFile(process.env["GATEWAY_CAPTURE_FILE"]);

  const captureStream = openCaptureStream(captureFile);

  // Readiness probe: write+flush a startup marker before declaring readiness.
  // If the disk is unwritable we crash here, never in the hot RX path.
  const startupMarker = `${JSON.stringify({
    ts: new Date().toISOString(),
    event: "gateway_started",
    pid: process.pid,
  })}\n`;
  captureStream.write(startupMarker, (err) => {
    if (err) {
      logger.fatal(
        { err, captureFile },
        "capture file readiness probe failed — exiting",
      );
      process.exit(1);
    }
    logger.info({ captureFile }, "capture file opened (append mode, verified)");
  });

  let backpressureWarned = false;
  const captureSink: CaptureSink = {
    write(line: string): void {
      const ok = captureStream.write(line);
      if (!ok && !backpressureWarned) {
        backpressureWarned = true;
        logger.warn(
          { captureFile },
          "capture stream backpressure — sustained burst exceeds disk throughput",
        );
        captureStream.once("drain", () => {
          backpressureWarned = false;
          logger.info("capture stream drained");
        });
      }
    },
  };

  // ---------------------------------------------------------------------
  // DB sink wiring (Milestone 3). When DATABASE_URL is set, every received
  // packet is also persisted into the Drizzle schema. When unset, we run
  // with a no-op sink so dev / single-machine runs work without Postgres.
  // ---------------------------------------------------------------------
  // Dynamic import: the `@workspace/db` module throws at top-level when
  // DATABASE_URL is absent (it eagerly constructs the pool), so we must
  // gate the import itself, not just the makeDbSink call.
  let dbSink: DbSink;
  if (process.env["DATABASE_URL"]) {
    const { db } = await import("@workspace/db");
    dbSink = makeDbSink(db);
    logger.info("DATABASE_URL set — db-sink wired for packet persistence");
  } else {
    dbSink = NULL_DB_SINK;
    logger.warn(
      "DATABASE_URL not set — db-sink disabled; capture file is the only persistence",
    );
  }

  const handlePacket = makePacketHandler(captureSink, dbSink);

  // -----------------------------------------------------------------------
  // Startup is fail-fast: if EITHER transport fails to bind, the process
  // exits non-zero so systemd reports failure (instead of silently serving
  // only one half of the fleet). After both `listening` events fire, we
  // swap the per-socket error handler from "fatal at startup" to "log at
  // runtime", since dropping the process for a transient runtime error is
  // worse than logging it.
  // -----------------------------------------------------------------------
  let udpReady = false;
  let tcpReady = false;
  const fatalBindError = (transport: "udp" | "tcp") => (err: Error): void => {
    logger.fatal(
      { err, transport, host, port },
      "transport failed to bind at startup — exiting",
    );
    process.exit(1);
  };

  // -----------------------------------------------------------------------
  // UDP listener — VL06 fleet (PNMB) + VL08 fleet when configured for UDP.
  // -----------------------------------------------------------------------
  const udpSock = dgram.createSocket({ type: "udp4", reuseAddr: true });

  udpSock.on("message", (buf, rinfo) => {
    const peer = `${rinfo.address}:${rinfo.port}`;
    const replyAck: ReplyAck = (msg, cb) => {
      udpSock.send(msg, rinfo.port, rinfo.address, (err) => cb?.(err ?? null));
    };
    handlePacket(buf, peer, replyAck, "udp");
  });

  const udpStartupErr = fatalBindError("udp");
  udpSock.on("error", udpStartupErr);

  udpSock.on("listening", () => {
    const addr = udpSock.address();
    logger.info(
      { host: addr.address, port: addr.port, transport: "udp" },
      "XVM gateway listening (UDP)",
    );
    udpReady = true;
    udpSock.removeListener("error", udpStartupErr);
    udpSock.on("error", (err) => {
      logger.error({ err, transport: "udp" }, "udp socket error");
    });
  });

  udpSock.bind(port, host);

  // -----------------------------------------------------------------------
  // TCP listener — VL08 fleet (0592) when configured for TCP.
  //
  // Per Leonardo Dias (vendor, 2026-04-29 homologação channel):
  //   - VL08 in TCP mode sends the same XVM ASCII frames as in UDP mode.
  //   - The only delta is that the ACK is written back over the originating
  //     TCP connection instead of as a UDP datagram to source IP:port.
  //
  // VL06 is UDP-only per the same conversation, so this listener is for VL08
  // (and any future XVM device whose firmware supports TCP).
  // -----------------------------------------------------------------------
  // Track every live TCP socket so shutdown can end them deterministically
  // instead of waiting on tcpServer.close()'s grace period.
  const liveSockets = new Set<net.Socket>();

  const tcpServer = net.createServer((socket) => {
    socket.setNoDelay(true);
    socket.setTimeout(TCP_IDLE_TIMEOUT_MS);
    liveSockets.add(socket);

    const peer = `${socket.remoteAddress}:${socket.remotePort}`;
    let acc: Buffer = Buffer.alloc(0);
    let droppedBecauseFull = false;

    logger.info({ peer, transport: "tcp" }, "tcp connection opened");

    const replyAck: ReplyAck = (msg, cb) => {
      // socket.write returns false on backpressure; the callback still fires
      // once flushed. We propagate err only — the handler doesn't use bytes.
      socket.write(msg, (err) => cb?.(err ?? null));
    };

    socket.on("data", (chunk: Buffer) => {
      if (droppedBecauseFull) {
        // Connection is in a "drop everything" state until it closes; keep
        // logging at debug-level frequency only.
        return;
      }

      acc = acc.length === 0 ? chunk : Buffer.concat([acc, chunk]);

      const { packets, remainder, overflow } = extractPackets(acc);
      acc = remainder;

      for (const pkt of packets) {
        handlePacket(pkt, peer, replyAck, "tcp");
      }

      if (overflow) {
        // Peer is streaming garbage with no recognizable XVM trailer for
        // 64 KiB+. Drop the buffer, mark the connection toxic, and end it.
        // No ACK can be honest about non-XVM bytes.
        droppedBecauseFull = true;
        const sample = acc.subarray(0, 200).toString("ascii");
        acc = Buffer.alloc(0);
        logger.warn(
          {
            peer,
            transport: "tcp",
            bufferedBytes: remainder.length,
            cap: MAX_BUFFER_BYTES,
            sample,
          },
          "tcp accumulator exceeded cap without yielding a complete XVM packet — dropping connection",
        );
        socket.destroy();
      }
    });

    socket.on("timeout", () => {
      logger.info({ peer, transport: "tcp" }, "tcp connection idle timeout — closing");
      socket.end();
    });

    socket.on("error", (err) => {
      logger.warn({ err, peer, transport: "tcp" }, "tcp socket error");
    });

    socket.on("close", (hadError) => {
      liveSockets.delete(socket);
      logger.info(
        { peer, transport: "tcp", hadError, leftoverBytes: acc.length },
        "tcp connection closed",
      );
    });
  });

  const tcpStartupErr = fatalBindError("tcp");
  tcpServer.on("error", tcpStartupErr);

  tcpServer.on("listening", () => {
    const addr = tcpServer.address();
    const a = typeof addr === "string" ? { address: addr, port: -1 } : addr;
    logger.info(
      { host: a?.address, port: a?.port, transport: "tcp" },
      "XVM gateway listening (TCP)",
    );
    tcpReady = true;
    tcpServer.removeListener("error", tcpStartupErr);
    tcpServer.on("error", (err) => {
      logger.error({ err, transport: "tcp" }, "tcp server error");
    });
  });

  tcpServer.listen(port, host);

  // -----------------------------------------------------------------------
  // Shutdown — deterministic:
  //   1. Stop accepting new TCP connections (server.close — does NOT wait
  //      on in-flight sockets, but its callback only fires after the listen
  //      backlog is drained AND every tracked socket is closed).
  //   2. Tell every tracked TCP socket to flush + end (FIN). If any peer
  //      doesn't honor FIN within the grace window, force-destroy.
  //   3. Close UDP socket.
  //   4. Flush + close capture stream, then exit 0.
  //
  // The pre-existing 5s wall-clock kill is still here as a safety net.
  // -----------------------------------------------------------------------
  let shuttingDown = false;
  const shutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(
      { signal, liveTcpSockets: liveSockets.size, udpReady, tcpReady },
      "shutdown requested, closing sockets",
    );

    // (2) End every live TCP socket; force-destroy any laggards after 2s.
    for (const s of liveSockets) {
      try {
        s.end();
      } catch {
        /* socket may already be dead */
      }
    }
    const destroyTimer = setTimeout(() => {
      for (const s of liveSockets) {
        try {
          s.destroy();
        } catch {
          /* */
        }
      }
    }, 2000);
    destroyTimer.unref();

    let pending = 2;
    const onClosed = (): void => {
      pending -= 1;
      if (pending > 0) return;
      // Drain the DB sink first so any in-flight packet inserts /
      // ACK-metadata updates land before we close the capture file +
      // exit. Bounded by 4s — strictly less than the 5s safety-net
      // exit timer below so the hard-kill never races the drain.
      void dbSink.shutdown(4_000).finally(() => {
        captureStream.end(() => {
          logger.info("clean shutdown complete");
          process.exit(0);
        });
      });
    };

    udpSock.close(onClosed);
    tcpServer.close((err) => {
      if (err) logger.warn({ err }, "tcp server close reported error");
      onClosed();
    });

    setTimeout(() => {
      logger.warn(
        { remainingTcpSockets: liveSockets.size },
        "forcing exit after 5s timeout",
      );
      process.exit(1);
    }, 5000).unref();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  logger.fatal({ err }, "gateway main() rejected — exiting");
  process.exit(1);
});
