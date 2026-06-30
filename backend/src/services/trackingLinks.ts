import crypto from "node:crypto";
import type { Database } from "better-sqlite3";

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

export function getTrackingLinkBySlug(db: Database, companyId: string, slug: string): TrackingLinkRow | undefined {
  return db
    .prepare(`SELECT * FROM tracking_links WHERE company_id = ? AND slug = ?`)
    .get(companyId, slug) as TrackingLinkRow | undefined;
}

export function getTrackingLinkBySlugGlobal(db: Database, slug: string): TrackingLinkRow | undefined {
  return db.prepare(`SELECT * FROM tracking_links WHERE slug = ? LIMIT 1`).get(slug) as TrackingLinkRow | undefined;
}

export function listTrackingLinks(db: Database, companyId: string): TrackingLinkRow[] {
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
    defaultParams?: Record<string, unknown>;
  }
): TrackingLinkRow {
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO tracking_links
      (id, company_id, name, slug, destination_type, ios_url, android_url, web_url, default_params_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.companyId,
    input.name,
    input.slug,
    input.destinationType,
    input.iosUrl ?? null,
    input.androidUrl ?? null,
    input.webUrl ?? null,
    input.defaultParams ? JSON.stringify(input.defaultParams) : null
  );
  return db.prepare(`SELECT * FROM tracking_links WHERE id = ?`).get(id) as TrackingLinkRow;
}

export function deleteTrackingLink(db: Database, companyId: string, linkId: string): boolean {
  const res = db.prepare(`DELETE FROM tracking_links WHERE id = ? AND company_id = ?`).run(linkId, companyId);
  return res.changes > 0;
}

/** Parse AppsFlyer-compatible and st_* query params into normalized campaign fields. */
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
  partnerPostbackUrl: null
};

export function getAttributionSettings(db: Database, companyId: string): AttributionSettings {
  const row = db
    .prepare(`SELECT * FROM project_attribution_settings WHERE company_id = ?`)
    .get(companyId) as Record<string, unknown> | undefined;
  if (!row) return { ...DEFAULT_SETTINGS };
  return {
    installAttributionWindowHours: (row.install_attribution_window_hours as number) ?? 24,
    conversionAttributionWindowHours: (row.conversion_attribution_window_hours as number) ?? 168,
    reengagementWindowHours: (row.reengagement_window_hours as number) ?? 168,
    enableProbabilisticMatching: Boolean(row.enable_probabilistic_matching ?? 1),
    probabilisticMinConfidence: (row.probabilistic_min_confidence as number) ?? 0.7,
    iosAppId: (row.ios_app_id as string) ?? null,
    androidPackage: (row.android_package as string) ?? null,
    iosTeamId: (row.ios_team_id as string) ?? null,
    androidSha256Certs: row.android_sha256_certs_json
      ? (JSON.parse(row.android_sha256_certs_json as string) as string[])
      : [],
    associatedDomain: (row.associated_domain as string) ?? null,
    skanIds: row.skan_ids_json ? (JSON.parse(row.skan_ids_json as string) as string[]) : [],
    partnerPostbackUrl: (row.partner_postback_url as string) ?? null
  };
}

export function upsertAttributionSettings(
  db: Database,
  companyId: string,
  settings: Partial<AttributionSettings>
): void {
  const current = getAttributionSettings(db, companyId);
  const merged = { ...current, ...settings };
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
       updated_at = datetime('now')`
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
    merged.partnerPostbackUrl
  );
}
