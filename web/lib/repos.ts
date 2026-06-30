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

export interface TrackingLinkRow {
  id: string;
  company_id: string;
  name: string;
  slug: string;
  destination_type: string;
  ios_url: string | null;
  android_url: string | null;
  web_url: string | null;
  default_params_json: string | null;
  created_at: string;
}

export function listTrackingLinksForCompany(db: Database, companyId: string): TrackingLinkRow[] {
  return db
    .prepare(`SELECT * FROM tracking_links WHERE company_id = ? ORDER BY created_at DESC`)
    .all(companyId) as TrackingLinkRow[];
}

export function createTrackingLink(
  db: Database,
  input: {
    companyId: string;
    name: string;
    slug: string;
    destinationType: string;
    iosUrl?: string;
    androidUrl?: string;
    webUrl?: string;
  }
): TrackingLinkRow {
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO tracking_links
      (id, company_id, name, slug, destination_type, ios_url, android_url, web_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.companyId,
    input.name,
    input.slug,
    input.destinationType,
    input.iosUrl ?? null,
    input.androidUrl ?? null,
    input.webUrl ?? null
  );
  return db.prepare(`SELECT * FROM tracking_links WHERE id = ?`).get(id) as TrackingLinkRow;
}

export function deleteTrackingLinkForCompany(db: Database, companyId: string, linkId: string): boolean {
  const res = db.prepare(`DELETE FROM tracking_links WHERE id = ? AND company_id = ?`).run(linkId, companyId);
  return res.changes > 0;
}

export interface AttributionSettingsRow {
  company_id: string;
  install_attribution_window_hours: number;
  conversion_attribution_window_hours: number;
  reengagement_window_hours: number;
  enable_probabilistic_matching: number;
  probabilistic_min_confidence: number;
  ios_app_id: string | null;
  android_package: string | null;
  ios_team_id: string | null;
  android_sha256_certs_json: string | null;
  associated_domain: string | null;
  skan_ids_json: string | null;
  partner_postback_url: string | null;
}

export function getAttributionSettingsRow(db: Database, companyId: string): AttributionSettingsRow | undefined {
  return db.prepare(`SELECT * FROM project_attribution_settings WHERE company_id = ?`).get(companyId) as
    | AttributionSettingsRow
    | undefined;
}

export function upsertAttributionSettingsRow(
  db: Database,
  companyId: string,
  fields: Partial<{
    iosAppId: string;
    androidPackage: string;
    iosTeamId: string;
    androidSha256Certs: string[];
    associatedDomain: string;
    skanIds: string[];
    partnerPostbackUrl: string;
    installAttributionWindowHours: number;
    enableProbabilisticMatching: boolean;
  }>
): void {
  const existing = getAttributionSettingsRow(db, companyId);
  db.prepare(
    `INSERT INTO project_attribution_settings
      (company_id, install_attribution_window_hours, conversion_attribution_window_hours,
       reengagement_window_hours, enable_probabilistic_matching, probabilistic_min_confidence,
       ios_app_id, android_package, ios_team_id, android_sha256_certs_json, associated_domain,
       skan_ids_json, partner_postback_url, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(company_id) DO UPDATE SET
       install_attribution_window_hours = COALESCE(?, install_attribution_window_hours),
       enable_probabilistic_matching = COALESCE(?, enable_probabilistic_matching),
       ios_app_id = COALESCE(?, ios_app_id),
       android_package = COALESCE(?, android_package),
       ios_team_id = COALESCE(?, ios_team_id),
       android_sha256_certs_json = COALESCE(?, android_sha256_certs_json),
       associated_domain = COALESCE(?, associated_domain),
       skan_ids_json = COALESCE(?, skan_ids_json),
       partner_postback_url = COALESCE(?, partner_postback_url),
       updated_at = datetime('now')`
  ).run(
    companyId,
    fields.installAttributionWindowHours ?? existing?.install_attribution_window_hours ?? 24,
    existing?.conversion_attribution_window_hours ?? 168,
    existing?.reengagement_window_hours ?? 168,
    fields.enableProbabilisticMatching !== undefined ? (fields.enableProbabilisticMatching ? 1 : 0) : (existing?.enable_probabilistic_matching ?? 1),
    existing?.probabilistic_min_confidence ?? 0.7,
    fields.iosAppId ?? existing?.ios_app_id ?? null,
    fields.androidPackage ?? existing?.android_package ?? null,
    fields.iosTeamId ?? existing?.ios_team_id ?? null,
    fields.androidSha256Certs ? JSON.stringify(fields.androidSha256Certs) : existing?.android_sha256_certs_json ?? null,
    fields.associatedDomain ?? existing?.associated_domain ?? null,
    fields.skanIds ? JSON.stringify(fields.skanIds) : existing?.skan_ids_json ?? null,
    fields.partnerPostbackUrl ?? existing?.partner_postback_url ?? null,
    fields.installAttributionWindowHours ?? null,
    fields.enableProbabilisticMatching !== undefined ? (fields.enableProbabilisticMatching ? 1 : 0) : null,
    fields.iosAppId ?? null,
    fields.androidPackage ?? null,
    fields.iosTeamId ?? null,
    fields.androidSha256Certs ? JSON.stringify(fields.androidSha256Certs) : null,
    fields.associatedDomain ?? null,
    fields.skanIds ? JSON.stringify(fields.skanIds) : null,
    fields.partnerPostbackUrl ?? null
  );
}

