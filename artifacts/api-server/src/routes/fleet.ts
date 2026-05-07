import { Router, type IRouter, type Request, type Response } from "express";
import { and, desc, eq, lt, type SQL } from "drizzle-orm";

import { db, packetsTable } from "@workspace/db";
import { ListFleetRecentPacketsQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// GET /fleet/recent-packets
//
// Cross-device feed for the ops console. Uses the `packets_received_at_idx`
// (or the `parse_status_idx` when filtering) so the query stays cheap even
// at millions of rows.
// ---------------------------------------------------------------------------

router.get("/fleet/recent-packets", async (req: Request, res: Response) => {
  const query = ListFleetRecentPacketsQueryParams.parse(req.query);

  const conds: SQL[] = [];
  if (query.parseStatus) {
    conds.push(eq(packetsTable.parseStatus, query.parseStatus));
  }
  if (query.before) {
    conds.push(lt(packetsTable.receivedAt, query.before));
  }

  const rows = await db
    .select()
    .from(packetsTable)
    .where(conds.length > 0 ? and(...conds) : undefined)
    // Tiebreak on `id` for deterministic ordering when two packets share a
     // `received_at`. See devices.ts for the full reasoning.
    .orderBy(desc(packetsTable.receivedAt), desc(packetsTable.id))
    .limit(query.limit);
  res.json(rows);
});

export default router;
