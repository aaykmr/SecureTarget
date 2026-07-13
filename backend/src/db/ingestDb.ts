import type { Database } from "better-sqlite3";
import type pg from "pg";
import { createDb } from "./client.js";
import { createDeviceDb } from "./deviceClient.js";
import { getPostgresPool, initPostgresSchema } from "./postgres.js";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");

function resolveDbPath(configured: string): string {
  if (configured === ":memory:") return configured;
  if (isAbsolute(configured)) return configured;
  return resolve(repoRoot, configured);
}

export type IngestStore =
  | { mode: "postgres"; pool: pg.Pool }
  | { mode: "sqlite"; customer: Database; device: Database };

export class IngestDb {
  private constructor(readonly store: IngestStore) {}

  get mode(): IngestStore["mode"] {
    return this.store.mode;
  }

  pool(): pg.Pool | null {
    return this.store.mode === "postgres" ? this.store.pool : null;
  }

  customerSqlite(): Database {
    if (this.store.mode !== "sqlite") {
      throw new Error("customerSqlite() only available in sqlite mode");
    }
    return this.store.customer;
  }

  deviceSqlite(): Database {
    if (this.store.mode !== "sqlite") {
      throw new Error("deviceSqlite() only available in sqlite mode");
    }
    return this.store.device;
  }

  /** Customer DB handle — sqlite Database or postgres pool. */
  customer(): Database | pg.Pool {
    return this.store.mode === "postgres" ? this.store.pool : this.store.customer;
  }

  /** Device DB handle — sqlite Database or postgres pool (same pool in postgres mode). */
  device(): Database | pg.Pool {
    return this.store.mode === "postgres" ? this.store.pool : this.store.device;
  }

  static async open(): Promise<IngestDb> {
    const databaseUrl = process.env.DATABASE_URL?.trim();
    if (databaseUrl) {
      const pool = getPostgresPool();
      await initPostgresSchema();
      return new IngestDb({ mode: "postgres", pool });
    }
    const dbPath = resolveDbPath(process.env.SECURETARGET_DB_PATH ?? "securetarget.sqlite");
    const deviceDbPath = resolveDbPath(process.env.SECURETARGET_DEVICE_DB_PATH ?? "securetarget-device.sqlite");
    return new IngestDb({
      mode: "sqlite",
      customer: createDb(dbPath),
      device: createDeviceDb(deviceDbPath),
    });
  }

  /** In-memory sqlite for unit tests. */
  static sqliteMemory(): IngestDb {
    return new IngestDb({
      mode: "sqlite",
      customer: createDb(":memory:"),
      device: createDeviceDb(":memory:"),
    });
  }
}

export function isPgConn(conn: Database | pg.Pool): conn is pg.Pool {
  return typeof (conn as pg.Pool).query === "function";
}

export async function pgQuery<T extends Record<string, unknown>>(
  pool: pg.Pool,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const { rows } = await pool.query<T>(sql, params);
  return rows;
}

export async function pgQueryOne<T extends Record<string, unknown>>(
  pool: pg.Pool,
  sql: string,
  params: unknown[] = [],
): Promise<T | undefined> {
  const rows = await pgQuery<T>(pool, sql, params);
  return rows[0];
}

export async function pgExecute(pool: pg.Pool, sql: string, params: unknown[] = []): Promise<void> {
  await pool.query(sql, params);
}
