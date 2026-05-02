import crypto from "node:crypto";
import { hashToken, tokenSaltForCompany } from "@securetarget/shared";
import type { Database } from "better-sqlite3";
import type { ClickEvent, ConversionEvent, LoginEvent } from "../../../packages/contracts/src/events.js";

const DEFAULT_WINDOW_HOURS = 24 * 7;

export { hashToken, tokenSaltForCompany } from "@securetarget/shared";

export function storeClick(db: Database, event: ClickEvent): void {
  const salt = tokenSaltForCompany(event.companyId);
  const tokenHash = event.token ? hashToken(event.token, salt) : null;
  db.prepare(
    `INSERT INTO click_events
      (id, company_id, token_hash, campaign_id, adgroup_id, creative_id, channel, landing_url, referrer, clicked_at, metadata_json)
     VALUES (@id, @company_id, @token_hash, @campaign_id, @adgroup_id, @creative_id, @channel, @landing_url, @referrer, @clicked_at, @metadata_json)`
  ).run({
    id: event.eventId,
    company_id: event.companyId,
    token_hash: tokenHash,
    campaign_id: event.campaignId ?? null,
    adgroup_id: event.adgroupId ?? null,
    creative_id: event.creativeId ?? null,
    channel: event.channel ?? null,
    landing_url: event.landingUrl ?? null,
    referrer: event.referrer ?? null,
    clicked_at: event.occurredAt,
    metadata_json: JSON.stringify(event.metadata ?? {})
  });
}

export function storeLoginToken(db: Database, event: LoginEvent): string {
  const salt = tokenSaltForCompany(event.companyId);
  const tokenHash = hashToken(event.token, salt);
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO login_tokens
      (id, company_id, token_hash, token_salt, issued_at, expires_at, first_seen_at, last_seen_at)
     VALUES (@id, @company_id, @token_hash, @token_salt, @issued_at, @expires_at, @first_seen_at, @last_seen_at)
     ON CONFLICT(id) DO UPDATE SET
      last_seen_at = excluded.last_seen_at,
      expires_at = COALESCE(excluded.expires_at, login_tokens.expires_at)`
  ).run({
    id: event.eventId,
    company_id: event.companyId,
    token_hash: tokenHash,
    token_salt: salt,
    issued_at: event.occurredAt,
    expires_at: event.expiresAt ?? null,
    first_seen_at: now,
    last_seen_at: now
  });

  return tokenHash;
}

export function resolveAndStoreAttribution(
  db: Database,
  event: ConversionEvent,
  windowHours = DEFAULT_WINDOW_HOURS
): { attributed: boolean; clickEventId?: string } {
  const salt = tokenSaltForCompany(event.companyId);
  const tokenHash = hashToken(event.token, salt);
  const lowerBound = new Date(Date.parse(event.occurredAt) - windowHours * 3600 * 1000).toISOString();

  const click = db
    .prepare(
      `SELECT id
       FROM click_events
       WHERE company_id = ? AND token_hash = ? AND clicked_at >= ?
       ORDER BY clicked_at DESC
       LIMIT 1`
    )
    .get(event.companyId, tokenHash, lowerBound) as { id: string } | undefined;

  if (!click) {
    return { attributed: false };
  }

  db.prepare(
    `INSERT INTO attribution_events
      (id, company_id, token_hash, click_event_id, conversion_event_id, attributed_at, attribution_window_hours, confidence)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    crypto.randomUUID(),
    event.companyId,
    tokenHash,
    click.id,
    event.eventId,
    event.occurredAt,
    windowHours,
    1.0
  );

  return { attributed: true, clickEventId: click.id };
}

export function storeSdkEvent(db: Database, companyId: string, eventType: string, payload: unknown, tokenHash?: string): void {
  db.prepare(
    `INSERT INTO sdk_events (id, company_id, event_type, token_hash, payload_json)
     VALUES (?, ?, ?, ?, ?)`
  ).run(crypto.randomUUID(), companyId, eventType, tokenHash ?? null, JSON.stringify(payload));
}

export function markEventProcessed(db: Database, eventId: string, companyId: string, eventType: string): void {
  db.prepare(
    `INSERT INTO processed_events (event_id, company_id, event_type) VALUES (?, ?, ?)`
  ).run(eventId, companyId, eventType);
}

export function isEventProcessed(db: Database, eventId: string): boolean {
  const row = db.prepare(`SELECT event_id FROM processed_events WHERE event_id = ?`).get(eventId);
  return Boolean(row);
}
