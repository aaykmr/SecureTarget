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
  singleton = db;
  return db;
}
