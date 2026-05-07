import {
  boolean,
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
import { directionEnum } from "./enums";
import { packetsTable } from "./packets";

/**
 * One row per parsed XVM frame. A packet may produce many frames in the
 * multi-message form (spec §7) — only the LAST frame of such a packet
 * carries the `;ID=…;#…;*LRC` trailer; inner frames don't. `isTrailer`
 * marks which one drove the checksum verification + ACK decision.
 *
 * Dedupe of duplicates (same `(device_id, msgnum)` from a retry storm when
 * the device didn't see our ACK) is handled at the application layer using
 * the `(device_id, msgnum)` index — schema-level UNIQUE would be wrong
 * because msgnum wraps at 0x8000 and would corrupt long-running fleets.
 */
export const framesTable = pgTable(
  "frames",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    packetId: uuid("packet_id")
      .notNull()
      .references(() => packetsTable.id, { onDelete: "cascade" }),
    deviceId: text("device_id")
      .notNull()
      .references(() => devicesTable.id),

    msgnum: text("msgnum").notNull(),
    msgnumDec: integer("msgnum_dec").notNull(),
    opcode: text("opcode").notNull(),
    direction: directionEnum("direction").notNull(),
    body: text("body").notNull(),
    lrc: text("lrc").notNull(),
    isTrailer: boolean("is_trailer").notNull(),

    // Header fields extracted from RUV/RUS-family bodies (spec §9.1).
    // `null` for RGP/ACK and any opcode without a 3-digit event index.
    eventIndex: integer("event_index"),
    protocolId: text("protocol_id"),
    deviceTs: timestamp("device_ts", { withTimezone: true }),

    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Dedupe lookup index — the gateway's "did we receive this (device, msgnum)
    // recently?" query reads against this and orders by received_at DESC LIMIT 1.
    // No UNIQUE: msgnum is 16-bit and wraps at 0x8000 (spec §4); a global UNIQUE
    // would corrupt long-running fleets. The dedupe write path is single-process
    // (one gateway systemd unit per VPS) so an app-layer SELECT-then-INSERT is
    // race-free for the current deployment. If multi-writer ingestion is added
    // later, introduce a transactional dedupe table with a time-bucketed key.
    index("frames_device_msgnum_received_idx").on(
      t.deviceId,
      t.msgnum,
      t.receivedAt.desc(),
    ),
    index("frames_device_opcode_received_idx").on(
      t.deviceId,
      t.opcode,
      t.receivedAt.desc(),
    ),
    index("frames_opcode_received_idx").on(t.opcode, t.receivedAt.desc()),
    index("frames_packet_idx").on(t.packetId),
    index("frames_received_at_idx").on(t.receivedAt.desc()),
  ],
);

export const insertFrameSchema = createInsertSchema(framesTable).omit({
  id: true,
});
export type InsertFrame = z.infer<typeof insertFrameSchema>;
export type Frame = typeof framesTable.$inferSelect;
