import type { Database } from "better-sqlite3";
import type pg from "pg";
import type { PendingClickRow } from "../routes/clickRedirect.js";
import { extractClickIdFromReferrer, extractClickIdFromUrl } from "../routes/clickRedirect.js";
import { getIdentityForSession } from "./deviceIdentity.js";
import { isPgConn, pgQuery, pgQueryOne } from "../db/ingestDb.js";

export interface MatchCandidate {
  clickId?: string;
  clickEventId?: string;
  pendingClick?: PendingClickRow;
  impressionId?: string;
  attributionPath?: "cta" | "vta";
  ruleName: string;
  confidence: number;
  mediaSource?: string | null;
  campaignId?: string | null;
  adgroupId?: string | null;
  creativeId?: string | null;
  channel?: string | null;
  deepLinkValue?: string | null;
  inputs: Record<string, unknown>;
}

export interface MatchInput {
  companyId: string;
  sessionId: string;
  installEventId: string;
  occurredAt: string;
  clickId?: string | null;
  installReferrer?: string | null;
  deepLinkUrl?: string | null;
  enableProbabilistic: boolean;
  minConfidence: number;
  windowHours: number;
  viewThroughWindowHours?: number;
}

export type LinkImpressionRow = {
  id: string;
  company_id: string;
  link_id: string | null;
  impression_id: string;
  media_source: string | null;
  campaign_id: string | null;
  adgroup_id: string | null;
  creative_id: string | null;
  channel: string | null;
  viewed_at: string;
  expires_at: string;
  matched_at: string | null;
  metadata_json: string | null;
};

export async function matchByClickId(
  deviceDb: Database | pg.Pool,
  clickId: string,
): Promise<MatchCandidate | null> {
  let pending: PendingClickRow | undefined;
  if (isPgConn(deviceDb)) {
    pending = await pgQueryOne<PendingClickRow>(
      deviceDb,
      `SELECT * FROM pending_clicks WHERE click_id = $1 AND matched_at IS NULL`,
      [clickId],
    );
  } else {
    pending = deviceDb
      .prepare(`SELECT * FROM pending_clicks WHERE click_id = ? AND matched_at IS NULL`)
      .get(clickId) as PendingClickRow | undefined;
  }
  if (!pending) return null;
  return {
    clickId,
    pendingClick: pending,
    attributionPath: "cta",
    ruleName: "click_id_exact",
    confidence: 1.0,
    mediaSource: pending.media_source,
    campaignId: pending.campaign_id,
    adgroupId: pending.adgroup_id,
    creativeId: pending.creative_id,
    channel: pending.channel,
    deepLinkValue: pending.deep_link_value,
    inputs: { clickId },
  };
}

