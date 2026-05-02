import crypto from "node:crypto";
import type { Database } from "better-sqlite3";

/** Persists only opaque session id + company + timestamps (no device payload). */
export function createClientSession(db: Database, companyId: string): string {
  const id = `sess_${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO client_sessions (id, company_id, created_at, last_seen_at)
     VALUES (?, ?, ?, ?)`
  ).run(id, companyId, now, now);
  return id;
}

export function touchClientSession(db: Database, companyId: string, sessionId: string): boolean {
  const res = db
    .prepare(
      `UPDATE client_sessions SET last_seen_at = datetime('now') WHERE id = ? AND company_id = ? AND revoked_at IS NULL`
    )
    .run(sessionId, companyId);
  return res.changes > 0;
}

export function isClientSessionValid(db: Database, companyId: string, sessionId: string): boolean {
  const row = db
    .prepare(`SELECT id FROM client_sessions WHERE id = ? AND company_id = ? AND revoked_at IS NULL`)
    .get(sessionId, companyId) as { id: string } | undefined;
  return Boolean(row);
}
