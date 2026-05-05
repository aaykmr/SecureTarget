import type { Database } from "better-sqlite3";
import crypto from "node:crypto";
import {
  apiKeyPepperFingerprint,
  generateApiKey,
  hashApiKey,
  isCashfreeSubscriptionStatusActive,
} from "@securetarget/shared";
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

export interface SdkEventRow {
  id: string;
  company_id: string;
  event_type: string;
  token_hash: string | null;
  payload_json: string;
  created_at: string;
}

/** Filters for `sdk_events` list/count. `actionType` is the stored ingest discriminant (`event_type` column). */
export type SdkEventsFilter = {
  tokenHash?: string | null;
  actionType?: string | null;
  /** Substring match (case-insensitive) on `conversionName` or `eventType` in `payload_json`. */
  eventLabel?: string | null;
};

function likeContainsPattern(term: string): string {
  const esc = term.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
  return `%${esc}%`;
}

function buildSdkEventsWhere(
  companyId: string,
  filter: SdkEventsFilter
): { clause: string; params: unknown[] } {
  const parts: string[] = ["company_id = ?"];
  const params: unknown[] = [companyId];

  if (filter.tokenHash) {
    parts.push("token_hash = ?");
    params.push(filter.tokenHash);
  }

  const action = filter.actionType?.trim();
  if (action) {
    parts.push("event_type = ?");
    params.push(action);
  }

  const label = filter.eventLabel?.trim();
  if (label) {
    const pat = likeContainsPattern(label);
    parts.push(
      `(LOWER(COALESCE(json_extract(payload_json, '$.conversionName'), '')) LIKE LOWER(?) ESCAPE '\\'
        OR LOWER(COALESCE(json_extract(payload_json, '$.eventType'), '')) LIKE LOWER(?) ESCAPE '\\')`
    );
    params.push(pat, pat);
  }

  return { clause: parts.join(" AND "), params };
}

export function countSdkEventsForCompany(db: Database, companyId: string, filter: SdkEventsFilter = {}): number {
  const { clause, params } = buildSdkEventsWhere(companyId, filter);
  const row = db.prepare(`SELECT COUNT(*) AS c FROM sdk_events WHERE ${clause}`).get(...params) as { c: number };
  return Number(row.c);
}

export function listSdkEventsForCompany(
  db: Database,
  companyId: string,
  opts: SdkEventsFilter & { limit: number; offset: number }
): SdkEventRow[] {
  const { limit, offset, ...filter } = opts;
  const { clause, params } = buildSdkEventsWhere(companyId, filter);
  return db
    .prepare(
      `SELECT id, company_id, event_type, token_hash, payload_json, created_at
       FROM sdk_events
       WHERE ${clause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset) as SdkEventRow[];
}

export interface BillingSubscriptionRow {
  user_id: string;
  merchant_subscription_id: string;
  cf_subscription_id: string | null;
  status: string;
  customer_email: string | null;
  updated_at: string;
}

export function getBillingSubscription(db: Database, userId: string): BillingSubscriptionRow | undefined {
  return db.prepare(`SELECT * FROM billing_subscriptions WHERE user_id = ?`).get(userId) as
    | BillingSubscriptionRow
    | undefined;
}

export function getBillingByMerchantSubscriptionId(
  db: Database,
  merchantSubscriptionId: string,
): BillingSubscriptionRow | undefined {
  return db
    .prepare(`SELECT * FROM billing_subscriptions WHERE merchant_subscription_id = ?`)
    .get(merchantSubscriptionId) as BillingSubscriptionRow | undefined;
}

/** Start or restart a Cashfree checkout for this user (replaces merchant_subscription_id). */
export function upsertBillingCheckoutSession(
  db: Database,
  userId: string,
  merchantSubscriptionId: string,
  customerEmail: string,
): void {
  db.prepare(
    `INSERT INTO billing_subscriptions (user_id, merchant_subscription_id, status, customer_email, updated_at)
     VALUES (?, ?, 'INITIALIZED', ?, datetime('now'))
     ON CONFLICT(user_id) DO UPDATE SET
       merchant_subscription_id = excluded.merchant_subscription_id,
       status = 'INITIALIZED',
       customer_email = excluded.customer_email,
       cf_subscription_id = NULL,
       updated_at = datetime('now')`,
  ).run(userId, merchantSubscriptionId, customerEmail);
}

export function updateBillingSubscriptionFields(
  db: Database,
  merchantSubscriptionId: string,
  fields: { cf_subscription_id?: string | null; status: string; customer_email?: string | null },
): string | null {
  const row = getBillingByMerchantSubscriptionId(db, merchantSubscriptionId);
  if (!row) return null;
  const cf = fields.cf_subscription_id !== undefined ? fields.cf_subscription_id : row.cf_subscription_id;
  const em = fields.customer_email !== undefined ? fields.customer_email : row.customer_email;
  db.prepare(
    `UPDATE billing_subscriptions
     SET cf_subscription_id = ?, status = ?, customer_email = ?, updated_at = datetime('now')
     WHERE merchant_subscription_id = ?`,
  ).run(cf, fields.status, em, merchantSubscriptionId);
  return row.user_id;
}

export function userBillingAllowsProductUsage(db: Database, userId: string): boolean {
  const row = getBillingSubscription(db, userId);
  if (!row) return false;
  return isCashfreeSubscriptionStatusActive(row.status);
}

export function revokeAllApiKeysForUser(db: Database, userId: string): number {
  const res = db
    .prepare(
      `UPDATE api_keys SET revoked_at = datetime('now')
       WHERE revoked_at IS NULL
         AND project_id IN (SELECT id FROM projects WHERE user_id = ?)`,
    )
    .run(userId);
  return res.changes;
}
