import crypto from "node:crypto";
import type { Database } from "better-sqlite3";
import type pg from "pg";
import { hashToken, tokenSaltForCompany } from "@eventiqn/shared";
import type { ConversionEvent, LoginEvent, RecordEvent } from "../../../packages/contracts/src/events.js";
import { isPgConn, pgExecute, pgQueryOne } from "../db/ingestDb.js";

const DEFAULT_WINDOW_HOURS = 24 * 7;

export { hashToken, tokenSaltForCompany } from "@eventiqn/shared";

export async function storeClick(db: Database | pg.Pool, event: RecordEvent): Promise<void> {
  const salt = tokenSaltForCompany(event.companyId);
  const tokenHash = event.token ? hashToken(event.token, salt) : null;
  if (isPgConn(db)) {
    await pgExecute(
      db,
      `INSERT INTO click_events
        (id, company_id, token_hash, event_source_partner, media_source, campaign_id, adgroup_id, creative_id,
         channel, cost_model, cost_value, cost_currency, landing_url, referrer, clicked_at, metadata_json)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
      [
        event.eventId,
        event.companyId,
        tokenHash,
        event.eventSourcePartner ?? null,
        event.mediaSource ?? null,
        event.campaignId ?? null,
        event.adgroupId ?? null,
        event.creativeId ?? null,
        event.channel ?? null,
        event.costModel ?? null,
        event.costValue ?? null,
        event.costCurrency ?? null,
        event.landingUrl ?? null,
        event.referrer ?? null,
        event.occurredAt,
        JSON.stringify(event.metadata ?? {}),
      ],
    );
    return;
  }
  db.prepare(
    `INSERT INTO click_events
      (id, company_id, token_hash, event_source_partner, media_source, campaign_id, adgroup_id, creative_id, channel, cost_model, cost_value, cost_currency, landing_url, referrer, clicked_at, metadata_json)
     VALUES (@id, @company_id, @token_hash, @event_source_partner, @media_source, @campaign_id, @adgroup_id, @creative_id, @channel, @cost_model, @cost_value, @cost_currency, @landing_url, @referrer, @clicked_at, @metadata_json)`,
  ).run({
    id: event.eventId,
    company_id: event.companyId,
    token_hash: tokenHash,
    event_source_partner: event.eventSourcePartner ?? null,
    media_source: event.mediaSource ?? null,
    campaign_id: event.campaignId ?? null,
    adgroup_id: event.adgroupId ?? null,
    creative_id: event.creativeId ?? null,
    channel: event.channel ?? null,
    cost_model: event.costModel ?? null,
    cost_value: event.costValue ?? null,
    cost_currency: event.costCurrency ?? null,
    landing_url: event.landingUrl ?? null,
    referrer: event.referrer ?? null,
    clicked_at: event.occurredAt,
    metadata_json: JSON.stringify(event.metadata ?? {}),
  });
}

export async function storeLoginToken(db: Database | pg.Pool, event: LoginEvent): Promise<string> {
  const salt = tokenSaltForCompany(event.companyId);
  const tokenHash = hashToken(event.token, salt);
  const now = new Date().toISOString();
  if (isPgConn(db)) {
    await pgExecute(
      db,
      `INSERT INTO login_tokens
        (id, company_id, token_hash, token_salt, issued_at, expires_at, first_seen_at, last_seen_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
        last_seen_at = EXCLUDED.last_seen_at,
        expires_at = COALESCE(EXCLUDED.expires_at, login_tokens.expires_at)`,
      [
        event.eventId,
        event.companyId,
        tokenHash,
        salt,
        event.occurredAt,
        event.expiresAt ?? null,
        now,
        now,
      ],
    );
    return tokenHash;
  }
  db.prepare(
    `INSERT INTO login_tokens
      (id, company_id, token_hash, token_salt, issued_at, expires_at, first_seen_at, last_seen_at)
     VALUES (@id, @company_id, @token_hash, @token_salt, @issued_at, @expires_at, @first_seen_at, @last_seen_at)
     ON CONFLICT(id) DO UPDATE SET
      last_seen_at = excluded.last_seen_at,
      expires_at = COALESCE(excluded.expires_at, login_tokens.expires_at)`,
  ).run({
    id: event.eventId,
    company_id: event.companyId,
    token_hash: tokenHash,
    token_salt: salt,
    issued_at: event.occurredAt,
    expires_at: event.expiresAt ?? null,
    first_seen_at: now,
    last_seen_at: now,
  });
  return tokenHash;
}

export async function resolveAndStoreAttribution(
  db: Database | pg.Pool,
  event: ConversionEvent,
  windowHours = DEFAULT_WINDOW_HOURS,
): Promise<{ attributed: boolean; clickEventId?: string }> {
  const salt = tokenSaltForCompany(event.companyId);
  const tokenHash = hashToken(event.token, salt);
  const lookbackHours =
    typeof event.attributionLookbackHours === "number" && Number.isFinite(event.attributionLookbackHours)
      ? Math.max(1, Math.trunc(event.attributionLookbackHours))
      : windowHours;
  const reengagementHours =
    typeof event.reengagementWindowHours === "number" && Number.isFinite(event.reengagementWindowHours)
      ? Math.max(1, Math.trunc(event.reengagementWindowHours))
      : null;
  const lowerBound = new Date(Date.parse(event.occurredAt) - lookbackHours * 3600 * 1000).toISOString();

  let clickId: string | undefined;
  if (isPgConn(db)) {
    const click = await pgQueryOne<{ id: string }>(
      db,
      `SELECT id FROM click_events
       WHERE company_id = $1 AND token_hash = $2 AND clicked_at >= $3
       ORDER BY clicked_at DESC LIMIT 1`,
      [event.companyId, tokenHash, lowerBound],
    );
    clickId = click?.id;
  } else {
    const click = db
      .prepare(
        `SELECT id FROM click_events
         WHERE company_id = ? AND token_hash = ? AND clicked_at >= ?
         ORDER BY clicked_at DESC LIMIT 1`,
      )
      .get(event.companyId, tokenHash, lowerBound) as { id: string } | undefined;
    clickId = click?.id;
  }

  if (!clickId) return { attributed: false };

  const attrId = crypto.randomUUID();
  if (isPgConn(db)) {
    await pgExecute(
      db,
      `INSERT INTO attribution_events
        (id, company_id, token_hash, click_event_id, conversion_event_id, attributed_at, attribution_window_hours, reengagement_window_hours, confidence)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        attrId,
        event.companyId,
        tokenHash,
        clickId,
        event.eventId,
        event.occurredAt,
        lookbackHours,
        reengagementHours,
        1.0,
      ],
    );
  } else {
    db.prepare(
      `INSERT INTO attribution_events
        (id, company_id, token_hash, click_event_id, conversion_event_id, attributed_at, attribution_window_hours, reengagement_window_hours, confidence)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      attrId,
      event.companyId,
      tokenHash,
      clickId,
      event.eventId,
      event.occurredAt,
      lookbackHours,
      reengagementHours,
      1.0,
    );
  }

  return { attributed: true, clickEventId: clickId };
}

export async function storeSdkEvent(
  db: Database | pg.Pool,
  companyId: string,
  eventType: string,
  payload: unknown,
  tokenHash?: string,
): Promise<void> {
  const id = crypto.randomUUID();
  if (isPgConn(db)) {
    await pgExecute(
      db,
      `INSERT INTO sdk_events (id, company_id, event_type, token_hash, payload_json) VALUES ($1, $2, $3, $4, $5)`,
      [id, companyId, eventType, tokenHash ?? null, JSON.stringify(payload)],
    );
    return;
  }
  db.prepare(`INSERT INTO sdk_events (id, company_id, event_type, token_hash, payload_json) VALUES (?, ?, ?, ?, ?)`).run(
    id,
    companyId,
    eventType,
    tokenHash ?? null,
    JSON.stringify(payload),
  );
}

export async function markEventProcessed(
  db: Database | pg.Pool,
  eventId: string,
  companyId: string,
  eventType: string,
): Promise<void> {
  if (isPgConn(db)) {
    await pgExecute(db, `INSERT INTO processed_events (event_id, company_id, event_type) VALUES ($1, $2, $3)`, [
      eventId,
      companyId,
      eventType,
    ]);
    return;
  }
  db.prepare(`INSERT INTO processed_events (event_id, company_id, event_type) VALUES (?, ?, ?)`).run(
    eventId,
    companyId,
    eventType,
  );
}

export async function isEventProcessed(db: Database | pg.Pool, eventId: string): Promise<boolean> {
  if (isPgConn(db)) {
    const row = await pgQueryOne<{ event_id: string }>(
      db,
      `SELECT event_id FROM processed_events WHERE event_id = $1`,
      [eventId],
    );
    return Boolean(row);
  }
  const row = db.prepare(`SELECT event_id FROM processed_events WHERE event_id = ?`).get(eventId);
  return Boolean(row);
}
