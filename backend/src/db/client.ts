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

function addColumnIfMissing(db: Database.Database, table: string, column: string, definition: string): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (cols.some((c) => c.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

function migrateAttributionExtensions(db: Database.Database): void {
  addColumnIfMissing(db, "click_events", "event_source_partner", "TEXT");
  addColumnIfMissing(db, "click_events", "media_source", "TEXT");
  addColumnIfMissing(db, "click_events", "cost_model", "TEXT");
  addColumnIfMissing(db, "click_events", "cost_value", "REAL");
  addColumnIfMissing(db, "click_events", "cost_currency", "TEXT");
  addColumnIfMissing(db, "attribution_events", "reengagement_window_hours", "INTEGER");
  addColumnIfMissing(db, "attribution_events", "match_rule", "TEXT");
  addColumnIfMissing(db, "attribution_events", "is_organic", "INTEGER");
}

function migrateInstallAttributionTables(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tracking_links (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      destination_type TEXT NOT NULL DEFAULT 'web',
      ios_url TEXT,
      android_url TEXT,
      web_url TEXT,
      default_params_json TEXT,
      campaign_presets_json TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_tracking_links_slug ON tracking_links(company_id, slug);
    CREATE TABLE IF NOT EXISTS project_attribution_settings (
      company_id TEXT PRIMARY KEY,
      install_attribution_window_hours INTEGER NOT NULL DEFAULT 24,
      conversion_attribution_window_hours INTEGER NOT NULL DEFAULT 168,
      reengagement_window_hours INTEGER NOT NULL DEFAULT 168,
      enable_probabilistic_matching INTEGER NOT NULL DEFAULT 1,
      probabilistic_min_confidence REAL NOT NULL DEFAULT 0.7,
      ios_app_id TEXT,
      android_package TEXT,
      ios_team_id TEXT,
      android_sha256_certs_json TEXT,
      associated_domain TEXT,
      skan_ids_json TEXT,
      partner_postback_url TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  addColumnIfMissing(db, "tracking_links", "campaign_presets_json", "TEXT");
}

export function createDb(dbPath = "securetarget.sqlite"): Database.Database {
  const db = new Database(dbPath);
  const schemaSql = readFileSync(schemaPath, "utf8");
  db.exec(schemaSql);
  migrateClientSessionsPrivacy(db);
  migrateAttributionExtensions(db);
  migrateInstallAttributionTables(db);
  return db;
}
