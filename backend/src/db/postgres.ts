import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { migrateOrganizationsSchema } from "./migrateOrganizations.js";
import { migrateTrackingLinksSchema } from "./migrateTrackingLinks.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

let pool: pg.Pool | null = null;

export function getPostgresPool(): pg.Pool {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error("DATABASE_URL is required for Postgres (production dashboard API)");
  }
  if (!pool) {
    pool = new pg.Pool({ connectionString: url });
  }
  return pool;
}

export async function initPostgresSchema(): Promise<void> {
  const sql = readFileSync(resolve(__dirname, "postgres-schema.sql"), "utf8");
  const db = getPostgresPool();
  // Apply CREATE TABLE IF NOT EXISTS first (fresh installs), then run ALTERs for
  // existing production DBs. Indexes that depend on added columns live in the migration.
  await db.query(sql);
  await migrateOrganizationsSchema(db);
  await migrateTrackingLinksSchema(db);
}

export async function closePostgresPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
