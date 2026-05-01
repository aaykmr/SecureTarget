import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const schemaPath = resolve(__dirname, "schema.sql");

export function createDb(dbPath = "securetarget.sqlite"): Database.Database {
  const db = new Database(dbPath);
  const schemaSql = readFileSync(schemaPath, "utf8");
  db.exec(schemaSql);
  return db;
}
