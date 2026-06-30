import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..", "..");

let singleton: Database.Database | null = null;

function resolveConfiguredDbPath(configured: string): string {
  if (configured === ":memory:") return configured;
  if (isAbsolute(configured)) return configured;
  return resolve(repoRoot, configured);
}

function defaultDeviceDbPath(): string {
  const configured = process.env.SECURETARGET_DEVICE_DB_PATH ?? "securetarget-device.sqlite";
  return resolveConfiguredDbPath(configured);
}

export function getDeviceDb(): Database.Database {
  if (singleton) return singleton;
  const dbPath = defaultDeviceDbPath();
  const schemaPath = resolve(repoRoot, "backend", "src", "db", "device-schema.sql");
  const db = new Database(dbPath);
  db.exec(readFileSync(schemaPath, "utf8"));
  singleton = db;
  return db;
}
