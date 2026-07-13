import crypto from "node:crypto";
import type { Database } from "better-sqlite3";
import type pg from "pg";
import { isPgConn, pgExecute, pgQuery, pgQueryOne } from "../db/ingestDb.js";

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

export interface CampaignParams {
  mediaSource?: string;
  campaignId?: string;
  adgroupId?: string;
  creativeId?: string;
  channel?: string;
  deepLinkValue?: string;
  clickId?: string;
}

export async function getTrackingLinkBySlug(
  db: Database | pg.Pool,
  companyId: string,
  slug: string,
): Promise<TrackingLinkRow | undefined> {
  if (isPgConn(db)) {
    return pgQueryOne<TrackingLinkRow>(db, `SELECT * FROM tracking_links WHERE company_id = $1 AND slug = $2`, [
      companyId,
      slug,
    ]);
  }
  return db.prepare(`SELECT * FROM tracking_links WHERE company_id = ? AND slug = ?`).get(companyId, slug) as
    | TrackingLinkRow
    | undefined;
}

export async function getTrackingLinkBySlugGlobal(
  db: Database | pg.Pool,
  slug: string,
): Promise<TrackingLinkRow | undefined> {
  if (isPgConn(db)) {
    return pgQueryOne<TrackingLinkRow>(db, `SELECT * FROM tracking_links WHERE slug = $1 LIMIT 1`, [slug]);
  }
  return db.prepare(`SELECT * FROM tracking_links WHERE slug = ? LIMIT 1`).get(slug) as TrackingLinkRow | undefined;
}

export async function listTrackingLinks(db: Database | pg.Pool, companyId: string): Promise<TrackingLinkRow[]> {
  if (isPgConn(db)) {
    return pgQuery<TrackingLinkRow>(
      db,
      `SELECT * FROM tracking_links WHERE company_id = $1 ORDER BY created_at DESC`,
      [companyId],
    );
  }
  return db.prepare(`SELECT * FROM tracking_links WHERE company_id = ? ORDER BY created_at DESC`).all(companyId) as TrackingLinkRow[];
}

export function parseCampaignParams(query: URLSearchParams): CampaignParams {
  const mediaSource =
    query.get("pid") ?? query.get("media_source") ?? query.get("st_media_source") ?? undefined;
  const campaignId = query.get("c") ?? query.get("campaign") ?? query.get("st_campaign") ?? undefined;
  const adgroupId =
    query.get("adset") ?? query.get("af_adset") ?? query.get("st_adgroup") ?? undefined;
  const creativeId = query.get("ad") ?? query.get("af_ad") ?? query.get("st_creative") ?? undefined;
  const channel = query.get("channel") ?? query.get("st_channel") ?? undefined;
  const deepLinkValue =
    query.get("deep_link_value") ?? query.get("st_deep_link_value") ?? undefined;
  const clickId = query.get("st_click_id") ?? undefined;
  return { mediaSource, campaignId, adgroupId, creativeId, channel, deepLinkValue, clickId };
}

export interface AttributionSettings {
  installAttributionWindowHours: number;
  conversionAttributionWindowHours: number;
  reengagementWindowHours: number;
  enableProbabilisticMatching: boolean;
  probabilisticMinConfidence: number;
  iosAppId: string | null;
  androidPackage: string | null;
  iosTeamId: string | null;
  androidSha256Certs: string[];
  associatedDomain: string | null;
  skanIds: string[];
  partnerPostbackUrl: string | null;
}

const DEFAULT_SETTINGS: AttributionSettings = {
  installAttributionWindowHours: 24,
  conversionAttributionWindowHours: 168,
  reengagementWindowHours: 168,
  enableProbabilisticMatching: true,
  probabilisticMinConfidence: 0.7,
  iosAppId: null,
  androidPackage: null,
  iosTeamId: null,
  androidSha256Certs: [],
  associatedDomain: null,
  skanIds: [],
  partnerPostbackUrl: null,
};

