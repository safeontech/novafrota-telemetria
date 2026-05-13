import {
  bigint,
  boolean,
  doublePrecision,
  pgTable,
  smallint,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { deviceModelEnum, transportEnum } from "./enums";

/**
 * Tracker registry. Keyed by the 4-char `ID=xxxx` field on the wire
 * (spec §3) — e.g. `PNMB` for VL06 firmware, `0592` for VL08, plus
 * fleet-specific identifiers like `LN61` or `2244` from the protocol spec.
 *
 * The row is upserted on first contact so we never need an out-of-band
 * provisioning step before a tracker can talk to the gateway. `model` stays
 * `"unknown"` until an operator (or a heuristic on RUV00 firmware/board)
 * fills it in.
 */
export const devicesTable = pgTable("devices", {
  id: text("id").primaryKey(),
  model: deviceModelEnum("model").notNull().default("unknown"),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastPeer: text("last_peer"),
  lastTransport: transportEnum("last_transport"),

  // ---------------------------------------------------------------------
  // Denormalized "latest state" snapshot, updated on every successful
  // report ingest. The dashboard reads from here directly to render the
  // fleet map / vehicle cards without joining `reports_*`. Source of
  // truth for telemetry remains the report tables — these columns are a
  // 1:1 projection of the most recent value the gateway has seen.
  // ---------------------------------------------------------------------
  lastLat: doublePrecision("last_lat"),
  lastLon: doublePrecision("last_lon"),
  lastIgnition: boolean("last_ignition"),
  lastSpeedKmh: smallint("last_speed_kmh"),
  // Lifetime counters → bigint, same reasoning as reports_ruv0{1,3}.
  lastHourmeterMin: bigint("last_hourmeter_min", { mode: "number" }),
  lastOdometerM: bigint("last_odometer_m", { mode: "number" }),
  // `lastDeviceTs` is the device-clock timestamp of the latest report;
  // `lastReportAt` is the wall-clock when WE persisted it. They differ
  // when the device buffers offline and replays later.
  lastDeviceTs: timestamp("last_device_ts", { withTimezone: true }),
  lastReportAt: timestamp("last_report_at", { withTimezone: true }),

  displayName: text("display_name"),
  machineModel: text("machine_model"),
  machineType: text("machine_type"),
  serviceLimitHours: bigint("service_limit_hours", { mode: "number" }),

  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertDeviceSchema = createInsertSchema(devicesTable);
export type InsertDevice = z.infer<typeof insertDeviceSchema>;
export type Device = typeof devicesTable.$inferSelect;
