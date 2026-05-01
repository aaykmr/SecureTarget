import type { IncomingMessage, ServerResponse } from "node:http";
import type { Database } from "better-sqlite3";
import { validateIngestEvent } from "../../../packages/contracts/src/events.js";
import {
  isEventProcessed,
  markEventProcessed,
  resolveAndStoreAttribution,
  storeClick,
  storeLoginToken,
  storeSdkEvent
} from "../services/attribution.js";
import { resolveCompanyIdFromApiKey } from "../services/apiKeyAuth.js";
import { isClientSessionValid, touchClientSession } from "../services/clientSession.js";

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

function getSessionIdHeader(req: IncomingMessage): string | null {
  const h = req.headers["x-session-id"];
  return typeof h === "string" && h.trim().length > 0 ? h.trim() : null;
}

function ingestSessionRequired(): boolean {
  const v = process.env.INGEST_REQUIRE_SESSION;
  return v === "1" || v === "true";
}

function assertIngestSession(
  db: Database,
  companyId: string,
  req: IncomingMessage,
  res: ServerResponse
): boolean {
  const sessionId = getSessionIdHeader(req);
  if (ingestSessionRequired() && !sessionId) {
    sendJson(res, 401, {
      error: "Missing x-session-id. Create a session with POST /v1/session/bootstrap (send device details once), then retry."
    });
    return false;
  }
  if (sessionId && !isClientSessionValid(db, companyId, sessionId)) {
    sendJson(res, 403, { error: "Invalid or revoked session" });
    return false;
  }
  return true;
}

function touchIngestSession(db: Database, companyId: string, req: IncomingMessage): void {
  const sessionId = getSessionIdHeader(req);
  if (sessionId) {
    touchClientSession(db, companyId, sessionId);
  }
}

export async function handleIngest(req: IncomingMessage, res: ServerResponse, db: Database): Promise<void> {
  const apiKey = getApiKeyHeader(req);
  if (!apiKey) {
    sendJson(res, 401, { error: "Missing x-api-key" });
    return;
  }

  const companyIdFromKey = resolveCompanyIdFromApiKey(db, apiKey);
  if (!companyIdFromKey) {
    sendJson(res, 401, { error: "Invalid or revoked API key" });
    return;
  }

  if (!assertIngestSession(db, companyIdFromKey, req, res)) {
    return;
  }

  try {
    const raw = await readJson(req);
    const base = typeof raw === "object" && raw !== null && !Array.isArray(raw) ? raw : {};
    const merged = { ...base, companyId: companyIdFromKey };
    const payload = validateIngestEvent(merged);
    if (isEventProcessed(db, payload.eventId)) {
      touchIngestSession(db, companyIdFromKey, req);
      sendJson(res, 200, { ok: true, deduped: true });
      return;
    }

    if (payload.actionType === "click") {
      storeClick(db, payload);
      storeSdkEvent(db, payload.companyId, payload.actionType, payload);
      markEventProcessed(db, payload.eventId, payload.companyId, payload.actionType);
      touchIngestSession(db, companyIdFromKey, req);
      sendJson(res, 202, { ok: true });
      return;
    }

    if (payload.actionType === "login") {
      const tokenHash = storeLoginToken(db, payload);
      storeSdkEvent(db, payload.companyId, payload.actionType, { ...payload, token: "[redacted]" }, tokenHash);
      markEventProcessed(db, payload.eventId, payload.companyId, payload.actionType);
      touchIngestSession(db, companyIdFromKey, req);
      sendJson(res, 202, { ok: true });
      return;
    }

    if (payload.actionType === "conversion") {
      const result = resolveAndStoreAttribution(db, payload);
      storeSdkEvent(db, payload.companyId, payload.actionType, { ...payload, token: "[redacted]" });
      markEventProcessed(db, payload.eventId, payload.companyId, payload.actionType);
      touchIngestSession(db, companyIdFromKey, req);
      sendJson(res, 202, { ok: true, attribution: result });
      return;
    }
  } catch (error) {
    sendJson(res, 400, { error: error instanceof Error ? error.message : "Invalid request" });
  }
}