export async function matchByAdvertisingId(
  deviceDb: Database | pg.Pool,
  companyId: string,
  sessionId: string,
  windowHours: number,
  occurredAt: string,
): Promise<MatchCandidate | null> {
  const identity = await getIdentityForSession(deviceDb, companyId, sessionId);
  if (!identity) return null;
  const lowerBound = new Date(Date.parse(occurredAt) - windowHours * 3600 * 1000).toISOString();

  let pending: PendingClickRow | undefined;
  if (isPgConn(deviceDb)) {
    if (identity.idfa) {
      pending = await pgQueryOne<PendingClickRow>(
        deviceDb,
        `SELECT * FROM pending_clicks
         WHERE company_id = $1 AND idfa = $2 AND matched_at IS NULL AND clicked_at >= $3
         ORDER BY clicked_at DESC LIMIT 1`,
        [companyId, identity.idfa, lowerBound],
      );
    }
    if (!pending && identity.gaid) {
      pending = await pgQueryOne<PendingClickRow>(
        deviceDb,
        `SELECT * FROM pending_clicks
         WHERE company_id = $1 AND gaid = $2 AND matched_at IS NULL AND clicked_at >= $3
         ORDER BY clicked_at DESC LIMIT 1`,
        [companyId, identity.gaid, lowerBound],
      );
    }
    if (!pending) {
      pending = await pgQueryOne<PendingClickRow>(
        deviceDb,
        `SELECT pc.* FROM pending_clicks pc
         JOIN device_identities di ON di.company_id = pc.company_id
         JOIN identity_sessions isess ON isess.identity_id = di.id
         WHERE isess.session_id = $1 AND isess.company_id = $2
           AND pc.matched_at IS NULL AND pc.clicked_at >= $3
           AND (di.idfa IS NOT NULL OR di.gaid IS NOT NULL)
         ORDER BY pc.clicked_at DESC LIMIT 1`,
        [sessionId, companyId, lowerBound],
      );
    }
  } else {
    if (identity.idfa) {
      pending = deviceDb
        .prepare(
          `SELECT * FROM pending_clicks
           WHERE company_id = ? AND idfa = ? AND matched_at IS NULL AND clicked_at >= ?
           ORDER BY clicked_at DESC LIMIT 1`,
        )
        .get(companyId, identity.idfa, lowerBound) as PendingClickRow | undefined;
    }
    if (!pending && identity.gaid) {
      pending = deviceDb
        .prepare(
          `SELECT * FROM pending_clicks
           WHERE company_id = ? AND gaid = ? AND matched_at IS NULL AND clicked_at >= ?
           ORDER BY clicked_at DESC LIMIT 1`,
        )
        .get(companyId, identity.gaid, lowerBound) as PendingClickRow | undefined;
    }
    if (!pending) {
      pending = deviceDb
        .prepare(
          `SELECT pc.* FROM pending_clicks pc
           JOIN device_identities di ON di.company_id = pc.company_id
           JOIN identity_sessions isess ON isess.identity_id = di.id
           WHERE isess.session_id = ? AND isess.company_id = ?
             AND pc.matched_at IS NULL AND pc.clicked_at >= ?
             AND (di.idfa IS NOT NULL OR di.gaid IS NOT NULL)
           ORDER BY pc.clicked_at DESC LIMIT 1`,
        )
        .get(sessionId, companyId, lowerBound) as PendingClickRow | undefined;
    }
  }

  if (!pending) return null;
  return {
    clickId: pending.click_id,
    pendingClick: pending,
    ruleName: "advertising_id",
    confidence: 0.95,
    mediaSource: pending.media_source,
    campaignId: pending.campaign_id,
    adgroupId: pending.adgroup_id,
    creativeId: pending.creative_id,
    channel: pending.channel,
    deepLinkValue: pending.deep_link_value,
    inputs: { idfa: identity.idfa, gaid: identity.gaid },
  };
}

export async function matchBySessionRecord(
  customerDb: Database | pg.Pool,
  companyId: string,
  tokenHash: string,
  windowHours: number,
  occurredAt: string,
): Promise<MatchCandidate | null> {
  const lowerBound = new Date(Date.parse(occurredAt) - windowHours * 3600 * 1000).toISOString();
  type ClickRow = {
    id: string;
    media_source: string | null;
    campaign_id: string | null;
    adgroup_id: string | null;
    creative_id: string | null;
    channel: string | null;
    metadata_json: string | null;
  };
  let click: ClickRow | undefined;
  if (isPgConn(customerDb)) {
    click = await pgQueryOne<ClickRow>(
      customerDb,
      `SELECT id, media_source, campaign_id, adgroup_id, creative_id, channel, metadata_json
       FROM click_events
       WHERE company_id = $1 AND token_hash = $2 AND clicked_at >= $3
       ORDER BY clicked_at DESC LIMIT 1`,
      [companyId, tokenHash, lowerBound],
    );
  } else {
    click = customerDb
      .prepare(
        `SELECT id, media_source, campaign_id, adgroup_id, creative_id, channel, metadata_json
         FROM click_events
         WHERE company_id = ? AND token_hash = ? AND clicked_at >= ?
         ORDER BY clicked_at DESC LIMIT 1`,
      )
      .get(companyId, tokenHash, lowerBound) as ClickRow | undefined;
  }

  if (!click) return null;
  let deepLinkValue: string | null = null;
  try {
    const meta = JSON.parse(click.metadata_json ?? "{}") as Record<string, unknown>;
    if (typeof meta.deepLinkValue === "string") deepLinkValue = meta.deepLinkValue;
  } catch {
    /* ignore */
  }

  return {
    clickEventId: click.id,
    ruleName: "session_record",
    confidence: 0.9,
    mediaSource: click.media_source,
    campaignId: click.campaign_id,
    adgroupId: click.adgroup_id,
    creativeId: click.creative_id,
    channel: click.channel,
    deepLinkValue,
    inputs: { clickEventId: click.id },
  };
}

