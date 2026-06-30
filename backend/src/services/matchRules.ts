import type { Database } from "better-sqlite3";
import type { PendingClickRow } from "../routes/clickRedirect.js";
import { extractClickIdFromReferrer, extractClickIdFromUrl } from "../routes/clickRedirect.js";
import { getIdentityForSession } from "./deviceIdentity.js";

export interface MatchCandidate {
  clickId?: string;
  clickEventId?: string;
  pendingClick?: PendingClickRow;
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
}

export function matchByClickId(
  deviceDb: Database,
  clickId: string
): MatchCandidate | null {
  const pending = deviceDb
    .prepare(`SELECT * FROM pending_clicks WHERE click_id = ? AND matched_at IS NULL`)
    .get(clickId) as PendingClickRow | undefined;
  if (!pending) return null;
  return {
    clickId,
    pendingClick: pending,
    ruleName: "click_id_exact",
    confidence: 1.0,
    mediaSource: pending.media_source,
    campaignId: pending.campaign_id,
    adgroupId: pending.adgroup_id,
    creativeId: pending.creative_id,
    channel: pending.channel,
    deepLinkValue: pending.deep_link_value,
    inputs: { clickId }
  };
}

export function matchByAdvertisingId(
  deviceDb: Database,
  companyId: string,
  sessionId: string,
  windowHours: number,
  occurredAt: string
): MatchCandidate | null {
  const identity = getIdentityForSession(deviceDb, companyId, sessionId);
  if (!identity) return null;
  const lowerBound = new Date(Date.parse(occurredAt) - windowHours * 3600 * 1000).toISOString();

  let pending: PendingClickRow | undefined;
  if (identity.idfa) {
    pending = deviceDb
      .prepare(
        `SELECT * FROM pending_clicks
         WHERE company_id = ? AND idfa = ? AND matched_at IS NULL AND clicked_at >= ?
         ORDER BY clicked_at DESC LIMIT 1`
      )
      .get(companyId, identity.idfa, lowerBound) as PendingClickRow | undefined;
  }
  if (!pending && identity.gaid) {
    pending = deviceDb
      .prepare(
        `SELECT * FROM pending_clicks
         WHERE company_id = ? AND gaid = ? AND matched_at IS NULL AND clicked_at >= ?
         ORDER BY clicked_at DESC LIMIT 1`
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
         ORDER BY pc.clicked_at DESC LIMIT 1`
      )
      .get(sessionId, companyId, lowerBound) as PendingClickRow | undefined;
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
    inputs: { idfa: identity.idfa, gaid: identity.gaid }
  };
}

export function matchBySessionRecord(
  customerDb: Database,
  companyId: string,
  tokenHash: string,
  windowHours: number,
  occurredAt: string
): MatchCandidate | null {
  const lowerBound = new Date(Date.parse(occurredAt) - windowHours * 3600 * 1000).toISOString();
  const click = customerDb
    .prepare(
      `SELECT id, media_source, campaign_id, adgroup_id, creative_id, channel, metadata_json
       FROM click_events
       WHERE company_id = ? AND token_hash = ? AND clicked_at >= ?
       ORDER BY clicked_at DESC LIMIT 1`
    )
    .get(companyId, tokenHash, lowerBound) as
    | {
        id: string;
        media_source: string | null;
        campaign_id: string | null;
        adgroup_id: string | null;
        creative_id: string | null;
        channel: string | null;
        metadata_json: string | null;
      }
    | undefined;

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
    inputs: { clickEventId: click.id }
  };
}

export function matchProbabilistic(
  deviceDb: Database,
  companyId: string,
  sessionId: string,
  windowHours: number,
  occurredAt: string,
  minConfidence: number
): MatchCandidate | null {
  const snapshot = deviceDb
    .prepare(
      `SELECT ds.ip, ds.user_agent AS userAgent, di.platform
       FROM device_snapshots ds
       JOIN identity_sessions isess ON isess.identity_id = ds.identity_id AND isess.session_id = ds.session_id
       JOIN device_identities di ON di.id = ds.identity_id
       WHERE ds.session_id = ? AND ds.company_id = ?
       ORDER BY ds.occurred_at DESC LIMIT 1`
    )
    .get(sessionId, companyId) as { ip: string | null; userAgent: string | null; platform: string } | undefined;

  if (!snapshot?.ip) return null;
  const lowerBound = new Date(Date.parse(occurredAt) - windowHours * 3600 * 1000).toISOString();

  const candidates = deviceDb
    .prepare(
      `SELECT * FROM pending_clicks
       WHERE company_id = ? AND matched_at IS NULL AND clicked_at >= ? AND ip = ?
       ORDER BY clicked_at DESC LIMIT 5`
    )
    .all(companyId, lowerBound, snapshot.ip) as PendingClickRow[];

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
        inputs: { ip: snapshot.ip, platform: snapshot.platform }
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

export function runMatchRules(
  customerDb: Database,
  deviceDb: Database,
  input: MatchInput,
  tokenHash: string
): MatchCandidate | null {
  const clickId = resolveClickIdFromSignals(input);
  if (clickId) {
    const match = matchByClickId(deviceDb, clickId);
    if (match) return match;
  }

  const adMatch = matchByAdvertisingId(deviceDb, input.companyId, input.sessionId, input.windowHours, input.occurredAt);
  if (adMatch) return adMatch;

  const sessionMatch = matchBySessionRecord(
    customerDb,
    input.companyId,
    tokenHash,
    input.windowHours,
    input.occurredAt
  );
  if (sessionMatch) return sessionMatch;

  if (input.enableProbabilistic) {
    return matchProbabilistic(
      deviceDb,
      input.companyId,
      input.sessionId,
      input.windowHours,
      input.occurredAt,
      input.minConfidence
    );
  }

  return null;
}
