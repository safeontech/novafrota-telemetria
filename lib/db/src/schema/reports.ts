// Decoded reports — one table per opcode, populated downstream of `frames`
// when the gateway has finished body-decoding (spec §9.2–§9.6). Every row
// is 1:1 with a `frames` row via `frame_id` (UNIQUE), so a frame can have
// at most one decoded report. The frame remains the source of truth for
// raw evidence; these tables hold the typed projection used by the API
// and dashboards.
//
// Indexing strategy: every report table is queried two ways:
//   1. "latest report for device X"  → (device_id, device_ts DESC)
//   2. "all reports across fleet in time window" → (received_at DESC)

import {
  bigint,
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { devicesTable } from "./devices";
import { framesTable } from "./frames";

// Common columns shared by every report. Returned from a factory so each
// table gets a fresh column instance (Drizzle does not support sharing
// column objects across tables).
function reportCommonColumns() {
  return {
    id: uuid("id").primaryKey().defaultRandom(),
    frameId: uuid("frame_id")
      .notNull()
      .unique()
      .references(() => framesTable.id, { onDelete: "cascade" }),
    deviceId: text("device_id")
      .notNull()
      .references(() => devicesTable.id),

    // From the RUV/RUS common header (spec §9.1). `eventIndex` and
    // `protocolId` are absent on RGP / RUS-without-event; left nullable
    // to keep the same shape across all report tables.
    eventIndex: integer("event_index"),
    protocolId: text("protocol_id"),
    deviceTs: timestamp("device_ts", { withTimezone: true }),

    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    // Verbatim body for downstream debugging / replay. Avoids forcing a
    // join back to `frames` for the common "show me the raw" UI.
    rawBody: text("raw_body").notNull(),
  };
}

// ---------------------------------------------------------------------------
// RGP — Login / handshake (spec §9.2). Carries first GPS fix + DI mask.
// ---------------------------------------------------------------------------

export const reportsRgpTable = pgTable(
  "reports_rgp",
  {
    ...reportCommonColumns(),

    // GPS block (lat/lon stored as decimal degrees, parser-decoded).
    lat: doublePrecision("lat"),
    lon: doublePrecision("lon"),
    speedKmh: smallint("speed_kmh"),
    headingDeg: smallint("heading_deg"),
    gpsStatus: smallint("gps_status"),
    secondsSinceFix: smallint("seconds_since_fix"),
    hdop: smallint("hdop"),

    // Digital input bitmask (spec §9.8). We persist the raw byte AND the
    // two high-value derived bits (ignition, mainPower) so dashboards
    // don't need bit-twiddling. IN0–IN3 callers can derive from `diRaw`.
    diRaw: smallint("di_raw"),
    ignition: boolean("ignition"),
    mainPower: boolean("main_power"),
  },
  (t) => [
    index("reports_rgp_device_ts_idx").on(t.deviceId, t.deviceTs.desc()),
    index("reports_rgp_received_idx").on(t.receivedAt.desc()),
  ],
);

export const insertReportRgpSchema = createInsertSchema(reportsRgpTable).omit({
  id: true,
});
export type InsertReportRgp = z.infer<typeof insertReportRgpSchema>;
export type ReportRgp = typeof reportsRgpTable.$inferSelect;

// ---------------------------------------------------------------------------
// RUV00 — Presentation / Installation (spec §9.3). One-time, low-volume.
// ---------------------------------------------------------------------------

export const reportsRuv00Table = pgTable(
  "reports_ruv00",
  {
    ...reportCommonColumns(),

    backupBatteryV: doublePrecision("backup_battery_v"),
    mainSupplyV: doublePrecision("main_supply_v"),
    serial: text("serial"),
    firmware: text("firmware"),
    board: text("board"),
    script: text("script"),
    peripheral: text("peripheral"),
    rainSpeedFlag: smallint("rain_speed_flag"),
    hourmeterSource: smallint("hourmeter_source"),
    sharpEventSource: smallint("sharp_event_source"),
    iccid: text("iccid"),
  },
  (t) => [
    index("reports_ruv00_device_ts_idx").on(t.deviceId, t.deviceTs.desc()),
    index("reports_ruv00_received_idx").on(t.receivedAt.desc()),
  ],
);

export const insertReportRuv00Schema = createInsertSchema(
  reportsRuv00Table,
).omit({ id: true });
export type InsertReportRuv00 = z.infer<typeof insertReportRuv00Schema>;
export type ReportRuv00 = typeof reportsRuv00Table.$inferSelect;

// ---------------------------------------------------------------------------
// RUV01 — Workhorse basic data (spec §9.4). Highest-volume table; carries
// GPS, voltages, CAN snapshot, driver ID. Most dashboard queries land here.
// ---------------------------------------------------------------------------

export const reportsRuv01Table = pgTable(
  "reports_ruv01",
  {
    ...reportCommonColumns(),

    // GPS block (same shape as RGP).
    lat: doublePrecision("lat"),
    lon: doublePrecision("lon"),
    speedKmh: smallint("speed_kmh"),
    headingDeg: smallint("heading_deg"),
    gpsStatus: smallint("gps_status"),
    secondsSinceFix: smallint("seconds_since_fix"),
    hdop: smallint("hdop"),
    diRaw: smallint("di_raw"),
    ignition: boolean("ignition"),
    mainPower: boolean("main_power"),

    // Power
    backupBatteryV: doublePrecision("backup_battery_v"),
    mainSupplyV: doublePrecision("main_supply_v"),

    // Violations (populated only on events 105/107/110, spec §9.4)
    maxSpeedViolation: integer("max_speed_violation"),
    maxRpmViolation: integer("max_rpm_violation"),

    // CAN / engine snapshot. Lifetime-cumulative counters (hourmeter,
    // odometer) MUST be bigint — spec §9.4 sample shows `2222222222` for
    // odometer which exceeds int4 max (`2147483647`); a fleet vehicle can
    // realistically pass that over its life. `mode: "number"` keeps app
    // ergonomics — values stay well below 2^53 even at extreme lifetimes
    // (2^53 minutes ≈ 17M years).
    hourmeterMin: bigint("hourmeter_min", { mode: "number" }),
    odometerM: bigint("odometer_m", { mode: "number" }),
    rpm: integer("rpm"),
    engineTempC: smallint("engine_temp_c"),
    oilPressureKpa: integer("oil_pressure_kpa"),
    fuelPct: smallint("fuel_pct"),

    rainSpeedFlag: smallint("rain_speed_flag"),
    online: boolean("online"),
    network: text("network"),
    driverId: text("driver_id"),
  },
  (t) => [
    index("reports_ruv01_device_ts_idx").on(t.deviceId, t.deviceTs.desc()),
    index("reports_ruv01_received_idx").on(t.receivedAt.desc()),
    index("reports_ruv01_driver_idx").on(t.driverId),
  ],
);

export const insertReportRuv01Schema = createInsertSchema(
  reportsRuv01Table,
).omit({ id: true });
export type InsertReportRuv01 = z.infer<typeof insertReportRuv01Schema>;
export type ReportRuv01 = typeof reportsRuv01Table.$inferSelect;

// ---------------------------------------------------------------------------
// RUV02 — End of trip summary (spec §9.5). Triggered by event 108. No GPS.
// ---------------------------------------------------------------------------

export const reportsRuv02Table = pgTable(
  "reports_ruv02",
  {
    ...reportCommonColumns(),

    // RPM range timings — five buckets defined per spec §11.2.
    rpmRange1Sec: integer("rpm_range_1_sec"),
    rpmRange2Sec: integer("rpm_range_2_sec"),
    rpmRange3Sec: integer("rpm_range_3_sec"),
    rpmRange4Sec: integer("rpm_range_4_sec"),
    rpmRange5Sec: integer("rpm_range_5_sec"),

    inertialSec: integer("inertial_sec"),
    engineBrakingSec: integer("engine_braking_sec"),
    coastingSec: integer("coasting_sec"),

    travelTimeMin: integer("travel_time_min"),
    // Distance is per-trip and typically fits int4, but we use bigint to
    // future-proof against very long ferrying trips and to match the
    // RUV01/RUV03 odometer choice for cross-table query consistency.
    distanceM: bigint("distance_m", { mode: "number" }),
    fuelConsumedDecilitres: bigint("fuel_consumed_decilitres", {
      mode: "number",
    }),
  },
  (t) => [
    index("reports_ruv02_device_ts_idx").on(t.deviceId, t.deviceTs.desc()),
    index("reports_ruv02_received_idx").on(t.receivedAt.desc()),
  ],
);

export const insertReportRuv02Schema = createInsertSchema(
  reportsRuv02Table,
).omit({ id: true });
export type InsertReportRuv02 = z.infer<typeof insertReportRuv02Schema>;
export type ReportRuv02 = typeof reportsRuv02Table.$inferSelect;

// ---------------------------------------------------------------------------
// RUV03 — CAN telemetry (spec §9.6). Events 150–153. No GPS in this report.
// ---------------------------------------------------------------------------

export const reportsRuv03Table = pgTable(
  "reports_ruv03",
  {
    ...reportCommonColumns(),

    acceleratorPct: smallint("accelerator_pct"),
    // Same reasoning as RUV01: lifetime-cumulative counters → bigint.
    hourmeterMin: bigint("hourmeter_min", { mode: "number" }),
    odometerM: bigint("odometer_m", { mode: "number" }),
    rpm: integer("rpm"),
    engineTempC: smallint("engine_temp_c"),
    enginePressureKpa: integer("engine_pressure_kpa"),
    fuelPct: smallint("fuel_pct"),
    cumulativeFuelDecilitres: bigint("cumulative_fuel_decilitres", {
      mode: "number",
    }),

    speedKmh: smallint("speed_kmh"),
    engineTorquePct: smallint("engine_torque_pct"),
    engineBrakePct: smallint("engine_brake_pct"),

    cruiseControl: boolean("cruise_control"),
    clutch: boolean("clutch"),
    parkingBrake: boolean("parking_brake"),
    serviceBrake: boolean("service_brake"),
  },
  (t) => [
    index("reports_ruv03_device_ts_idx").on(t.deviceId, t.deviceTs.desc()),
    index("reports_ruv03_received_idx").on(t.receivedAt.desc()),
  ],
);

export const insertReportRuv03Schema = createInsertSchema(
  reportsRuv03Table,
).omit({ id: true });
export type InsertReportRuv03 = z.infer<typeof insertReportRuv03Schema>;
export type ReportRuv03 = typeof reportsRuv03Table.$inferSelect;
