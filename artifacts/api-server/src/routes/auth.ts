import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

router.post("/auth/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({
      error: "invalid_request",
      message: "Email and password are required.",
    });
    return;
  }

  let user: typeof usersTable.$inferSelect | undefined;
  try {
    const rows = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase().trim()))
      .limit(1);
    user = rows[0];
  } catch (err) {
    logger.error({ err }, "DB error during login");
    res.status(500).json({ error: "server_error", message: "Database error." });
    return;
  }

  if (!user) {
    res.status(401).json({
      error: "unauthorized",
      message: "Invalid email or password.",
    });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({
      error: "unauthorized",
      message: "Invalid email or password.",
    });
    return;
  }

  const secret = process.env["SESSION_SECRET"];
  if (!secret) {
    logger.error("SESSION_SECRET is not set — cannot issue JWT");
    res.status(500).json({
      error: "server_misconfigured",
      message: "Auth service is not configured.",
    });
    return;
  }

  const token = jwt.sign(
    { sub: user.id, email: user.email },
    secret,
    { expiresIn: "7d" },
  );

  res.json({ token });
});

export default router;
