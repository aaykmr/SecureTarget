import type pg from "pg";
import { hashToken, tokenSaltForCompany } from "@eventiqn/shared";

export type SdkEventRow = {
  id: string;
  company_id: string;
  event_type: string;
  token_hash: string | null;
  payload_json: string;
  created_at: string;
};

export type SdkEventsFilter = {
  tokenHash?: string | null;
  actionType?: string | null;
  eventLabel?: string | null;
};

export type CampaignSummaryRow = {
  media_source: string | null;
  campaign_id: string | null;
  adgroup_id: string | null;
  creative_id: string | null;
  installs: number;
  conversions: number;
  revenue: number;
  cost: number;
};

export type InstallAttributionRow = {
  attribution_id: string;
  install_event_id: string;
  attributed_at: string;
  confidence: number;
  match_rule: string | null;
  is_organic: boolean | null;
  media_source: string | null;
  campaign_id: string | null;
  adgroup_id: string | null;
  creative_id: string | null;
};

export type SkanPostbackRow = {
  id: string;
  campaign_id: string | null;
  media_source: string | null;
  conversion_value: number | null;
  postback_sequence: number | null;
  received_at: string;
};

export function tokenHashForLookup(companyId: string, token: string): string {
  const salt = tokenSaltForCompany(companyId);
  return hashToken(token, salt);
}

function likePattern(term: string): string {
  const esc = term.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
  return `%${esc}%`;
}

function buildSdkEventsWhere(
  companyId: string,
  filter: SdkEventsFilter,
  startIdx = 1,
): { clause: string; params: unknown[] } {
  const parts: string[] = [`company_id = $${startIdx}`];
  const params: unknown[] = [companyId];
  let i = startIdx + 1;

  if (filter.tokenHash) {
    parts.push(`token_hash = $${i++}`);
    params.push(filter.tokenHash);
  }

  const action = filter.actionType?.trim();
  if (action) {
    parts.push(`event_type = $${i++}`);
    params.push(action);
  }

  const label = filter.eventLabel?.trim();
  if (label) {
    const pat = likePattern(label);
    parts.push(
      `(LOWER(COALESCE(payload_json::json->>'conversionName', '')) LIKE LOWER($${i}) ESCAPE '\\'
        OR LOWER(COALESCE(payload_json::json->>'eventType', '')) LIKE LOWER($${i + 1}) ESCAPE '\\')`,
    );
    params.push(pat, pat);
    i += 2;
  }

  return { clause: parts.join(" AND "), params };
}

export async function countSdkEvents(
  db: pg.Pool,
  companyId: string,
  filter: SdkEventsFilter = {},
): Promise<number> {
  const { clause, params } = buildSdkEventsWhere(companyId, filter);
  const { rows } = await db.query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM sdk_events WHERE ${clause}`, params);
  return Number(rows[0]?.c ?? 0);
}

export async function listSdkEvents(
  db: pg.Pool,
  companyId: string,
  opts: SdkEventsFilter & { limit: number; offset: number },
): Promise<SdkEventRow[]> {
  const { limit, offset, ...filter } = opts;
  const { clause, params } = buildSdkEventsWhere(companyId, filter);
  const limitIdx = params.length + 1;
  const offsetIdx = params.length + 2;
  const { rows } = await db.query<SdkEventRow>(
    `SELECT id, company_id, event_type, token_hash, payload_json, created_at::text
     FROM sdk_events
     WHERE ${clause}
     ORDER BY created_at DESC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    [...params, limit, offset],
  );
  return rows;
}

export async function campaignSummary(
  db: pg.Pool,
  companyId: string,
  fromDate?: string,
  toDate?: string,
): Promise<CampaignSummaryRow[]> {
  const params: unknown[] = [companyId];
  let dateFilter = "";
  if (fromDate) {
    params.push(fromDate);
    dateFilter += ` AND ae.attributed_at >= $${params.length}`;
  }
  if (toDate) {
    params.push(toDate);
    dateFilter += ` AND ae.attributed_at <= $${params.length}`;
  }

  const { rows } = await db.query<CampaignSummaryRow>(
    `SELECT
       ce.media_source,
       ce.campaign_id,
       ce.adgroup_id,
       ce.creative_id,
       COALESCE(SUM(CASE WHEN se.event_type = 'install' THEN 1 ELSE 0 END), 0)::int AS installs,
       COALESCE(SUM(CASE WHEN se.event_type = 'conversion' THEN 1 ELSE 0 END), 0)::int AS conversions,
       COALESCE(SUM(CASE WHEN se.event_type = 'conversion'
         THEN COALESCE((se.payload_json::json->>'value')::numeric, 0) ELSE 0 END), 0)::float AS revenue,
       COALESCE(SUM(COALESCE(ce.cost_value, 0)), 0)::float AS cost
     FROM attribution_events ae
     JOIN click_events ce ON ce.id = ae.click_event_id
     LEFT JOIN sdk_events se ON se.id = ae.conversion_event_id
     WHERE ae.company_id = $1${dateFilter}
     GROUP BY ce.media_source, ce.campaign_id, ce.adgroup_id, ce.creative_id
     ORDER BY installs DESC`,
    params,
  );
  return rows;
}

export async function organicVsNonOrganic(
  db: pg.Pool,
  companyId: string,
): Promise<{ organic: number; non_organic: number }> {
  const { rows } = await db.query<{ organic: string; non_organic: string }>(
    `SELECT
       COALESCE(SUM(CASE WHEN COALESCE(ae.is_organic, false) = true THEN 1 ELSE 0 END), 0)::text AS organic,
       COALESCE(SUM(CASE WHEN COALESCE(ae.is_organic, false) = false AND ae.click_event_id IS NOT NULL THEN 1 ELSE 0 END), 0)::text AS non_organic
     FROM attribution_events ae
     JOIN sdk_events se ON se.id = ae.conversion_event_id AND se.event_type = 'install'
     WHERE ae.company_id = $1`,
    [companyId],
  );
  return {
    organic: Number(rows[0]?.organic ?? 0),
    non_organic: Number(rows[0]?.non_organic ?? 0),
  };
}

export async function listInstallAttributions(
  db: pg.Pool,
  companyId: string,
  limit = 50,
): Promise<InstallAttributionRow[]> {
  const { rows } = await db.query<InstallAttributionRow>(
    `SELECT
       ae.id AS attribution_id,
       ae.conversion_event_id AS install_event_id,
       ae.attributed_at::text,
       ae.confidence,
       ae.match_rule,
       ae.is_organic,
       ce.media_source,
       ce.campaign_id,
       ce.adgroup_id,
       ce.creative_id
     FROM attribution_events ae
     LEFT JOIN click_events ce ON ce.id = ae.click_event_id
     WHERE ae.company_id = $1
       AND EXISTS (SELECT 1 FROM sdk_events se WHERE se.id = ae.conversion_event_id AND se.event_type = 'install')
     ORDER BY ae.attributed_at DESC
     LIMIT $2`,
    [companyId, limit],
  );
  return rows;
}

export async function listSkanPostbacks(
  db: pg.Pool,
  companyId: string,
  limit = 50,
): Promise<SkanPostbackRow[]> {
  const { rows } = await db.query<SkanPostbackRow>(
    `SELECT id, campaign_id, media_source, conversion_value, postback_sequence, received_at::text
     FROM skan_postbacks
     WHERE company_id = $1
     ORDER BY received_at DESC
     LIMIT $2`,
    [companyId, limit],
  );
  return rows;
}