export async function matchProbabilistic(
  deviceDb: Database | pg.Pool,
  companyId: string,
  sessionId: string,
  windowHours: number,
  occurredAt: string,
  minConfidence: number,
): Promise<MatchCandidate | null> {
  type SnapshotRow = { ip: string | null; userAgent: string | null; platform: string };
  let snapshot: SnapshotRow | undefined;
  if (isPgConn(deviceDb)) {
    snapshot = await pgQueryOne<SnapshotRow>(
      deviceDb,
      `SELECT ds.ip, ds.user_agent AS "userAgent", di.platform
       FROM device_snapshots ds
       JOIN identity_sessions isess ON isess.identity_id = ds.identity_id AND isess.session_id = ds.session_id
       JOIN device_identities di ON di.id = ds.identity_id
       WHERE ds.session_id = $1 AND ds.company_id = $2
       ORDER BY ds.occurred_at DESC LIMIT 1`,
      [sessionId, companyId],
    );
  } else {
    snapshot = deviceDb
      .prepare(
        `SELECT ds.ip, ds.user_agent AS userAgent, di.platform
         FROM device_snapshots ds
         JOIN identity_sessions isess ON isess.identity_id = ds.identity_id AND isess.session_id = ds.session_id
         JOIN device_identities di ON di.id = ds.identity_id
         WHERE ds.session_id = ? AND ds.company_id = ?
         ORDER BY ds.occurred_at DESC LIMIT 1`,
      )
      .get(sessionId, companyId) as SnapshotRow | undefined;
  }

  if (!snapshot?.ip) return null;
  const lowerBound = new Date(Date.parse(occurredAt) - windowHours * 3600 * 1000).toISOString();

  let candidates: PendingClickRow[];
  if (isPgConn(deviceDb)) {
    candidates = await pgQuery<PendingClickRow>(
      deviceDb,
      `SELECT * FROM pending_clicks
       WHERE company_id = $1 AND matched_at IS NULL AND clicked_at >= $2 AND ip = $3
       ORDER BY clicked_at DESC LIMIT 5`,
      [companyId, lowerBound, snapshot.ip],
    );
  } else {
    candidates = deviceDb
      .prepare(
        `SELECT * FROM pending_clicks
         WHERE company_id = ? AND matched_at IS NULL AND clicked_at >= ? AND ip = ?
         ORDER BY clicked_at DESC LIMIT 5`,
      )
      .all(companyId, lowerBound, snapshot.ip) as PendingClickRow[];
  }

  for (const pending of candidates) {
    let confidence = 0.5;
    if (pending.user_agent && snapshot.userAgent && pending.user_agent === snapshot.userAgent) {
      confidence += 0.2;
    }
    if (pending.platform_hint && pending.platform_hint === snapshot.platform) {
      confidence += 0.1;
    }
    const ageMs = Date.parse(occurredAt) - Date.parse(pending.clicked_at);
    if (ageMs < 3600 * 1000) confidence += 0.1;
    if (ageMs < 15 * 60 * 1000) confidence += 0.1;

    if (confidence >= minConfidence) {
      return {
        clickId: pending.click_id,
        pendingClick: pending,
        ruleName: "probabilistic",
        confidence: Math.min(confidence, 0.8),
        mediaSource: pending.media_source,
        campaignId: pending.campaign_id,
        adgroupId: pending.adgroup_id,
        creativeId: pending.creative_id,
        channel: pending.channel,
        deepLinkValue: pending.deep_link_value,
        inputs: { ip: snapshot.ip, platform: snapshot.platform },
      };
    }
  }
  return null;
}

export function resolveClickIdFromSignals(input: MatchInput): string | null {
  if (input.clickId) return input.clickId;
  if (input.installReferrer) {
    const fromRef = extractClickIdFromReferrer(input.installReferrer);
    if (fromRef) return fromRef;
  }
  if (input.deepLinkUrl) {
    const fromUrl = extractClickIdFromUrl(input.deepLinkUrl);
    if (fromUrl) return fromUrl;
  }
  return null;
}