export interface CampaignSummaryRow {
  media_source: string | null;
  campaign_id: string | null;
  adgroup_id: string | null;
  creative_id: string | null;
  installs: number;
  conversions: number;
  revenue: number;
  cost: number;
}

export function campaignSummary(
  db: Database,
  companyId: string,
  fromDate?: string,
  toDate?: string
): CampaignSummaryRow[] {
  const params: unknown[] = [companyId];
  let dateFilter = "";
  if (fromDate) {
    dateFilter += " AND ae.attributed_at >= ?";
    params.push(fromDate);
  }
  if (toDate) {
    dateFilter += " AND ae.attributed_at <= ?";
    params.push(toDate);
  }

  return db
    .prepare(
      `SELECT
         ce.media_source,
         ce.campaign_id,
         ce.adgroup_id,
         ce.creative_id,
         SUM(CASE WHEN se.event_type = 'install' THEN 1 ELSE 0 END) AS installs,
         SUM(CASE WHEN se.event_type = 'conversion' THEN 1 ELSE 0 END) AS conversions,
         SUM(CASE WHEN se.event_type = 'conversion' THEN COALESCE(json_extract(se.payload_json, '$.value'), 0) ELSE 0 END) AS revenue,
         SUM(COALESCE(ce.cost_value, 0)) AS cost
       FROM attribution_events ae
       JOIN click_events ce ON ce.id = ae.click_event_id
       LEFT JOIN sdk_events se ON se.id = ae.conversion_event_id OR (
         se.company_id = ae.company_id AND se.event_type IN ('install', 'conversion')
         AND se.id = ae.conversion_event_id
       )
       WHERE ae.company_id = ?${dateFilter}
       GROUP BY ce.media_source, ce.campaign_id, ce.adgroup_id, ce.creative_id
       ORDER BY installs DESC`
    )
    .all(...params) as CampaignSummaryRow[];
}

export interface InstallAttributionRow {
  attribution_id: string;
  install_event_id: string;
  attributed_at: string;
  confidence: number;
  match_rule: string | null;
  is_organic: number | null;
  media_source: string | null;
  campaign_id: string | null;
  adgroup_id: string | null;
  creative_id: string | null;
}

export function listInstallAttributions(db: Database, companyId: string, limit = 50): InstallAttributionRow[] {
  return db
    .prepare(
      `SELECT
         ae.id AS attribution_id,
         ae.conversion_event_id AS install_event_id,
         ae.attributed_at,
         ae.confidence,
         ae.match_rule,
         ae.is_organic,
         ce.media_source,
         ce.campaign_id,
         ce.adgroup_id,
         ce.creative_id
       FROM attribution_events ae
       LEFT JOIN click_events ce ON ce.id = ae.click_event_id
       WHERE ae.company_id = ?
         AND EXISTS (SELECT 1 FROM sdk_events se WHERE se.id = ae.conversion_event_id AND se.event_type = 'install')
       ORDER BY ae.attributed_at DESC
       LIMIT ?`
    )
    .all(companyId, limit) as InstallAttributionRow[];
}

export interface OrganicBreakdown {
  organic: number;
  non_organic: number;
}

export function organicVsNonOrganic(db: Database, companyId: string): OrganicBreakdown {
  const rows = db
    .prepare(
      `SELECT
         SUM(CASE WHEN COALESCE(ae.is_organic, 0) = 1 THEN 1 ELSE 0 END) AS organic,
         SUM(CASE WHEN COALESCE(ae.is_organic, 0) = 0 AND ae.click_event_id IS NOT NULL THEN 1 ELSE 0 END) AS non_organic
       FROM attribution_events ae
       JOIN sdk_events se ON se.id = ae.conversion_event_id AND se.event_type = 'install'
       WHERE ae.company_id = ?`
    )
    .get(companyId) as { organic: number; non_organic: number };
  return { organic: Number(rows?.organic ?? 0), non_organic: Number(rows?.non_organic ?? 0) };
}

export interface SkanPostbackRow {
  id: string;
  campaign_id: string | null;
  media_source: string | null;
  conversion_value: number | null;
  postback_sequence: number | null;
  received_at: string;
}

export function listSkanPostbacks(deviceDb: Database, companyId: string, limit = 50): SkanPostbackRow[] {
  return deviceDb
    .prepare(
      `SELECT id, campaign_id, media_source, conversion_value, postback_sequence, received_at
       FROM skan_postbacks WHERE company_id = ? ORDER BY received_at DESC LIMIT ?`
    )
    .all(companyId, limit) as SkanPostbackRow[];
}

