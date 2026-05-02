import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const schemaPath = resolve(__dirname, "schema.sql");

/** Drops legacy device columns from client_sessions (DBs created before privacy-first session rows). */
function migrateClientSessionsPrivacy(db: Database.Database): void {
  const cols = db.prepare(`PRAGMA table_info(client_sessions)`).all() as { name: string }[];
  if (cols.length === 0) return;
  const names = new Set(cols.map((c) => c.name));
  if (!names.has("device_details_json")) return;

  db.exec(`
    CREATE TABLE client_sessions_migrated (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      revoked_at TEXT
    );
    INSERT INTO client_sessions_migrated (id, company_id, created_at, last_seen_at, revoked_at)
      SELECT id, company_id, created_at, last_seen_at, revoked_at FROM client_sessions;
    DROP TABLE client_sessions;
    ALTER TABLE client_sessions_migrated RENAME TO client_sessions;
    CREATE INDEX IF NOT EXISTS idx_client_sessions_company ON client_sessions(company_id);
    CREATE INDEX IF NOT EXISTS idx_client_sessions_last_seen ON client_sessions(company_id, last_seen_at DESC);
  `);
}

export function createDb(dbPath = "securetarget.sqlite"): Database.Database {
  const db = new Database(dbPath);
  const schemaSql = readFileSync(schemaPath, "utf8");
  db.exec(schemaSql);
  migrateClientSessionsPrivacy(db);
  return db;
}
