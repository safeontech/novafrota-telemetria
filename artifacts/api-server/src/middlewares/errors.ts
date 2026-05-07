import type { ErrorRequestHandler } from "express";
// The Orval-generated zod schemas use the v3 surface (`import * as zod from "zod"`),
// while several other packages in the workspace use `zod/v4`. We match the
// throwing code path here — every validation error coming out of the route
// handlers originates from a generated v3 schema, so we instanceof against v3.
import { ZodError } from "zod";

import { logger } from "../lib/logger";

/**
 * Centralized error handler.
 *
 * - `ZodError` → 400 with field-level details (input validation failure).
 * - Anything else → 500 with a generic message; full error logged server-side.
 *
 * Express 5 forwards both sync throws and rejected async handler promises to
 * this middleware automatically — no `asyncHandler` wrapper needed.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: "validation_error",
      message: "Request input failed validation",
      issues: err.issues,
    });
    return;
  }

  logger.error({ err }, "unhandled error in request handler");
  res.status(500).json({
    error: "internal_error",
    message: "An unexpected error occurred",
  });
};
