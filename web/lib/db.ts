import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
/** Monorepo root (SecureTarget/), not process.cwd() — avoids web/ vs backend/ using different DB files. */
const repoRoot = resolve(__dirname, "..", "..");

let singleton: Database.Database | null = null;

function resolveConfiguredDbPath(configured: string): string {
  if (configured === ":memory:") return configured;
  if (isAbsolute(configured)) return configured;
  return resolve(repoRoot, configured);
}

function defaultDbPath(): string {
  if (process.env.SECURETARGET_DB_PATH) {
    return resolveConfiguredDbPath(process.env.SECURETARGET_DB_PATH);
  }
  const fromEnv = process.env.DATABASE_URL?.replace(/^file:/, "");
  if (fromEnv) {
    return resolveConfiguredDbPath(fromEnv);
  }
  return resolve(repoRoot, "securetarget.sqlite");
}

function defaultSchemaPath(): string {
  if (process.env.SECURETARGET_SCHEMA_PATH) {
    return resolve(process.env.SECURETARGET_SCHEMA_PATH);
  }
  return resolve(__dirname, "..", "..", "backend", "src", "db", "schema.sql");
}

export function getDb(): Database.Database {
  if (singleton) return singleton;
  const dbPath = defaultDbPath();
  const schemaPath = defaultSchemaPath();
  const db = new Database(dbPath);
  db.exec(readFileSync(schemaPath, "utf8"));
  migrateInstallAttributionTables(db);
  singleton = db;
  return db;
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
  const cols = db.prepare(`PRAGMA table_info(attribution_events)`).all() as { name: string }[];
  const names = new Set(cols.map((c) => c.name));
  if (!names.has("match_rule")) {
    db.exec(`ALTER TABLE attribution_events ADD COLUMN match_rule TEXT`);
  }
  if (!names.has("is_organic")) {
    db.exec(`ALTER TABLE attribution_events ADD COLUMN is_organic INTEGER`);
  }
  const linkCols = db.prepare(`PRAGMA table_info(tracking_links)`).all() as { name: string }[];
  if (!linkCols.some((c) => c.name === "campaign_presets_json")) {
    db.exec(`ALTER TABLE tracking_links ADD COLUMN campaign_presets_json TEXT`);
  }
}
