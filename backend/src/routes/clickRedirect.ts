import crypto from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Database } from "better-sqlite3";
import type pg from "pg";
import {
  getTrackingLinkBySlugGlobal,
  parseCampaignParams,
  parseLinkConfig,
  type CampaignParams,
  type TrackingLinkRow,
} from "../services/trackingLinks.js";
import { isPgConn, pgExecute } from "../db/ingestDb.js";

export interface PendingClickRow {
  click_id: string;
  company_id: string;
  link_id: string | null;
  media_source: string | null;
  campaign_id: string | null;
  adgroup_id: string | null;
  creative_id: string | null;
  channel: string | null;
  deep_link_value: string | null;
  ip: string | null;
  user_agent: string | null;
  platform_hint: string | null;
  clicked_at: string;
  expires_at: string;
  matched_identity_id: string | null;
  matched_at: string | null;
  gaid: string | null;
  idfa: string | null;
  metadata_json: string | null;
}

function clientIp(req: IncomingMessage): string | null {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0]?.trim() ?? null;
  }
  return req.socket.remoteAddress ?? null;
}

function detectPlatformHint(userAgent: string | null): string | null {
  if (!userAgent) return null;
  const ua = userAgent.toLowerCase();
  if (ua.includes("iphone") || ua.includes("ipad")) return "ios";
  if (ua.includes("android")) return "android";
  return "web";
}

