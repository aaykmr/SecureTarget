import { createServer, type ServerResponse } from "node:http";
import { config as loadEnv } from "dotenv";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createDb } from "./db/client.js";
import { createDeviceDb } from "./db/deviceClient.js";
import { handleIngest } from "./routes/ingest.js";
import { handleSessionBootstrap } from "./routes/sessionBootstrap.js";
import { handleClickRedirect } from "./routes/clickRedirect.js";
import { handleSkanPostback, handleCostIngest } from "./routes/skanPostback.js";
import { handleAppleAppSiteAssociation, handleAssetLinks } from "./routes/deepLinkConfig.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = process.env.SECURETARGET_ENV_PATH ?? resolve(__dirname, "../../.env");
loadEnv({ path: envPath });

const repoRoot = resolve(__dirname, "../..");
function resolveDbPath(configured: string): string {
  if (configured === ":memory:") return configured;
  if (isAbsolute(configured)) return configured;
  return resolve(repoRoot, configured);
}

const dbPath = resolveDbPath(process.env.SECURETARGET_DB_PATH ?? "securetarget.sqlite");
const deviceDbPath = resolveDbPath(process.env.SECURETARGET_DEVICE_DB_PATH ?? "securetarget-device.sqlite");
const db = createDb(dbPath);
const deviceDb = createDeviceDb(deviceDbPath);
const port = Number(process.env.PORT ?? 8080);

const ingestPaths = ["/v1/record"];
const bootstrapPath = "/v1/session/bootstrap";
const corsPostPaths = [...ingestPaths, bootstrapPath, "/v1/skan/postback", "/v1/costs"];

function requestPath(url: string): string {
  const q = url.indexOf("?");
  let p = q === -1 ? url : url.slice(0, q);
  if (p.length > 1 && p.endsWith("/")) {
    p = p.slice(0, -1);
  }
  return p;
}

function isCorsIngestPath(url: string): boolean {
  return corsPostPaths.includes(requestPath(url));
}

function applyIngestCors(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", process.env.CORS_ORIGIN ?? "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-api-key, x-session-id");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Max-Age", "86400");
}

function parseClickSlug(url: string): string | null {
  const path = requestPath(url);
  const prefix = "/v1/l/";
  if (!path.startsWith(prefix)) return null;
  const slug = path.slice(prefix.length);
  return slug.length > 0 ? slug : null;
}

function parseWellKnownCompany(url: string): { type: "aasa" | "assetlinks"; companyId: string } | null {
  const path = requestPath(url);
  const aasaMatch = path.match(/^\/\.well-known\/apple-app-site-association\/([^/]+)$/);
  if (aasaMatch) return { type: "aasa", companyId: aasaMatch[1]! };
  const assetMatch = path.match(/^\/\.well-known\/assetlinks\.json\/([^/]+)$/);
  if (assetMatch) return { type: "assetlinks", companyId: assetMatch[1]! };
  return null;
}

const server = createServer(async (req, res) => {
  if (!req.url || !req.method) {
    res.statusCode = 400;
    res.end("Bad request");
    return;
  }

  if (req.method === "OPTIONS" && req.url && isCorsIngestPath(req.url)) {
    applyIngestCors(res);
    res.statusCode = 204;
    res.end();
    return;
  }

  const clickSlug = req.method === "GET" ? parseClickSlug(req.url) : null;
  if (clickSlug) {
    await handleClickRedirect(req, res, db, deviceDb, clickSlug);
    return;
  }

  const wellKnown = req.method === "GET" ? parseWellKnownCompany(req.url) : null;
  if (wellKnown?.type === "aasa") {
    handleAppleAppSiteAssociation(req, res, db, wellKnown.companyId);
    return;
  }
  if (wellKnown?.type === "assetlinks") {
    handleAssetLinks(req, res, db, wellKnown.companyId);
    return;
  }

  if (req.method === "POST" && req.url && requestPath(req.url) === bootstrapPath) {
    applyIngestCors(res);
    await handleSessionBootstrap(req, res, db, deviceDb);
    return;
  }

  if (req.method === "POST" && req.url && ingestPaths.includes(requestPath(req.url))) {
    applyIngestCors(res);
    await handleIngest(req, res, db, deviceDb);
    return;
  }

  if (req.method === "POST" && req.url && requestPath(req.url) === "/v1/skan/postback") {
    applyIngestCors(res);
    await handleSkanPostback(req, res, deviceDb, db);
    return;
  }

  if (req.method === "POST" && req.url && requestPath(req.url) === "/v1/costs") {
    applyIngestCors(res);
    await handleCostIngest(req, res, deviceDb, db);
    return;
  }

  if (req.method === "GET" && req.url === "/healthz") {
    res.statusCode = 200;
    res.end("ok");
    return;
  }

  res.statusCode = 404;
  res.end("Not found");
});

server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`SecureTarget backend listening on :${port} (db: ${dbPath}, deviceDb: ${deviceDbPath})`);
});
