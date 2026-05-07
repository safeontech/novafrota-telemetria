import { pgEnum } from "drizzle-orm/pg-core";

// Transport over which a packet was received. Spec §1: VL06 is UDP-only;
// VL08 supports both UDP and TCP. The gateway listens on both and tags every
// packet so downstream queries can filter (e.g. all-UDP for VL06 fleets).
export const transportEnum = pgEnum("transport", ["udp", "tcp"]);

// Outcome of parsing a received packet — used to keep the packets table as a
// complete operational tape: even rejected packets persist so we can audit
// checksum failures, malformed datagrams, and retry storms.
export const parseStatusEnum = pgEnum("parse_status", [
  "ok",
  "no_frames",
  "checksum_mismatch",
  "no_trailer",
  "response_to_command", // msgnum >= 0x8000, server-command response
  // Same (device_id, msgnum) seen within the dedupe window — the device
  // missed our prior ACK and retried (spec §6.1). The packet IS persisted
  // (audit tape stays complete) but we skip the frames/reports inserts so
  // the same body isn't double-counted.
  "duplicate",
]);

// Frame direction inferred from msgnum range (spec §4): < 0x8000 means the
// device originated the frame; >= 0x8000 means the server did.
export const directionEnum = pgEnum("direction", [
  "device_to_server",
  "server_to_device",
]);

// Device model. We don't always know it (the protocol is the same), so
// "unknown" is the default and an operator can update later.
export const deviceModelEnum = pgEnum("device_model", [
  "VL06",
  "VL08",
  "unknown",
]);
