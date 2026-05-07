import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { devicesTable } from "./devices";
import { parseStatusEnum, transportEnum } from "./enums";

/**
 * One row per inbound packet (UDP datagram or TCP framer-emitted packet
 * boundary). This is the operational "tape" — we persist EVERY received
 * byte stream, including rejects, before any decode runs. That mirrors the
 * existing NDJSON capture file (spec §13.6: evidence-before-decode) and lets
 * us replay or post-mortem any incident from the database alone.
 *
 * `parseStatus` records what the parser made of it; `deviceId` and `msgnum`
 * are populated for the trailer-bearing frame (the one that drives the ACK).
 * Inner frames of a multi-message packet get rows in `frames`, all linked
 * back here via `packet_id`.
 */
export const packetsTable = pgTable(
  "packets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    peer: text("peer").notNull(),
    transport: transportEnum("transport").notNull(),
    bytes: integer("bytes").notNull(),
    ascii: text("ascii").notNull(),
    parseStatus: parseStatusEnum("parse_status").notNull(),
    frameCount: integer("frame_count").notNull().default(0),

    // Set if a trailer frame was successfully parsed. We use `setNull` so
    // deleting a device (rare — manual cleanup) doesn't lose the audit row.
    deviceId: text("device_id").references(() => devicesTable.id, {
      onDelete: "set null",
    }),
    msgnum: text("msgnum"),

    // ACK metadata — populated when the gateway successfully sent the ACK
    // back. `null` means either we didn't ACK (checksum mismatch, server
    // command response) or the ACK send failed (logged separately).
    ackedAt: timestamp("acked_at", { withTimezone: true }),
    ackAscii: text("ack_ascii"),
  },
  (t) => [
    index("packets_received_at_idx").on(t.receivedAt.desc()),
    index("packets_device_received_idx").on(t.deviceId, t.receivedAt.desc()),
    index("packets_peer_idx").on(t.peer),
    index("packets_parse_status_idx").on(t.parseStatus),
  ],
);

export const insertPacketSchema = createInsertSchema(packetsTable).omit({
  id: true,
});
export type InsertPacket = z.infer<typeof insertPacketSchema>;
export type Packet = typeof packetsTable.$inferSelect;