export async function matchByImpression(
  deviceDb: Database | pg.Pool,
  companyId: string,
  windowHours: number,
  occurredAt: string,
): Promise<MatchCandidate | null> {
  const lowerBound = new Date(Date.parse(occurredAt) - windowHours * 3600 * 1000).toISOString();
  let impression: LinkImpressionRow | undefined;
  if (isPgConn(deviceDb)) {
    impression = await pgQueryOne<LinkImpressionRow>(
      deviceDb,
      `SELECT * FROM link_impressions
       WHERE company_id = $1 AND matched_at IS NULL
         AND viewed_at >= $2 AND viewed_at <= $3
         AND expires_at >= $3
       ORDER BY viewed_at DESC
       LIMIT 1`,
      [companyId, lowerBound, occurredAt],
    );
  } else {
    impression = deviceDb
      .prepare(
        `SELECT * FROM link_impressions
         WHERE company_id = ? AND matched_at IS NULL
           AND viewed_at >= ? AND viewed_at <= ?
           AND expires_at >= ?
         ORDER BY viewed_at DESC
         LIMIT 1`,
      )
      .get(companyId, lowerBound, occurredAt, occurredAt) as LinkImpressionRow | undefined;
  }
  if (!impression) return null;
  return {
    impressionId: impression.impression_id,
    clickId: impression.impression_id,
    attributionPath: "vta",
    ruleName: "vta_impression",
    confidence: 0.7,
    mediaSource: impression.media_source,
    campaignId: impression.campaign_id,
    adgroupId: impression.adgroup_id,
    creativeId: impression.creative_id,
    channel: impression.channel,
    inputs: { impressionId: impression.impression_id, viewedAt: impression.viewed_at },
    // Synthetic pending-click shape for materializing click_events
    pendingClick: {
      click_id: impression.impression_id,
      company_id: impression.company_id,
      link_id: impression.link_id,
      media_source: impression.media_source,
      campaign_id: impression.campaign_id,
      adgroup_id: impression.adgroup_id,
      creative_id: impression.creative_id,
      channel: impression.channel,
      deep_link_value: null,
      ip: null,
      user_agent: null,
      platform_hint: null,
      clicked_at: impression.viewed_at,
      expires_at: impression.expires_at,
      matched_identity_id: null,
      matched_at: null,
      gaid: null,
      idfa: null,
      metadata_json: JSON.stringify({
        ...(impression.metadata_json ? JSON.parse(impression.metadata_json) : {}),
        source: "vta_impression",
      }),
    },
  };
}

export async function runMatchRules(
  customerDb: Database | pg.Pool,
  deviceDb: Database | pg.Pool,
  input: MatchInput,
  tokenHash: string,
): Promise<MatchCandidate | null> {
  const clickId = resolveClickIdFromSignals(input);
  if (clickId) {
    const match = await matchByClickId(deviceDb, clickId);
    if (match) return match;
  }

  const adMatch = await matchByAdvertisingId(deviceDb, input.companyId, input.sessionId, input.windowHours, input.occurredAt);
  if (adMatch) return { ...adMatch, attributionPath: adMatch.attributionPath ?? "cta" };

  const sessionMatch = await matchBySessionRecord(
    customerDb,
    input.companyId,
    tokenHash,
    input.windowHours,
    input.occurredAt,
  );
  if (sessionMatch) return { ...sessionMatch, attributionPath: sessionMatch.attributionPath ?? "cta" };

  const vtaWindow = input.viewThroughWindowHours ?? input.windowHours;
  const vtaMatch = await matchByImpression(deviceDb, input.companyId, vtaWindow, input.occurredAt);
  if (vtaMatch) return vtaMatch;

  if (input.enableProbabilistic) {
    const prob = await matchProbabilistic(
      deviceDb,
      input.companyId,
      input.sessionId,
      input.windowHours,
      input.occurredAt,
      input.minConfidence,
    );
    if (prob) return { ...prob, attributionPath: "cta" };
  }

  return null;
}
