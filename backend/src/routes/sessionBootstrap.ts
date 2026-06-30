import type { IncomingMessage, ServerResponse } from "node:http";
import type { Database } from "better-sqlite3";
import { createClientSession } from "../services/clientSession.js";
import { persistBootstrapSnapshot } from "../services/deviceIdentity.js";
import { resolveCompanyIdFromApiKey } from "../services/apiKeyAuth.js";

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }
  if (chunks.length === 0) {
    return {};
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function getApiKeyHeader(req: IncomingMessage): string | null {
  const header = req.headers["x-api-key"];
  return typeof header === "string" && header.length > 0 ? header : null;
}

function isOptionalStringField(value: unknown): boolean {
  return value === undefined || typeof value === "string";
}

function isUtmObject(value: unknown): boolean {
  if (value === undefined) return true;
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const o = value as Record<string, unknown>;
  return (
    isOptionalStringField(o.source) &&
    isOptionalStringField(o.medium) &&
    isOptionalStringField(o.campaign) &&
    isOptionalStringField(o.term) &&
    isOptionalStringField(o.content)
  );
}

function isDevicePayload(raw: unknown): raw is { occurredAt: string; device: Record<string, unknown> } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return false;
  const o = raw as Record<string, unknown>;
  if (typeof o.occurredAt !== "string" || Number.isNaN(Date.parse(o.occurredAt))) return false;
  if (typeof o.device !== "object" || o.device === null || Array.isArray(o.device)) return false;
  const d = o.device as Record<string, unknown>;
  const p = d.platform;
  if (p !== "web" && p !== "ios" && p !== "android") return false;
  if (!isOptionalStringField(d.advertisingId) || !isOptionalStringField(d.vendorId)) return false;
  if (!isOptionalStringField(d.installReferrer) || !isOptionalStringField(d.deepLinkUrl)) return false;
  if (!isUtmObject(d.utm)) return false;
  return true;
}

function clientIp(req: IncomingMessage): string | null {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0]?.trim() ?? null;
  }
  return req.socket.remoteAddress ?? null;
}

export async function handleSessionBootstrap(
  req: IncomingMessage,
  res: ServerResponse,
  db: Database,
  deviceDb: Database
): Promise<void> {
  const apiKey = getApiKeyHeader(req);
  if (!apiKey) {
    sendJson(res, 401, { error: "Missing x-api-key" });
    return;
  }

  const companyId = resolveCompanyIdFromApiKey(db, apiKey);
  if (!companyId) {
    sendJson(res, 401, { error: "Invalid or revoked API key" });
    return;
  }

  try {
    const raw = await readJson(req);
    if (!isDevicePayload(raw)) {
      sendJson(res, 400, {
        error:
          "Invalid body: require occurredAt (ISO), device.platform (web|ios|android). Optional: advertisingId, vendorId, installReferrer, deepLinkUrl, utm."
      });
      return;
    }
    const sessionId = createClientSession(db, companyId);
    const device = raw.device as import("../../../packages/contracts/src/device.js").DeviceDetails;
    persistBootstrapSnapshot(deviceDb, {
      companyId,
      sessionId,
      device,
      occurredAt: raw.occurredAt,
      ip: clientIp(req),
      userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null
    });
    sendJson(res, 201, { sessionId });
  } catch (e) {
    sendJson(res, 400, { error: e instanceof Error ? e.message : "Invalid JSON" });
  }
}