export async function insertPendingClick(
  deviceDb: Database | pg.Pool,
  input: {
    companyId: string;
    linkId?: string | null;
    params: CampaignParams;
    ip?: string | null;
    userAgent?: string | null;
    expiresAt: string;
    metadata?: Record<string, unknown>;
    platformHint?: string | null;
  }
): Promise<string> {
  const clickId = input.params.clickId ?? crypto.randomUUID();
  const now = new Date().toISOString();
  const platformHint = input.platformHint ?? detectPlatformHint(input.userAgent ?? null);
  if (isPgConn(deviceDb)) {
    await pgExecute(
      deviceDb,
      `INSERT INTO pending_clicks
        (click_id, company_id, link_id, media_source, campaign_id, adgroup_id, creative_id,
         channel, deep_link_value, ip, user_agent, platform_hint, clicked_at, expires_at, metadata_json)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        clickId,
        input.companyId,
        input.linkId ?? null,
        input.params.mediaSource ?? null,
        input.params.campaignId ?? null,
        input.params.adgroupId ?? null,
        input.params.creativeId ?? null,
        input.params.channel ?? null,
        input.params.deepLinkValue ?? null,
        input.ip ?? null,
        input.userAgent ?? null,
        platformHint,
        now,
        input.expiresAt,
        input.metadata ? JSON.stringify(input.metadata) : null,
      ],
    );
    return clickId;
  }
  deviceDb
    .prepare(
      `INSERT INTO pending_clicks
        (click_id, company_id, link_id, media_source, campaign_id, adgroup_id, creative_id,
         channel, deep_link_value, ip, user_agent, platform_hint, clicked_at, expires_at, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      clickId,
      input.companyId,
      input.linkId ?? null,
      input.params.mediaSource ?? null,
      input.params.campaignId ?? null,
      input.params.adgroupId ?? null,
      input.params.creativeId ?? null,
      input.params.channel ?? null,
      input.params.deepLinkValue ?? null,
      input.ip ?? null,
      input.userAgent ?? null,
      platformHint,
      now,
      input.expiresAt,
      input.metadata ? JSON.stringify(input.metadata) : null
    );
  return clickId;
}

export function getPendingClickById(deviceDb: Database, clickId: string): PendingClickRow | undefined {
  return deviceDb.prepare(`SELECT * FROM pending_clicks WHERE click_id = ?`).get(clickId) as
    | PendingClickRow
    | undefined;
}

export async function markPendingClickMatched(
  deviceDb: Database | pg.Pool,
  clickId: string,
  identityId: string,
): Promise<void> {
  if (isPgConn(deviceDb)) {
    await pgExecute(
      deviceDb,
      `UPDATE pending_clicks SET matched_identity_id = $1, matched_at = NOW() WHERE click_id = $2`,
      [identityId, clickId],
    );
    return;
  }
  deviceDb
    .prepare(
      `UPDATE pending_clicks SET matched_identity_id = ?, matched_at = datetime('now') WHERE click_id = ?`
    )
    .run(identityId, clickId);
}

function buildRedirectUrl(
  baseUrl: string,
  clickId: string,
  params: CampaignParams,
  deepLinkValue?: string | null
): string {
  const url = new URL(baseUrl);
  url.searchParams.set("st_click_id", clickId);
  if (params.mediaSource) url.searchParams.set("pid", params.mediaSource);
  if (params.campaignId) url.searchParams.set("c", params.campaignId);
  if (params.adgroupId) url.searchParams.set("adset", params.adgroupId);
  if (params.creativeId) url.searchParams.set("ad", params.creativeId);
  if (deepLinkValue) url.searchParams.set("deep_link_value", deepLinkValue);
  return url.toString();
}

function buildPlayStoreUrl(androidUrl: string, referrer: string): string {
  const url = new URL(androidUrl);
  url.searchParams.set("referrer", referrer);
  return url.toString();
}

function resolveDestination(
  link: TrackingLinkRow,
  clickId: string,
  params: CampaignParams,
  userAgent: string | null,
): string | null {
  const config = parseLinkConfig(link.config_json);
  const linkType = link.link_type;
  const platformHint = linkType === "ctv" ? "ctv" : detectPlatformHint(userAgent);
  const deepLink =
    params.deepLinkValue || config.defaultDeepLinkValue || null;

  // Hyperlink / short_link / referral / vta-as-click: web only
  if (linkType === "hyperlink" || linkType === "short_link" || linkType === "vta") {
    const web = link.web_url || config.destinationUrl;
    return web ? buildRedirectUrl(web, clickId, params, deepLink) : null;
  }

  if (linkType === "referral") {
    const web = link.web_url || config.destinationUrl || link.ios_url || link.android_url;
    return web ? buildRedirectUrl(web, clickId, params, deepLink) : null;
  }

  if (linkType === "ctv") {
    const dest = link.web_url || config.destinationUrl || link.ios_url || link.android_url;
    return dest ? buildRedirectUrl(dest, clickId, params, deepLink) : null;
  }

  // one_link, deeplink, cta: UA-based multi destination
  if (platformHint === "ios" && link.ios_url) {
    return buildRedirectUrl(link.ios_url, clickId, params, deepLink);
  }
  if (platformHint === "android" && link.android_url) {
    const referrer = encodeURIComponent(
      `st_click_id=${clickId}${params.mediaSource ? `&pid=${params.mediaSource}` : ""}${params.campaignId ? `&c=${params.campaignId}` : ""}`,
    );
    return buildPlayStoreUrl(link.android_url, referrer);
  }
  if (link.web_url) {
    return buildRedirectUrl(link.web_url, clickId, params, deepLink);
  }
  if (link.ios_url) {
    return buildRedirectUrl(link.ios_url, clickId, params, deepLink);
  }
  if (link.android_url) {
    const referrer = encodeURIComponent(`st_click_id=${clickId}`);
    return buildPlayStoreUrl(link.android_url, referrer);
  }
  if (config.destinationUrl) {
    return buildRedirectUrl(config.destinationUrl, clickId, params, deepLink);
  }
  return null;
}

export async function handleClickRedirect(
  req: IncomingMessage,
  res: ServerResponse,
  customerDb: Database | pg.Pool,
  deviceDb: Database | pg.Pool,
  slug: string,
): Promise<void> {
  const link = await getTrackingLinkBySlugGlobal(customerDb, slug);
  if (!link) {
    res.statusCode = 404;
    res.end("Link not found");
    return;
  }

  // VTA links prefer impression pixel; clicks still allowed for testing
  const rawUrl = req.url ?? "";
  const qIdx = rawUrl.indexOf("?");
  const queryString = qIdx === -1 ? "" : rawUrl.slice(qIdx + 1);
  const query = new URLSearchParams(queryString);
  const params = parseCampaignParams(query);
  const config = parseLinkConfig(link.config_json);

  if (link.default_params_json) {
    const defaults = JSON.parse(link.default_params_json) as Record<string, string>;
    if (!params.mediaSource && defaults.mediaSource) params.mediaSource = defaults.mediaSource;
    if (!params.campaignId && defaults.campaignId) params.campaignId = defaults.campaignId;
    if (!params.adgroupId && defaults.adgroupId) params.adgroupId = defaults.adgroupId;
    if (!params.creativeId && defaults.creativeId) params.creativeId = defaults.creativeId;
    if (!params.channel && defaults.channel) params.channel = defaults.channel;
    if (!params.deepLinkValue && defaults.deepLinkValue) params.deepLinkValue = defaults.deepLinkValue;
  }
  if (!params.deepLinkValue && config.defaultDeepLinkValue) {
    params.deepLinkValue = config.defaultDeepLinkValue;
  }

  const refCode = query.get("ref") ?? query.get("referrer") ?? config.referrerCode ?? undefined;
  if (link.link_type === "referral" && refCode && !params.channel) {
    params.channel = "referral";
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  const ip = clientIp(req);
  const userAgent = typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null;
  const platformHint = link.link_type === "ctv" ? "ctv" : detectPlatformHint(userAgent);

  const clickId = await insertPendingClick(deviceDb, {
    companyId: link.company_id,
    linkId: link.id,
    params,
    ip,
    userAgent,
    expiresAt,
    platformHint,
    metadata: {
      linkType: link.link_type,
      ...(refCode ? { referrerCode: refCode } : {}),
    },
  });

  res.setHeader(
    "Set-Cookie",
    `st_click_id=${clickId}; Path=/; Max-Age=${7 * 24 * 3600}; SameSite=Lax`
  );

  const destination = resolveDestination(link, clickId, params, userAgent);

  if (!destination) {
    res.statusCode = 400;
    res.end("No destination configured for this link");
    return;
  }

  res.statusCode = 302;
  res.setHeader("Location", destination);
  res.end();
}

/** Extract click_id from install referrer string or URL. */
export function extractClickIdFromReferrer(referrer: string): string | null {
  try {
    if (referrer.includes("st_click_id=")) {
      const params = new URLSearchParams(referrer.includes("?") ? referrer.split("?")[1] : referrer);
      const id = params.get("st_click_id");
      if (id) return id;
    }
    const decoded = decodeURIComponent(referrer);
    const match = decoded.match(/st_click_id=([a-f0-9-]{36})/i);
    return match?.[1] ?? null;
  } catch {
    const match = referrer.match(/st_click_id=([a-f0-9-]{36})/i);
    return match?.[1] ?? null;
  }
}

export function extractClickIdFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    return u.searchParams.get("st_click_id");
  } catch {
    return null;
  }
}
