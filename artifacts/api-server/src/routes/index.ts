import { Router, type IRouter } from "express";
import healthRouter from "./health";
import devicesRouter from "./devices";
import fleetRouter from "./fleet";

const router: IRouter = Router();

router.use(healthRouter);
router.use(devicesRouter);
router.use(fleetRouter);

export default router;

// Auth router is exported separately so app.ts can mount it
// BEFORE the auth middleware (login must be unauthenticated).
export { default as authRouter } from "./auth";
