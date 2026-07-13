import crypto from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { resolveCompanyIdFromApiKeyAsync } from "../services/apiKeyAuth.js";
import { ingestCampaignCost } from "../services/partnerPostbacks.js";
import type { IngestDb } from "../db/ingestDb.js";
import { isPgConn, pgExecute } from "../db/ingestDb.js";

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

async function resolveApiKeyCompany(ingestDb: IngestDb, apiKey: string): Promise<string | null> {
  return resolveCompanyIdFromApiKeyAsync(
    ingestDb.mode === "sqlite" ? { sqlite: ingestDb.customerSqlite() } : { pg: ingestDb.pool() },
    apiKey,
  );
}

export async function handleSkanPostback(
  req: IncomingMessage,
  res: ServerResponse,
  ingestDb: IngestDb,
): Promise<void> {
  const device = ingestDb.device();
  const apiKey = req.headers["x-api-key"];
  if (typeof apiKey !== "string" || !apiKey) {
    sendJson(res, 401, { error: "Missing x-api-key" });
    return;
  }
  const companyId = await resolveApiKeyCompany(ingestDb, apiKey);
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
    const id = crypto.randomUUID();

    if (isPgConn(device)) {
      await pgExecute(
        device,
        `INSERT INTO skan_postbacks
          (id, company_id, campaign_id, media_source, conversion_value, postback_sequence, coarse_value, source_app_id, payload_json)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          id,
          companyId,
          campaignId,
          mediaSource,
          conversionValue,
          postbackSequence,
          coarseValue,
          sourceAppId,
          JSON.stringify(body),
        ],
      );
    } else {
      device
        .prepare(
          `INSERT INTO skan_postbacks
            (id, company_id, campaign_id, media_source, conversion_value, postback_sequence, coarse_value, source_app_id, payload_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          companyId,
          campaignId,
          mediaSource,
          conversionValue,
          postbackSequence,
          coarseValue,
          sourceAppId,
          JSON.stringify(body),
        );
    }

    sendJson(res, 202, { ok: true });
  } catch (e) {
    sendJson(res, 400, { error: e instanceof Error ? e.message : "Invalid request" });
  }
}

export async function handleCostIngest(
  req: IncomingMessage,
  res: ServerResponse,
  ingestDb: IngestDb,
): Promise<void> {
  const device = ingestDb.device();
  const apiKey = req.headers["x-api-key"];
  if (typeof apiKey !== "string" || !apiKey) {
    sendJson(res, 401, { error: "Missing x-api-key" });
    return;
  }
  const companyId = await resolveApiKeyCompany(ingestDb, apiKey);
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
    await ingestCampaignCost(device, {
      companyId,
      mediaSource: typeof body.mediaSource === "string" ? body.mediaSource : undefined,
      campaignId: typeof body.campaignId === "string" ? body.campaignId : undefined,
      costDate,
      costValue,
      costCurrency: typeof body.costCurrency === "string" ? body.costCurrency : undefined,
    });
    sendJson(res, 202, { ok: true });
  } catch (e) {
    sendJson(res, 400, { error: e instanceof Error ? e.message : "Invalid request" });
  }
}
