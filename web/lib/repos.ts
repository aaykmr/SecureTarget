import type { Database } from "better-sqlite3";
import crypto from "node:crypto";
import { apiKeyPepperFingerprint, generateApiKey, hashApiKey } from "@securetarget/shared";
import { getDashboardApiKeyPepper } from "@/lib/apiKeyPepper";

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
}

export function findUserByEmail(db: Database, email: string): UserRow | undefined {
  return db.prepare(`SELECT id, email, password_hash FROM users WHERE email = ?`).get(email.toLowerCase().trim()) as
    | UserRow
    | undefined;
}

export function createUser(db: Database, email: string, passwordHash: string): string {
  const id = crypto.randomUUID();
  db.prepare(`INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)`).run(id, email.toLowerCase().trim(), passwordHash);
  return id;
}

export interface ProjectRow {
  id: string;
  user_id: string;
  name: string;
  company_id: string;
  created_at: string;
}

export function listProjectsForUser(db: Database, userId: string): ProjectRow[] {
  return db.prepare(`SELECT id, user_id, name, company_id, created_at FROM projects WHERE user_id = ? ORDER BY created_at DESC`).all(
    userId
  ) as ProjectRow[];
}

export function createProject(db: Database, userId: string, name: string): ProjectRow {
  const id = crypto.randomUUID();
  const companyId = crypto.randomUUID();
  db.prepare(`INSERT INTO projects (id, user_id, name, company_id) VALUES (?, ?, ?, ?)`).run(id, userId, name, companyId);
  return db.prepare(`SELECT id, user_id, name, company_id, created_at FROM projects WHERE id = ?`).get(id) as ProjectRow;
}

export function getProjectForUser(db: Database, projectId: string, userId: string): ProjectRow | undefined {
  return db
    .prepare(`SELECT id, user_id, name, company_id, created_at FROM projects WHERE id = ? AND user_id = ?`)
    .get(projectId, userId) as ProjectRow | undefined;
}

export interface ApiKeyRow {
  id: string;
  project_id: string;
  key_prefix: string;
  created_at: string;
  revoked_at: string | null;
}

export function listApiKeysForProject(db: Database, projectId: string): ApiKeyRow[] {
  return db
    .prepare(
      `SELECT id, project_id, key_prefix, created_at, revoked_at FROM api_keys WHERE project_id = ? ORDER BY created_at DESC`
    )
    .all(projectId) as ApiKeyRow[];
}

export function createApiKeyForProject(db: Database, projectId: string): { fullKey: string; row: ApiKeyRow } {
  const { fullKey, prefix } = generateApiKey();
  const id = crypto.randomUUID();
  const pepper = getDashboardApiKeyPepper();
  const keyHash = hashApiKey(fullKey, pepper);
  if (process.env.API_KEY_DEBUG === "1" || process.env.API_KEY_DEBUG === "true") {
    const src =
      process.env.API_KEY_PEPPER != null && process.env.API_KEY_PEPPER.trim() !== ""
        ? "API_KEY_PEPPER"
        : process.env.APP_SECRET != null && process.env.APP_SECRET.trim() !== ""
          ? "APP_SECRET"
          : "default-dev-pepper";
    console.log("[web:api-key] hashing new key", {
      pepperSource: src,
      pepperLength: pepper.length,
      pepperFingerprint: apiKeyPepperFingerprint(pepper),
      hashPrefix: `${keyHash.slice(0, 16)}…`
    });
  }
  db.prepare(`INSERT INTO api_keys (id, project_id, key_prefix, key_hash) VALUES (?, ?, ?, ?)`).run(id, projectId, prefix, keyHash);
  const row = db.prepare(`SELECT id, project_id, key_prefix, created_at, revoked_at FROM api_keys WHERE id = ?`).get(id) as ApiKeyRow;
  return { fullKey, row };
}

export function revokeApiKey(db: Database, keyId: string, projectId: string, userId: string): boolean {
  const project = getProjectForUser(db, projectId, userId);
  if (!project) return false;
  const res = db
    .prepare(`UPDATE api_keys SET revoked_at = datetime('now') WHERE id = ? AND project_id = ? AND revoked_at IS NULL`)
    .run(keyId, projectId);
  return res.changes > 0;
}
