import { readdir, readFile } from "node:fs/promises";
import pg from "pg";
import { resolve } from "node:path";

const { Pool } = pg;
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
  max: 1,
  connectionTimeoutMillis: 15000
});
const client = await pool.connect();

try {
  await client.query("SELECT pg_advisory_lock(20261110)");
  await client.query("CREATE SCHEMA IF NOT EXISTS devora");
  await client.query(`
    CREATE TABLE IF NOT EXISTS devora.schema_migrations (
      version VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const directory = resolve("db/migrations");
  const files = (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort();
  for (const file of files) {
    const applied = await client.query(
      "SELECT 1 FROM devora.schema_migrations WHERE version = $1",
      [file]
    );
    if (applied.rowCount) continue;

    const sql = await readFile(resolve(directory, file), "utf8");
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO devora.schema_migrations(version) VALUES ($1)", [file]);
      await client.query("COMMIT");
      console.log(`Applied migration: ${file}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
  console.log("DEVORA database migrations are up to date.");
} catch (error) {
  console.error("DEVORA migration failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  try { await client.query("SELECT pg_advisory_unlock(20261110)"); } catch {}
  client.release();
  await pool.end();
}
