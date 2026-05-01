import crypto from "node:crypto";
import type { Database } from "better-sqlite3";

export function createClientSession(db: Database, companyId: string, deviceJson: Record<string, unknown>): string {
  const platform = typeof deviceJson.platform === "string" ? deviceJson.platform : "unknown";
  const id = `sess_${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO client_sessions (id, company_id, device_platform, device_details_json, created_at, last_seen_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, companyId, platform, JSON.stringify(deviceJson), now, now);
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
