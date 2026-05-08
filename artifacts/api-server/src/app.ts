import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router, { authRouter } from "./routes";
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

// Auth routes (login) are mounted BEFORE the auth middleware so the
// login endpoint itself is unauthenticated.
app.use("/api", authRouter);

// Auth gate — validates JWT or static API_READ_TOKEN.
app.use("/api", authMiddleware);
app.use("/api", router);

// Error handler must come after routes so it catches anything they throw.
app.use(errorHandler);

export default app;
