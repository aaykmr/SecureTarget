import { createServer, type ServerResponse } from "node:http";
import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { IngestDb } from "./db/ingestDb.js";
import { handleIngest } from "./routes/ingest.js";
import { handleSessionBootstrap } from "./routes/sessionBootstrap.js";
import { handleClickRedirect } from "./routes/clickRedirect.js";
import { handleSkanPostback, handleCostIngest } from "./routes/skanPostback.js";
import { handleAppleAppSiteAssociation, handleAssetLinks } from "./routes/deepLinkConfig.js";
import { handleDashboardApi, isDashboardPath } from "./dashboard/router.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = process.env.EVENTIQN_ENV_PATH ?? resolve(__dirname, "../../.env");
loadEnv({ path: envPath });

const ingestDb = await IngestDb.open();
const pgPool = ingestDb.pool();
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
    await handleClickRedirect(req, res, ingestDb.customer(), ingestDb.device(), clickSlug);
    return;
  }

  const wellKnown = req.method === "GET" ? parseWellKnownCompany(req.url) : null;
  if (wellKnown?.type === "aasa") {
    await handleAppleAppSiteAssociation(req, res, ingestDb.customer(), wellKnown.companyId);
    return;
  }
  if (wellKnown?.type === "assetlinks") {
    await handleAssetLinks(req, res, ingestDb.customer(), wellKnown.companyId);
    return;
  }

  if (req.method === "POST" && req.url && requestPath(req.url) === bootstrapPath) {
    applyIngestCors(res);
    await handleSessionBootstrap(req, res, ingestDb);
    return;
  }

  if (req.method === "POST" && req.url && ingestPaths.includes(requestPath(req.url))) {
    applyIngestCors(res);
    await handleIngest(req, res, ingestDb);
    return;
  }

  if (req.method === "POST" && req.url && requestPath(req.url) === "/v1/skan/postback") {
    applyIngestCors(res);
    await handleSkanPostback(req, res, ingestDb);
    return;
  }

  if (req.method === "POST" && req.url && requestPath(req.url) === "/v1/costs") {
    applyIngestCors(res);
    await handleCostIngest(req, res, ingestDb);
    return;
  }

  if (req.method === "GET" && req.url === "/healthz") {
    res.statusCode = 200;
    res.end("ok");
    return;
  }

  const path = requestPath(req.url);
  if (pgPool && isDashboardPath(path)) {
    try {
      await handleDashboardApi(req, res, pgPool, path);
    } catch (e) {
      console.error("[dashboard] unhandled error", path, e);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Internal server error" }));
      }
    }
    return;
  }

  res.statusCode = 404;
  res.end("Not found");
});

server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(
    `EventIQN backend listening on :${port} (data: ${ingestDb.mode === "postgres" ? "postgres" : "sqlite"})`,
  );
});
