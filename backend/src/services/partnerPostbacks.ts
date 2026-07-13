import crypto from "node:crypto";
import type { Database } from "better-sqlite3";
import type pg from "pg";
import { getAttributionSettings } from "./trackingLinks.js";
import { isPgConn, pgExecute } from "../db/ingestDb.js";

const DATACENTER_IP_PREFIXES = ["10.", "172.16.", "192.168."];

export async function checkFraudFlags(
  deviceDb: Database | pg.Pool,
  companyId: string,
  eventId: string,
  details: Record<string, unknown>,
): Promise<void> {
  const id = crypto.randomUUID();
  if (isPgConn(deviceDb)) {
    await pgExecute(
      deviceDb,
      `INSERT INTO fraud_flags (id, company_id, event_id, flag_type, details_json) VALUES ($1, $2, $3, $4, $5)`,
      [id, companyId, eventId, String(details.type ?? "unknown"), JSON.stringify(details)],
    );
    return;
  }
  deviceDb
    .prepare(`INSERT INTO fraud_flags (id, company_id, event_id, flag_type, details_json) VALUES (?, ?, ?, ?, ?)`)
    .run(id, companyId, eventId, String(details.type ?? "unknown"), JSON.stringify(details));
}

export async function sendPartnerPostback(
  customerDb: Database | pg.Pool,
  deviceDb: Database | pg.Pool,
  input: {
    companyId: string;
    eventType: string;
    eventId: string;
    mediaSource?: string | null;
    campaignId?: string | null;
    clickId?: string | null;
    gaid?: string | null;
    idfa?: string | null;
  },
): Promise<void> {
  const settings = await getAttributionSettings(customerDb, input.companyId);
  if (!settings.partnerPostbackUrl) return;

  const url = settings.partnerPostbackUrl
    .replace("{event_type}", encodeURIComponent(input.eventType))
    .replace("{event_id}", encodeURIComponent(input.eventId))
    .replace("{media_source}", encodeURIComponent(input.mediaSource ?? ""))
    .replace("{campaign_id}", encodeURIComponent(input.campaignId ?? ""))
    .replace("{click_id}", encodeURIComponent(input.clickId ?? ""))
    .replace("{gaid}", encodeURIComponent(input.gaid ?? ""))
    .replace("{idfa}", encodeURIComponent(input.idfa ?? ""));

  const insertPostback = async (statusCode: number, body: string) => {
    const id = crypto.randomUUID();
    if (isPgConn(deviceDb)) {
      await pgExecute(
        deviceDb,
        `INSERT INTO partner_postbacks
          (id, company_id, event_type, event_id, partner_name, url, status_code, response_body)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [id, input.companyId, input.eventType, input.eventId, "default", url, statusCode, body.slice(0, 2000)],
      );
      return;
    }
    deviceDb
      .prepare(
        `INSERT INTO partner_postbacks
          (id, company_id, event_type, event_id, partner_name, url, status_code, response_body)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, input.companyId, input.eventType, input.eventId, "default", url, statusCode, body.slice(0, 2000));
  };

  try {
    const res = await fetch(url, { method: "GET" });
    const body = await res.text().catch(() => "");
    await insertPostback(res.status, body);
  } catch (err) {
    await insertPostback(0, err instanceof Error ? err.message : "fetch failed");
  }
}

export async function ingestCampaignCost(
  deviceDb: Database | pg.Pool,
  input: {
    companyId: string;
    mediaSource?: string;
    campaignId?: string;
    costDate: string;
    costValue: number;
    costCurrency?: string;
  },
): Promise<void> {
  const id = crypto.randomUUID();
  if (isPgConn(deviceDb)) {
    await pgExecute(
      deviceDb,
      `INSERT INTO campaign_costs (id, company_id, media_source, campaign_id, cost_date, cost_value, cost_currency)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        id,
        input.companyId,
        input.mediaSource ?? null,
        input.campaignId ?? null,
        input.costDate,
        input.costValue,
        input.costCurrency ?? "USD",
      ],
    );
    return;
  }
  deviceDb
    .prepare(
      `INSERT INTO campaign_costs (id, company_id, media_source, campaign_id, cost_date, cost_value, cost_currency)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      input.companyId,
      input.mediaSource ?? null,
      input.campaignId ?? null,
      input.costDate,
      input.costValue,
      input.costCurrency ?? "USD",
    );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function checkInstallFraud(
  deviceDb: Database | pg.Pool,
  companyId: string,
  eventId: string,
  ip: string | null,
  clickedAt: string | null,
  installAt: string,
): void {
  if (ip) {
    for (const prefix of DATACENTER_IP_PREFIXES) {
      if (ip.startsWith(prefix)) {
        void checkFraudFlags(deviceDb, companyId, eventId, { type: "datacenter_ip", ip });
        break;
      }
    }
  }
  if (clickedAt) {
    const delta = Date.parse(installAt) - Date.parse(clickedAt);
    if (delta < 5000) {
      void checkFraudFlags(deviceDb, companyId, eventId, { type: "impossible_install_time", deltaMs: delta });
    }
  }
}
