/**
 * Create a MINHA MÁQUINA platform user.
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run create-user <email> <password>
 */
import bcrypt from "bcryptjs";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { eq } from "drizzle-orm";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("❌  DATABASE_URL is not set.");
  process.exit(1);
}

const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.error("Usage: pnpm --filter @workspace/scripts run create-user <email> <password>");
  process.exit(1);
}

const usersTable = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema: { usersTable } });

const normalised = email.toLowerCase().trim();

const existing = await db
  .select({ id: usersTable.id })
  .from(usersTable)
  .where(eq(usersTable.email, normalised))
  .limit(1);

if (existing.length > 0) {
  console.error(`❌  A user with email "${normalised}" already exists.`);
  await pool.end();
  process.exit(1);
}

const passwordHash = await bcrypt.hash(password, 12);

await db.insert(usersTable).values({
  email: normalised,
  passwordHash,
});

console.log(`✅  User created: ${normalised}`);
await pool.end();
