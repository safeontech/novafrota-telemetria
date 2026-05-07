import { Router, type IRouter, type Request, type Response } from "express";
import { and, desc, eq, lt, type SQL } from "drizzle-orm";

import {
  db,
  devicesTable,
  packetsTable,
  reportsRgpTable,
  reportsRuv00Table,
  reportsRuv01Table,
  reportsRuv02Table,
  reportsRuv03Table,
} from "@workspace/db";

import {
  GetDeviceParams,
  ListDevicesQueryParams,
  ListDevicePacketsParams,
  ListDevicePacketsQueryParams,
  ListDeviceReportsRgpParams,
  ListDeviceReportsRgpQueryParams,
  ListDeviceReportsRuv00Params,
  ListDeviceReportsRuv00QueryParams,
  ListDeviceReportsRuv01Params,
  ListDeviceReportsRuv01QueryParams,
  ListDeviceReportsRuv02Params,
  ListDeviceReportsRuv02QueryParams,
  ListDeviceReportsRuv03Params,
  ListDeviceReportsRuv03QueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function notFound(res: Response, what: string, id: string) {
  res.status(404).json({
    error: "not_found",
    message: `${what} '${id}' not found`,
  });
}

async function deviceExists(id: string): Promise<boolean> {
  const rows = await db
    .select({ id: devicesTable.id })
    .from(devicesTable)
    .where(eq(devicesTable.id, id))
    .limit(1);
  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// GET /devices
// ---------------------------------------------------------------------------

router.get("/devices", async (req: Request, res: Response) => {
  const query = ListDevicesQueryParams.parse(req.query);
  const where = query.model ? eq(devicesTable.model, query.model) : undefined;
  const rows = await db
    .select()
    .from(devicesTable)
    .where(where)
    .orderBy(desc(devicesTable.lastSeenAt));
  res.json(rows);
});

// ---------------------------------------------------------------------------
// GET /devices/:id
// ---------------------------------------------------------------------------

router.get("/devices/:id", async (req: Request, res: Response) => {
  const { id } = GetDeviceParams.parse(req.params);
  const rows = await db
    .select()
    .from(devicesTable)
    .where(eq(devicesTable.id, id))
    .limit(1);
  if (rows.length === 0) {
    notFound(res, "device", id);
    return;
  }
  res.json(rows[0]);
});

// ---------------------------------------------------------------------------
// GET /devices/:id/packets
// ---------------------------------------------------------------------------

router.get("/devices/:id/packets", async (req: Request, res: Response) => {
  const { id } = ListDevicePacketsParams.parse(req.params);
  const query = ListDevicePacketsQueryParams.parse(req.query);

  if (!(await deviceExists(id))) {
    notFound(res, "device", id);
    return;
  }

  const conds: SQL[] = [eq(packetsTable.deviceId, id)];
  if (query.parseStatus) {
    conds.push(eq(packetsTable.parseStatus, query.parseStatus));
  }
  if (query.before) {
    conds.push(lt(packetsTable.receivedAt, query.before));
  }

  const rows = await db
    .select()
    .from(packetsTable)
    .where(and(...conds))
    // Tiebreak on `id` so two packets sharing a `received_at` (gateway can
     // batch-insert microseconds apart, see M3 race tests) get a deterministic
     // order. The `before` cursor is still timestamp-only, so identical-ts
     // rows at a page boundary may still skip — acceptable for now; flagged
     // in KNOWN_ISSUES if it ever bites.
    .orderBy(desc(packetsTable.receivedAt), desc(packetsTable.id))
    .limit(query.limit);
  res.json(rows);
});

// ---------------------------------------------------------------------------
// Per-opcode report list — five sibling endpoints, one per opcode (RGP,
// RUV00..RUV03). Each report table has different decoded columns so we
// can't share a single Drizzle query (Drizzle's column types carry the
// `tableName` literal — structural reuse fights the typing). The shape
// below is repeated five times intentionally; the alternative (cast-heavy
// factory) trades type safety for ~50 lines and isn't worth it.
//
// Pagination contract is identical for every variant: `limit` (default 50,
// max 200, validated by the QueryParams zod schemas) and `before` (ISO
// timestamp cursor against `received_at`).
// ---------------------------------------------------------------------------

router.get("/devices/:id/reports/rgp", async (req: Request, res: Response) => {
  const { id } = ListDeviceReportsRgpParams.parse(req.params);
  const query = ListDeviceReportsRgpQueryParams.parse(req.query);

  if (!(await deviceExists(id))) {
    notFound(res, "device", id);
    return;
  }

  const conds: SQL[] = [eq(reportsRgpTable.deviceId, id)];
  if (query.before) conds.push(lt(reportsRgpTable.receivedAt, query.before));

  const rows = await db
    .select()
    .from(reportsRgpTable)
    .where(and(...conds))
    .orderBy(desc(reportsRgpTable.receivedAt), desc(reportsRgpTable.id))
    .limit(query.limit);
  res.json(rows);
});

router.get(
  "/devices/:id/reports/ruv00",
  async (req: Request, res: Response) => {
    const { id } = ListDeviceReportsRuv00Params.parse(req.params);
    const query = ListDeviceReportsRuv00QueryParams.parse(req.query);

    if (!(await deviceExists(id))) {
      notFound(res, "device", id);
      return;
    }

    const conds: SQL[] = [eq(reportsRuv00Table.deviceId, id)];
    if (query.before)
      conds.push(lt(reportsRuv00Table.receivedAt, query.before));

    const rows = await db
      .select()
      .from(reportsRuv00Table)
      .where(and(...conds))
      .orderBy(desc(reportsRuv00Table.receivedAt), desc(reportsRuv00Table.id))
      .limit(query.limit);
    res.json(rows);
  },
);

router.get(
  "/devices/:id/reports/ruv01",
  async (req: Request, res: Response) => {
    const { id } = ListDeviceReportsRuv01Params.parse(req.params);
    const query = ListDeviceReportsRuv01QueryParams.parse(req.query);

    if (!(await deviceExists(id))) {
      notFound(res, "device", id);
      return;
    }

    const conds: SQL[] = [eq(reportsRuv01Table.deviceId, id)];
    if (query.before)
      conds.push(lt(reportsRuv01Table.receivedAt, query.before));

    const rows = await db
      .select()
      .from(reportsRuv01Table)
      .where(and(...conds))
      .orderBy(desc(reportsRuv01Table.receivedAt), desc(reportsRuv01Table.id))
      .limit(query.limit);
    res.json(rows);
  },
);

router.get(
  "/devices/:id/reports/ruv02",
  async (req: Request, res: Response) => {
    const { id } = ListDeviceReportsRuv02Params.parse(req.params);
    const query = ListDeviceReportsRuv02QueryParams.parse(req.query);

    if (!(await deviceExists(id))) {
      notFound(res, "device", id);
      return;
    }

    const conds: SQL[] = [eq(reportsRuv02Table.deviceId, id)];
    if (query.before)
      conds.push(lt(reportsRuv02Table.receivedAt, query.before));

    const rows = await db
      .select()
      .from(reportsRuv02Table)
      .where(and(...conds))
      .orderBy(desc(reportsRuv02Table.receivedAt), desc(reportsRuv02Table.id))
      .limit(query.limit);
    res.json(rows);
  },
);

router.get(
  "/devices/:id/reports/ruv03",
  async (req: Request, res: Response) => {
    const { id } = ListDeviceReportsRuv03Params.parse(req.params);
    const query = ListDeviceReportsRuv03QueryParams.parse(req.query);

    if (!(await deviceExists(id))) {
      notFound(res, "device", id);
      return;
    }

    const conds: SQL[] = [eq(reportsRuv03Table.deviceId, id)];
    if (query.before)
      conds.push(lt(reportsRuv03Table.receivedAt, query.before));

    const rows = await db
      .select()
      .from(reportsRuv03Table)
      .where(and(...conds))
      .orderBy(desc(reportsRuv03Table.receivedAt), desc(reportsRuv03Table.id))
      .limit(query.limit);
    res.json(rows);
  },
);

export default router;
