import crypto from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Database } from "better-sqlite3";
import type pg from "pg";
import { getTrackingLinkBySlugGlobal, parseCampaignParams, parseLinkConfig } from "../services/trackingLinks.js";
import { isPgConn, pgExecute } from "../db/ingestDb.js";

/** 1×1 transparent GIF */
const PIXEL_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

function clientIp(req: IncomingMessage): string | null {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0]?.trim() ?? null;
  }
  return req.socket.remoteAddress ?? null;
}

export async function insertLinkImpression(
  deviceDb: Database | pg.Pool,
  input: {
    companyId: string;
    linkId?: string | null;
    mediaSource?: string | null;
    campaignId?: string | null;
    adgroupId?: string | null;
    creativeId?: string | null;
    channel?: string | null;
    ip?: string | null;
    userAgent?: string | null;
    expiresAt: string;
    metadata?: Record<string, unknown>;
  },
): Promise<string> {
  const impressionId = crypto.randomUUID();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  if (isPgConn(deviceDb)) {
    await pgExecute(
      deviceDb,
      `INSERT INTO link_impressions
        (id, company_id, link_id, impression_id, media_source, campaign_id, adgroup_id, creative_id,
         channel, ip, user_agent, viewed_at, expires_at, metadata_json)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        id,
        input.companyId,
        input.linkId ?? null,
        impressionId,
        input.mediaSource ?? null,
        input.campaignId ?? null,
        input.adgroupId ?? null,
        input.creativeId ?? null,
        input.channel ?? null,
        input.ip ?? null,
        input.userAgent ?? null,
        now,
        input.expiresAt,
        input.metadata ? JSON.stringify(input.metadata) : null,
      ],
    );
    return impressionId;
  }
  deviceDb
    .prepare(
      `INSERT INTO link_impressions
        (id, company_id, link_id, impression_id, media_source, campaign_id, adgroup_id, creative_id,
         channel, ip, user_agent, viewed_at, expires_at, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      input.companyId,
      input.linkId ?? null,
      impressionId,
      input.mediaSource ?? null,
      input.campaignId ?? null,
      input.adgroupId ?? null,
      input.creativeId ?? null,
      input.channel ?? null,
      input.ip ?? null,
      input.userAgent ?? null,
      now,
      input.expiresAt,
      input.metadata ? JSON.stringify(input.metadata) : null,
    );
  return impressionId;
}

export async function markImpressionMatched(
  deviceDb: Database | pg.Pool,
  impressionId: string,
): Promise<void> {
  if (isPgConn(deviceDb)) {
    await pgExecute(deviceDb, `UPDATE link_impressions SET matched_at = NOW() WHERE impression_id = $1`, [
      impressionId,
    ]);
    return;
  }
  deviceDb
    .prepare(`UPDATE link_impressions SET matched_at = datetime('now') WHERE impression_id = ?`)
    .run(impressionId);
}

export async function handleImpressionPixel(
  req: IncomingMessage,
  res: ServerResponse,
  customerDb: Database | pg.Pool,
  deviceDb: Database | pg.Pool,
  slug: string,
): Promise<void> {
  const link = await getTrackingLinkBySlugGlobal(customerDb, slug);
  if (!link) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "image/gif");
    res.end(PIXEL_GIF);
    return;
  }

  const rawUrl = req.url ?? "";
  const qIdx = rawUrl.indexOf("?");
  const query = new URLSearchParams(qIdx === -1 ? "" : rawUrl.slice(qIdx + 1));
  const params = parseCampaignParams(query);
  const config = parseLinkConfig(link.config_json);

  if (link.default_params_json) {
    const defaults = JSON.parse(link.default_params_json) as Record<string, string>;
    if (!params.mediaSource && defaults.mediaSource) params.mediaSource = defaults.mediaSource;
    if (!params.campaignId && defaults.campaignId) params.campaignId = defaults.campaignId;
    if (!params.adgroupId && defaults.adgroupId) params.adgroupId = defaults.adgroupId;
    if (!params.creativeId && defaults.creativeId) params.creativeId = defaults.creativeId;
    if (!params.channel && defaults.channel) params.channel = defaults.channel;
  }

  const windowHours = config.viewThroughWindowHours ?? 24;
  const expiresAt = new Date(Date.now() + windowHours * 3600 * 1000).toISOString();
  const ip = clientIp(req);
  const userAgent = typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null;

  try {
    await insertLinkImpression(deviceDb, {
      companyId: link.company_id,
      linkId: link.id,
      mediaSource: params.mediaSource,
      campaignId: params.campaignId,
      adgroupId: params.adgroupId,
      creativeId: params.creativeId,
      channel: params.channel ?? "vta",
      ip,
      userAgent,
      expiresAt,
      metadata: { linkType: link.link_type, source: "impression_pixel" },
    });
  } catch {
    /* still return pixel */
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", "image/gif");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.end(PIXEL_GIF);
}
