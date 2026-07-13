import crypto from "node:crypto";
import type { Database } from "better-sqlite3";
import type pg from "pg";
import type { InstallEvent } from "../../../packages/contracts/src/events.js";
import { hashToken, tokenSaltForCompany } from "@securetarget/shared";
import { getIdentityForSession } from "./deviceIdentity.js";
import { runMatchRules, type MatchCandidate } from "./matchRules.js";
import { markPendingClickMatched } from "../routes/clickRedirect.js";
import { getAttributionSettings } from "./trackingLinks.js";
import { storeClick } from "./attribution.js";
import { checkFraudFlags, sendPartnerPostback } from "./partnerPostbacks.js";
import { isPgConn, pgExecute, pgQueryOne } from "../db/ingestDb.js";

export interface InstallAttributionResult {
  attributed: boolean;
  isOrganic: boolean;
  confidence: number;
  ruleName?: string;
  clickId?: string;
  clickEventId?: string;
  mediaSource?: string | null;
  campaignId?: string | null;
  adgroupId?: string | null;
  creativeId?: string | null;
  channel?: string | null;
  deepLinkValue?: string | null;
}

async function writeMatchAudit(
  deviceDb: Database | pg.Pool,
  input: {
    companyId: string;
    installEventId: string;
    sessionId: string;
    identityId?: string | null;
    clickId?: string | null;
    candidate: MatchCandidate | null;
  },
): Promise<void> {
  const id = crypto.randomUUID();
  if (isPgConn(deviceDb)) {
    await pgExecute(
      deviceDb,
      `INSERT INTO match_audit
        (id, company_id, install_event_id, session_id, identity_id, click_id, rule_name, confidence, inputs_json)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        id,
        input.companyId,
        input.installEventId,
        input.sessionId,
        input.identityId ?? null,
        input.clickId ?? input.candidate?.clickId ?? null,
        input.candidate?.ruleName ?? "organic",
        input.candidate?.confidence ?? 0,
        JSON.stringify(input.candidate?.inputs ?? { organic: true }),
      ],
    );
    return;
  }
  deviceDb
    .prepare(
      `INSERT INTO match_audit
        (id, company_id, install_event_id, session_id, identity_id, click_id, rule_name, confidence, inputs_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      input.companyId,
      input.installEventId,
      input.sessionId,
      input.identityId ?? null,
      input.clickId ?? input.candidate?.clickId ?? null,
      input.candidate?.ruleName ?? "organic",
      input.candidate?.confidence ?? 0,
      JSON.stringify(input.candidate?.inputs ?? { organic: true }),
    );
}

function pendingClickToRecordEvent(
  pending: NonNullable<MatchCandidate["pendingClick"]>,
  companyId: string,
  token: string,
): Parameters<typeof storeClick>[1] {
  return {
    actionType: "record",
    eventId: pending.click_id,
    companyId,
    occurredAt: pending.clicked_at,
    token,
    mediaSource: pending.media_source ?? undefined,
    campaignId: pending.campaign_id ?? undefined,
    adgroupId: pending.adgroup_id ?? undefined,
    creativeId: pending.creative_id ?? undefined,
    channel: pending.channel ?? undefined,
    metadata: {
      ...(pending.metadata_json ? JSON.parse(pending.metadata_json) : {}),
      deepLinkValue: pending.deep_link_value,
      source: "pending_click",
    },
  };
}

export async function resolveInstallAttribution(
  customerDb: Database | pg.Pool,
  deviceDb: Database | pg.Pool,
  event: InstallEvent,
  sessionId: string,
): Promise<InstallAttributionResult> {
  const settings = await getAttributionSettings(customerDb, event.companyId);
  const salt = tokenSaltForCompany(event.companyId);
  const tokenHash = hashToken(event.token, salt);
  const identity = await getIdentityForSession(deviceDb, event.companyId, sessionId);

  const candidate = await runMatchRules(
    customerDb,
    deviceDb,
    {
      companyId: event.companyId,
      sessionId,
      installEventId: event.eventId,
      occurredAt: event.occurredAt,
      clickId: event.clickId,
      installReferrer: event.installReferrer,
      deepLinkUrl: event.deepLinkUrl,
      enableProbabilistic: settings.enableProbabilisticMatching,
      minConfidence: settings.probabilisticMinConfidence,
      windowHours: settings.installAttributionWindowHours,
    },
    tokenHash,
  );

  await writeMatchAudit(deviceDb, {
    companyId: event.companyId,
    installEventId: event.eventId,
    sessionId,
    identityId: identity?.identityId,
    clickId: event.clickId,
    candidate,
  });

  if (!candidate) {
    await checkFraudFlags(deviceDb, event.companyId, event.eventId, { type: "organic_install" });
    return { attributed: false, isOrganic: true, confidence: 0 };
  }

  let clickEventId = candidate.clickEventId;

  if (!clickEventId && candidate.pendingClick) {
    let existing: { id: string } | undefined;
    if (isPgConn(customerDb)) {
      existing = await pgQueryOne<{ id: string }>(
        customerDb,
        `SELECT id FROM click_events WHERE id = $1`,
        [candidate.pendingClick.click_id],
      );
    } else {
      existing = customerDb
        .prepare(`SELECT id FROM click_events WHERE id = ?`)
        .get(candidate.pendingClick.click_id) as { id: string } | undefined;
    }
    if (!existing) {
      await storeClick(customerDb, pendingClickToRecordEvent(candidate.pendingClick, event.companyId, event.token));
    }
    clickEventId = candidate.pendingClick.click_id;
    if (identity?.identityId) {
      await markPendingClickMatched(deviceDb, candidate.pendingClick.click_id, identity.identityId);
    }
  }

  if (!clickEventId) {
    return { attributed: false, isOrganic: true, confidence: 0 };
  }

  const attrId = crypto.randomUUID();
  if (isPgConn(customerDb)) {
    await pgExecute(
      customerDb,
      `INSERT INTO attribution_events
        (id, company_id, token_hash, click_event_id, conversion_event_id, attributed_at,
         attribution_window_hours, reengagement_window_hours, confidence, match_rule, is_organic)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        attrId,
        event.companyId,
        tokenHash,
        clickEventId,
        event.eventId,
        event.occurredAt,
        settings.installAttributionWindowHours,
        null,
        candidate.confidence,
        candidate.ruleName,
        false,
      ],
    );
  } else {
    customerDb
      .prepare(
        `INSERT INTO attribution_events
          (id, company_id, token_hash, click_event_id, conversion_event_id, attributed_at,
           attribution_window_hours, reengagement_window_hours, confidence, match_rule, is_organic)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        attrId,
        event.companyId,
        tokenHash,
        clickEventId,
        event.eventId,
        event.occurredAt,
        settings.installAttributionWindowHours,
        null,
        candidate.confidence,
        candidate.ruleName,
        0,
      );
  }

  await checkFraudFlags(deviceDb, event.companyId, event.eventId, {
    type: "attributed_install",
    clickId: candidate.clickId,
    rule: candidate.ruleName,
  });

  void sendPartnerPostback(customerDb, deviceDb, {
    companyId: event.companyId,
    eventType: "install",
    eventId: event.eventId,
    mediaSource: candidate.mediaSource,
    campaignId: candidate.campaignId,
    clickId: candidate.clickId,
  });

  return {
    attributed: true,
    isOrganic: false,
    confidence: candidate.confidence,
    ruleName: candidate.ruleName,
    clickId: candidate.clickId,
    clickEventId,
    mediaSource: candidate.mediaSource,
    campaignId: candidate.campaignId,
    adgroupId: candidate.adgroupId,
    creativeId: candidate.creativeId,
    channel: candidate.channel,
    deepLinkValue: candidate.deepLinkValue,
  };
}
