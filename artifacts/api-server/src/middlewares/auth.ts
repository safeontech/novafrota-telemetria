import { timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { logger } from "../lib/logger";

/**
 * Auth gate for the read API.
 *
 * Accepts either:
 *   1. A JWT signed with SESSION_SECRET — issued by POST /api/auth/login
 *   2. The static API_READ_TOKEN — for programmatic / gateway access
 *
 * Unauthenticated paths:
 *   - GET /api/healthz   — reverse-proxy liveness probe
 *   - POST /api/auth/login — issues the JWT (mounted before this middleware)
 */

const UNPROTECTED = new Set(["/healthz", "/auth/login"]);

let warnedAboutMissingConfig = false;

export const authMiddleware: RequestHandler = (req, res, next) => {
  if (UNPROTECTED.has(req.path)) {
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

  // ── 1. Try JWT (SESSION_SECRET) ──────────────────────────────────────────
  const jwtSecret = process.env["SESSION_SECRET"];
  if (jwtSecret) {
    try {
      jwt.verify(provided, jwtSecret);
      next();
      return;
    } catch {
      // Not a valid JWT — fall through to static token
    }
  }

  // ── 2. Fall back to static API_READ_TOKEN ────────────────────────────────
  const expected = process.env["API_READ_TOKEN"];

  if (!expected) {
    if (process.env["NODE_ENV"] === "production") {
      logger.error("No SESSION_SECRET JWT match and API_READ_TOKEN not set; refusing request");
      res.status(401).json({
        error: "unauthorized",
        message: "Invalid token.",
      });
      return;
    }
    if (!warnedAboutMissingConfig) {
      logger.warn(
        "Neither SESSION_SECRET JWT nor API_READ_TOKEN matched; " +
          "the read API is currently OPEN. Set credentials before deploying.",
      );
      warnedAboutMissingConfig = true;
    }
    next();
    return;
  }

  const providedBuf = Buffer.from(provided, "utf8");
  const expectedBuf = Buffer.from(expected, "utf8");

  if (providedBuf.length !== expectedBuf.length) {
    timingSafeEqual(expectedBuf, expectedBuf);
    res.status(401).json({ error: "unauthorized", message: "Invalid token." });
    return;
  }
  if (!timingSafeEqual(providedBuf, expectedBuf)) {
    res.status(401).json({ error: "unauthorized", message: "Invalid token." });
    return;
  }

  next();
};
