import { readFile } from "node:fs/promises";
import pg from "pg";
import { resolve } from "node:path";

const { Pool } = pg;
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required. Add the Render PostgreSQL connection string before deploying.");
  process.exit(1);
}
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
  max: 1,
  connectionTimeoutMillis: 15000
});
try {
  const sql = await readFile(resolve("db/migrations/001_initial.sql"), "utf8");
  await pool.query("SELECT pg_advisory_lock(20261110)");
  await pool.query(sql);
  console.log("DEVORA database migration completed.");
} catch (error) {
  console.error("DEVORA database migration failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  try { await pool.query("SELECT pg_advisory_unlock(20261110)"); } catch {}
  await pool.end();
}
