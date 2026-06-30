import crypto from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Database } from "better-sqlite3";
import { resolveCompanyIdFromApiKey } from "../services/apiKeyAuth.js";

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

export async function handleSkanPostback(
  req: IncomingMessage,
  res: ServerResponse,
  deviceDb: Database,
  customerDb: Database
): Promise<void> {
  const apiKey = req.headers["x-api-key"];
  if (typeof apiKey !== "string" || !apiKey) {
    sendJson(res, 401, { error: "Missing x-api-key" });
    return;
  }
  const companyId = resolveCompanyIdFromApiKey(customerDb, apiKey);
  if (!companyId) {
    sendJson(res, 401, { error: "Invalid API key" });
    return;
  }

  try {
    const raw = await readJson(req);
    const body = typeof raw === "object" && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
    const campaignId = typeof body.campaign_id === "string" ? body.campaign_id : null;
    const mediaSource = typeof body.media_source === "string" ? body.media_source : null;
    const conversionValue = typeof body.conversion_value === "number" ? body.conversion_value : null;
    const postbackSequence = typeof body.postback_sequence_index === "number" ? body.postback_sequence_index : null;
    const coarseValue = typeof body.coarse_conversion_value === "number" ? body.coarse_conversion_value : null;
    const sourceAppId = typeof body.source_app_id === "string" ? body.source_app_id : null;

    deviceDb
      .prepare(
        `INSERT INTO skan_postbacks
          (id, company_id, campaign_id, media_source, conversion_value, postback_sequence, coarse_value, source_app_id, payload_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        crypto.randomUUID(),
        companyId,
        campaignId,
        mediaSource,
        conversionValue,
        postbackSequence,
        coarseValue,
        sourceAppId,
        JSON.stringify(body)
      );

    sendJson(res, 202, { ok: true });
  } catch (e) {
    sendJson(res, 400, { error: e instanceof Error ? e.message : "Invalid request" });
  }
}

export async function handleCostIngest(
  req: IncomingMessage,
  res: ServerResponse,
  deviceDb: Database,
  customerDb: Database
): Promise<void> {
  const apiKey = req.headers["x-api-key"];
  if (typeof apiKey !== "string" || !apiKey) {
    sendJson(res, 401, { error: "Missing x-api-key" });
    return;
  }
  const companyId = resolveCompanyIdFromApiKey(customerDb, apiKey);
  if (!companyId) {
    sendJson(res, 401, { error: "Invalid API key" });
    return;
  }

  try {
    const raw = await readJson(req);
    const body = typeof raw === "object" && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
    const costDate = typeof body.costDate === "string" ? body.costDate : new Date().toISOString().slice(0, 10);
    const costValue = typeof body.costValue === "number" ? body.costValue : null;
    if (costValue === null) {
      sendJson(res, 400, { error: "costValue required" });
      return;
    }
    const { ingestCampaignCost } = await import("../services/partnerPostbacks.js");
    ingestCampaignCost(deviceDb, {
      companyId,
      mediaSource: typeof body.mediaSource === "string" ? body.mediaSource : undefined,
      campaignId: typeof body.campaignId === "string" ? body.campaignId : undefined,
      costDate,
      costValue,
      costCurrency: typeof body.costCurrency === "string" ? body.costCurrency : "USD"
    });
    sendJson(res, 202, { ok: true });
  } catch (e) {
    sendJson(res, 400, { error: e instanceof Error ? e.message : "Invalid request" });
  }
}
