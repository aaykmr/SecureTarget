import crypto from "node:crypto";
import type { Database } from "better-sqlite3";
import type pg from "pg";
import { isPgConn, pgExecute, pgQueryOne } from "../db/ingestDb.js";

export async function createClientSession(db: Database | pg.Pool, companyId: string): Promise<string> {
  const id = `sess_${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  if (isPgConn(db)) {
    await pgExecute(db, `INSERT INTO client_sessions (id, company_id, created_at, last_seen_at) VALUES ($1, $2, $3, $4)`, [
      id,
      companyId,
      now,
      now,
    ]);
    return id;
  }
  db.prepare(`INSERT INTO client_sessions (id, company_id, created_at, last_seen_at) VALUES (?, ?, ?, ?)`).run(
    id,
    companyId,
    now,
    now,
  );
  return id;
}

export async function touchClientSession(
  db: Database | pg.Pool,
  companyId: string,
  sessionId: string,
): Promise<boolean> {
  if (isPgConn(db)) {
    const res = await db.query(
      `UPDATE client_sessions SET last_seen_at = NOW() WHERE id = $1 AND company_id = $2 AND revoked_at IS NULL`,
      [sessionId, companyId],
    );
    return (res.rowCount ?? 0) > 0;
  }
  const res = db
    .prepare(
      `UPDATE client_sessions SET last_seen_at = datetime('now') WHERE id = ? AND company_id = ? AND revoked_at IS NULL`,
    )
    .run(sessionId, companyId);
  return res.changes > 0;
}

export async function isClientSessionValid(
  db: Database | pg.Pool,
  companyId: string,
  sessionId: string,
): Promise<boolean> {
  if (isPgConn(db)) {
    const row = await pgQueryOne<{ id: string }>(
      db,
      `SELECT id FROM client_sessions WHERE id = $1 AND company_id = $2 AND revoked_at IS NULL`,
      [sessionId, companyId],
    );
    return Boolean(row);
  }
  const row = db
    .prepare(`SELECT id FROM client_sessions WHERE id = ? AND company_id = ? AND revoked_at IS NULL`)
    .get(sessionId, companyId) as { id: string } | undefined;
  return Boolean(row);
}
