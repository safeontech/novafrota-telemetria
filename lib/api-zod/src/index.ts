// Re-export Orval-generated outputs.
//
// `./generated/api`   — Zod schemas + per-endpoint constants (runtime values).
// `./generated/types` — Pure TypeScript interfaces and type aliases.
//
// `<Operation>Params` is emitted in BOTH files when an endpoint has path
// AND query parameters. We resolve the collision by skipping the TS-side
// `*Params` types in this barrel — handlers derive their query/path types
// via `z.infer<typeof ListXxxQueryParams>` against the zod schemas in
// `./generated/api`, which is the canonical input-validation surface.
export * from "./generated/api";
export type {
  HealthStatus,
  Device,
  DeviceModel,
  Transport,
  Direction,
  ParseStatus,
  ErrorResponse,
  NotFoundResponse,
  Packet,
  ReportCommon,
  ReportRgp,
  ReportRuv00,
  ReportRuv01,
  ReportRuv02,
  ReportRuv03,
  // Reusable parameter component types
  BeforeParameter,
  DeviceModelFilterParameter,
  LimitParameter,
  ParseStatusFilterParameter,
} from "./generated/types";
