import { timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";

import { logger } from "../lib/logger";

/**
 * Bearer-token gate for the read API.
 *
 * Behavior:
 * - The token is read from `API_READ_TOKEN` on every request (cheap; lets
 *   tests mutate the env without re-importing the app).
 * - When the token is set, every request must carry
 *   `Authorization: Bearer <token>`. Comparison is timing-safe.
 * - When the token is unset:
 *     - In `NODE_ENV === "production"`: every request 500s. We refuse to
 *       silently serve unauthenticated traffic in production. This is a
 *       last-resort safety net — production deploys must set the var.
 *     - Otherwise (dev / test / unset NODE_ENV): all requests pass and we
 *       log a one-shot warning. This keeps `pnpm run dev` and the existing
 *       `node --test` suite working without ceremony.
 * - `GET /api/healthz` is always allowed through so the reverse proxy and
 *   deploy scripts can probe liveness without sharing the token.
 *
 * Error envelope matches the existing `errorHandler` shape:
 *   { error: "<code>", message: "<human readable>" }
 */

let warnedAboutMissingToken = false;

export const authMiddleware: RequestHandler = (req, res, next) => {
  // Healthz is unauthenticated by design — proxies need to probe it.
  if (req.path === "/healthz") {
    next();
    return;
  }

  const expected = process.env["API_READ_TOKEN"];

  if (!expected) {
    if (process.env["NODE_ENV"] === "production") {
      logger.error(
        "API_READ_TOKEN is not set in production; refusing all requests",
      );
      res.status(500).json({
        error: "server_misconfigured",
        message: "API_READ_TOKEN is not configured on this server.",
      });
      return;
    }
    if (!warnedAboutMissingToken) {
      logger.warn(
        "API_READ_TOKEN is not set; the read API is currently OPEN. " +
          "Set API_READ_TOKEN before deploying to a network anyone else can reach.",
      );
      warnedAboutMissingToken = true;
    }
    next();
    return;
  }

  const header = req.header("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) {
    res.status(401).json({
      error: "unauthorized",
      message: "Missing or malformed Authorization header (expected 'Bearer <token>').",
    });
    return;
  }

  const provided = match[1]!.trim();
  const providedBuf = Buffer.from(provided, "utf8");
  const expectedBuf = Buffer.from(expected, "utf8");

  // timingSafeEqual requires equal-length buffers, so length-mismatch is
  // its own short-circuit — but we still do a constant-time compare on
  // dummy buffers so the timing of "wrong length" matches "wrong bytes".
  if (providedBuf.length !== expectedBuf.length) {
    timingSafeEqual(expectedBuf, expectedBuf); // burn the same cycles
    res.status(401).json({
      error: "unauthorized",
      message: "Invalid bearer token.",
    });
    return;
  }
  if (!timingSafeEqual(providedBuf, expectedBuf)) {
    res.status(401).json({
      error: "unauthorized",
      message: "Invalid bearer token.",
    });
    return;
  }

  next();
};
