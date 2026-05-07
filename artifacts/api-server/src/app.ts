import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { authMiddleware } from "./middlewares/auth";
import { errorHandler } from "./middlewares/errors";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Auth gate runs before the routes. The middleware lets `/api/healthz`
// through unconditionally so reverse proxies can probe liveness.
app.use("/api", authMiddleware);
app.use("/api", router);

// Error handler must come after routes so it catches anything they throw.
app.use(errorHandler);

export default app;
