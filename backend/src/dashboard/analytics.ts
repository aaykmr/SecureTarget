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
  channel: string | null;
  clicks: number;
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
  // Base the summary on click_events so web campaigns (clicks without app installs)
  // are represented too, then LEFT JOIN attributed installs/conversions.
  const clickParams: unknown[] = [companyId];
  let clickDateFilter = "";
  if (fromDate) {
    clickParams.push(fromDate);
    clickDateFilter += ` AND clicked_at >= $${clickParams.length}`;
  }
  if (toDate) {
    clickParams.push(toDate);
    clickDateFilter += ` AND clicked_at <= $${clickParams.length}`;
  }

  const convParams: unknown[] = [companyId];
  let convDateFilter = "";
  if (fromDate) {
    convParams.push(fromDate);
    convDateFilter += ` AND ae.attributed_at >= $${convParams.length}`;
  }
  if (toDate) {
    convParams.push(toDate);
    convDateFilter += ` AND ae.attributed_at <= $${convParams.length}`;
  }

  const params = [...clickParams, ...convParams];
  // Conversion CTE params are offset by the number of click params.
  const convClause = convDateFilter.replace(/\$(\d+)/g, (_, n) => `$${Number(n) + clickParams.length}`);

  const { rows } = await db.query<CampaignSummaryRow>(
    `WITH clicks AS (
       SELECT
         media_source, campaign_id, adgroup_id, creative_id, channel,
         COUNT(*)::int AS clicks,
         COALESCE(SUM(COALESCE(cost_value, 0)), 0)::float AS cost
       FROM click_events
       WHERE company_id = $1${clickDateFilter}
       GROUP BY media_source, campaign_id, adgroup_id, creative_id, channel
     ),
     conversions AS (
       SELECT
         ce.media_source, ce.campaign_id, ce.adgroup_id, ce.creative_id, ce.channel,
         COALESCE(SUM(CASE WHEN se.event_type = 'install' THEN 1 ELSE 0 END), 0)::int AS installs,
         COALESCE(SUM(CASE WHEN se.event_type = 'conversion' THEN 1 ELSE 0 END), 0)::int AS conversions,
         COALESCE(SUM(CASE WHEN se.event_type = 'conversion'
           THEN COALESCE((se.payload_json::json->>'value')::numeric, 0) ELSE 0 END), 0)::float AS revenue
       FROM attribution_events ae
       JOIN click_events ce ON ce.id = ae.click_event_id
       LEFT JOIN sdk_events se ON se.id = ae.conversion_event_id
       WHERE ae.company_id = $${clickParams.length + 1}${convClause}
       GROUP BY ce.media_source, ce.campaign_id, ce.adgroup_id, ce.creative_id, ce.channel
     )
     SELECT
       COALESCE(c.media_source, v.media_source) AS media_source,
       COALESCE(c.campaign_id, v.campaign_id) AS campaign_id,
       COALESCE(c.adgroup_id, v.adgroup_id) AS adgroup_id,
       COALESCE(c.creative_id, v.creative_id) AS creative_id,
       COALESCE(c.channel, v.channel) AS channel,
       COALESCE(c.clicks, 0)::int AS clicks,
       COALESCE(v.installs, 0)::int AS installs,
       COALESCE(v.conversions, 0)::int AS conversions,
       COALESCE(v.revenue, 0)::float AS revenue,
       COALESCE(c.cost, 0)::float AS cost
     FROM clicks c
     FULL OUTER JOIN conversions v
       ON c.media_source IS NOT DISTINCT FROM v.media_source
      AND c.campaign_id IS NOT DISTINCT FROM v.campaign_id
      AND c.adgroup_id IS NOT DISTINCT FROM v.adgroup_id
      AND c.creative_id IS NOT DISTINCT FROM v.creative_id
      AND c.channel IS NOT DISTINCT FROM v.channel
     ORDER BY installs DESC, clicks DESC`,
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