function rowToSettings(row: Record<string, unknown>): AttributionSettings {
  return {
    installAttributionWindowHours: (row.install_attribution_window_hours as number) ?? 24,
    conversionAttributionWindowHours: (row.conversion_attribution_window_hours as number) ?? 168,
    reengagementWindowHours: (row.reengagement_window_hours as number) ?? 168,
    enableProbabilisticMatching: Boolean(row.enable_probabilistic_matching ?? true),
    probabilisticMinConfidence: (row.probabilistic_min_confidence as number) ?? 0.7,
    iosAppId: (row.ios_app_id as string) ?? null,
    androidPackage: (row.android_package as string) ?? null,
    iosTeamId: (row.ios_team_id as string) ?? null,
    androidSha256Certs: row.android_sha256_certs_json
      ? (JSON.parse(row.android_sha256_certs_json as string) as string[])
      : [],
    associatedDomain: (row.associated_domain as string) ?? null,
    skanIds: row.skan_ids_json ? (JSON.parse(row.skan_ids_json as string) as string[]) : [],
    partnerPostbackUrl: (row.partner_postback_url as string) ?? null,
  };
}

export async function getAttributionSettings(
  db: Database | pg.Pool,
  companyId: string,
): Promise<AttributionSettings> {
  let row: Record<string, unknown> | undefined;
  if (isPgConn(db)) {
    row = await pgQueryOne<Record<string, unknown>>(
      db,
      `SELECT * FROM project_attribution_settings WHERE company_id = $1`,
      [companyId],
    );
  } else {
    row = db.prepare(`SELECT * FROM project_attribution_settings WHERE company_id = ?`).get(companyId) as
      | Record<string, unknown>
      | undefined;
  }
  if (!row) return { ...DEFAULT_SETTINGS };
  return rowToSettings(row);
}

export async function upsertAttributionSettings(
  db: Database | pg.Pool,
  companyId: string,
  settings: Partial<AttributionSettings>,
): Promise<void> {
  const current = await getAttributionSettings(db, companyId);
  const merged = { ...current, ...settings };
  if (isPgConn(db)) {
    await pgExecute(
      db,
      `INSERT INTO project_attribution_settings
        (company_id, install_attribution_window_hours, conversion_attribution_window_hours,
         reengagement_window_hours, enable_probabilistic_matching, probabilistic_min_confidence,
         ios_app_id, android_package, ios_team_id, android_sha256_certs_json, associated_domain,
         skan_ids_json, partner_postback_url, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
       ON CONFLICT (company_id) DO UPDATE SET
         install_attribution_window_hours = EXCLUDED.install_attribution_window_hours,
         conversion_attribution_window_hours = EXCLUDED.conversion_attribution_window_hours,
         reengagement_window_hours = EXCLUDED.reengagement_window_hours,
         enable_probabilistic_matching = EXCLUDED.enable_probabilistic_matching,
         probabilistic_min_confidence = EXCLUDED.probabilistic_min_confidence,
         ios_app_id = EXCLUDED.ios_app_id,
         android_package = EXCLUDED.android_package,
         ios_team_id = EXCLUDED.ios_team_id,
         android_sha256_certs_json = EXCLUDED.android_sha256_certs_json,
         associated_domain = EXCLUDED.associated_domain,
         skan_ids_json = EXCLUDED.skan_ids_json,
         partner_postback_url = EXCLUDED.partner_postback_url,
         updated_at = NOW()`,
      [
        companyId,
        merged.installAttributionWindowHours,
        merged.conversionAttributionWindowHours,
        merged.reengagementWindowHours,
        merged.enableProbabilisticMatching,
        merged.probabilisticMinConfidence,
        merged.iosAppId,
        merged.androidPackage,
        merged.iosTeamId,
        JSON.stringify(merged.androidSha256Certs),
        merged.associatedDomain,
        JSON.stringify(merged.skanIds),
        merged.partnerPostbackUrl,
      ],
    );
    return;
  }
  db.prepare(
    `INSERT INTO project_attribution_settings
      (company_id, install_attribution_window_hours, conversion_attribution_window_hours,
       reengagement_window_hours, enable_probabilistic_matching, probabilistic_min_confidence,
       ios_app_id, android_package, ios_team_id, android_sha256_certs_json, associated_domain,
       skan_ids_json, partner_postback_url, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(company_id) DO UPDATE SET
       install_attribution_window_hours = excluded.install_attribution_window_hours,
       conversion_attribution_window_hours = excluded.conversion_attribution_window_hours,
       reengagement_window_hours = excluded.reengagement_window_hours,
       enable_probabilistic_matching = excluded.enable_probabilistic_matching,
       probabilistic_min_confidence = excluded.probabilistic_min_confidence,
       ios_app_id = excluded.ios_app_id,
       android_package = excluded.android_package,
       ios_team_id = excluded.ios_team_id,
       android_sha256_certs_json = excluded.android_sha256_certs_json,
       associated_domain = excluded.associated_domain,
       skan_ids_json = excluded.skan_ids_json,
       partner_postback_url = excluded.partner_postback_url,
       updated_at = datetime('now')`,
  ).run(
    companyId,
    merged.installAttributionWindowHours,
    merged.conversionAttributionWindowHours,
    merged.reengagementWindowHours,
    merged.enableProbabilisticMatching ? 1 : 0,
    merged.probabilisticMinConfidence,
    merged.iosAppId,
    merged.androidPackage,
    merged.iosTeamId,
    JSON.stringify(merged.androidSha256Certs),
    merged.associatedDomain,
    JSON.stringify(merged.skanIds),
    merged.partnerPostbackUrl,
  );
}

