import crypto from "node:crypto";
import type { Database } from "better-sqlite3";
import { getAttributionSettings } from "./trackingLinks.js";

const DATACENTER_IP_PREFIXES = ["10.", "172.16.", "192.168."];

export function checkFraudFlags(
  deviceDb: Database,
  companyId: string,
  eventId: string,
  details: Record<string, unknown>
): void {
  deviceDb
    .prepare(
      `INSERT INTO fraud_flags (id, company_id, event_id, flag_type, details_json)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(crypto.randomUUID(), companyId, eventId, String(details.type ?? "unknown"), JSON.stringify(details));
}

export function checkInstallFraud(
  deviceDb: Database,
  companyId: string,
  eventId: string,
  ip: string | null,
  clickedAt: string | null,
  installAt: string
): void {
  if (ip) {
    for (const prefix of DATACENTER_IP_PREFIXES) {
      if (ip.startsWith(prefix)) {
        checkFraudFlags(deviceDb, companyId, eventId, { type: "datacenter_ip", ip });
        break;
      }
    }
  }
  if (clickedAt) {
    const delta = Date.parse(installAt) - Date.parse(clickedAt);
    if (delta < 5000) {
      checkFraudFlags(deviceDb, companyId, eventId, {
        type: "impossible_install_time",
        deltaMs: delta
      });
    }
  }
}

export async function sendPartnerPostback(
  customerDb: Database,
  deviceDb: Database,
  input: {
    companyId: string;
    eventType: string;
    eventId: string;
    mediaSource?: string | null;
    campaignId?: string | null;
    clickId?: string | null;
    gaid?: string | null;
    idfa?: string | null;
  }
): Promise<void> {
  const settings = getAttributionSettings(customerDb, input.companyId);
  if (!settings.partnerPostbackUrl) return;

  let url = settings.partnerPostbackUrl
    .replace("{event_type}", encodeURIComponent(input.eventType))
    .replace("{event_id}", encodeURIComponent(input.eventId))
    .replace("{media_source}", encodeURIComponent(input.mediaSource ?? ""))
    .replace("{campaign_id}", encodeURIComponent(input.campaignId ?? ""))
    .replace("{click_id}", encodeURIComponent(input.clickId ?? ""))
    .replace("{gaid}", encodeURIComponent(input.gaid ?? ""))
    .replace("{idfa}", encodeURIComponent(input.idfa ?? ""));

  try {
    const res = await fetch(url, { method: "GET" });
    const body = await res.text().catch(() => "");
    deviceDb
      .prepare(
        `INSERT INTO partner_postbacks
          (id, company_id, event_type, event_id, partner_name, url, status_code, response_body)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        crypto.randomUUID(),
        input.companyId,
        input.eventType,
        input.eventId,
        "default",
        url,
        res.status,
        body.slice(0, 2000)
      );
  } catch (err) {
    deviceDb
      .prepare(
        `INSERT INTO partner_postbacks
          (id, company_id, event_type, event_id, partner_name, url, status_code, response_body)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        crypto.randomUUID(),
        input.companyId,
        input.eventType,
        input.eventId,
        "default",
        url,
        0,
        err instanceof Error ? err.message : "fetch failed"
      );
  }
}

export function ingestCampaignCost(
  deviceDb: Database,
  input: {
    companyId: string;
    mediaSource?: string;
    campaignId?: string;
    costDate: string;
    costValue: number;
    costCurrency?: string;
  }
): void {
  deviceDb
    .prepare(
      `INSERT INTO campaign_costs (id, company_id, media_source, campaign_id, cost_date, cost_value, cost_currency)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      crypto.randomUUID(),
      input.companyId,
      input.mediaSource ?? null,
      input.campaignId ?? null,
      input.costDate,
      input.costValue,
      input.costCurrency ?? "USD"
    );
}