// Kept for dashboard API migration
export async function createTrackingLink(
  db: Database | pg.Pool,
  input: {
    companyId: string;
    name: string;
    slug: string;
    destinationType: string;
    iosUrl?: string;
    androidUrl?: string;
    webUrl?: string;
    defaultParams?: Record<string, unknown>;
  },
): Promise<TrackingLinkRow> {
  const id = crypto.randomUUID();
  if (isPgConn(db)) {
    await pgExecute(
      db,
      `INSERT INTO tracking_links
        (id, company_id, name, slug, destination_type, ios_url, android_url, web_url, default_params_json)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        id,
        input.companyId,
        input.name,
        input.slug,
        input.destinationType,
        input.iosUrl ?? null,
        input.androidUrl ?? null,
        input.webUrl ?? null,
        input.defaultParams ? JSON.stringify(input.defaultParams) : null,
      ],
    );
    return (await pgQueryOne<TrackingLinkRow>(db, `SELECT * FROM tracking_links WHERE id = $1`, [id]))!;
  }
  db.prepare(
    `INSERT INTO tracking_links
      (id, company_id, name, slug, destination_type, ios_url, android_url, web_url, default_params_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.companyId,
    input.name,
    input.slug,
    input.destinationType,
    input.iosUrl ?? null,
    input.androidUrl ?? null,
    input.webUrl ?? null,
    input.defaultParams ? JSON.stringify(input.defaultParams) : null,
  );
  return db.prepare(`SELECT * FROM tracking_links WHERE id = ?`).get(id) as TrackingLinkRow;
}

export async function deleteTrackingLink(
  db: Database | pg.Pool,
  companyId: string,
  linkId: string,
): Promise<boolean> {
  if (isPgConn(db)) {
    const res = await db.query(`DELETE FROM tracking_links WHERE id = $1 AND company_id = $2`, [linkId, companyId]);
    return (res.rowCount ?? 0) > 0;
  }
  const res = db.prepare(`DELETE FROM tracking_links WHERE id = ? AND company_id = ?`).run(linkId, companyId);
  return res.changes > 0;
}
