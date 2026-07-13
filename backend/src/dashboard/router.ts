import type { IncomingMessage, ServerResponse } from "node:http";
import crypto from "node:crypto";
import type pg from "pg";
import { verifyAuthToken, signAuthToken } from "./jwt.js";
import {
  createApiKeyForProject,
  createProject,
  createUser,
  findUserByEmail,
  getProjectForUser,
  listApiKeysForProject,
  listProjectsForUser,
  revokeApiKey,
  verifyPassword,
} from "./repos.js";
import {
  campaignSummary,
  countSdkEvents,
  listInstallAttributions,
  listSdkEvents,
  listSkanPostbacks,
  organicVsNonOrganic,
  tokenHashForLookup,
} from "./analytics.js";
import {
  createTrackingLink,
  deleteTrackingLink,
  getAttributionSettings,
  getTrackingLinkForCompany,
  listTrackingLinks,
  updateTrackingLinkCampaignPresets,
  upsertAttributionSettings,
} from "../services/trackingLinks.js";

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function parseQuery(req: IncomingMessage): URLSearchParams {
  const url = req.url ?? "";
  const q = url.indexOf("?");
  return new URLSearchParams(q === -1 ? "" : url.slice(q + 1));
}

function applyDashboardCors(req: IncomingMessage, res: ServerResponse): void {
  const origin = process.env.DASHBOARD_CORS_ORIGIN ?? process.env.CORS_ORIGIN ?? "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Max-Age", "86400");
}

function getBearerUserId(req: IncomingMessage): { userId: string; email: string } | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  const payload = verifyAuthToken(auth.slice(7));
  if (!payload?.sub) return null;
  return { userId: payload.sub, email: payload.email };
}

function parseDashboardPath(path: string): string[] {
  const parts = path.replace(/^\/v1\//, "").split("/").filter(Boolean);
  return parts;
}

export async function handleDashboardApi(
  req: IncomingMessage,
  res: ServerResponse,
  db: pg.Pool,
  path: string,
): Promise<boolean> {
  applyDashboardCors(req, res);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return true;
  }

  const parts = parseDashboardPath(path);

  // POST /v1/auth/register
  if (req.method === "POST" && parts[0] === "auth" && parts[1] === "register") {
    try {
      const body = (await readJsonBody(req)) as { email?: string; password?: string };
      const email = String(body.email ?? "").trim();
      const password = String(body.password ?? "");
      if (!email || !password) {
        sendJson(res, 400, { error: "Email and password are required." });
        return true;
      }
      if (password.length < 8) {
        sendJson(res, 400, { error: "Password must be at least 8 characters." });
        return true;
      }
      if (await findUserByEmail(db, email)) {
        sendJson(res, 409, { error: "An account with this email already exists." });
        return true;
      }
      const user = await createUser(db, email, password);
      sendJson(res, 201, { ok: true, userId: user.id });
    } catch {
      sendJson(res, 500, { error: "Registration failed." });
    }
    return true;
  }

  // POST /v1/auth/login
  if (req.method === "POST" && parts[0] === "auth" && parts[1] === "login") {
    try {
      const body = (await readJsonBody(req)) as { email?: string; password?: string };
      const email = String(body.email ?? "").trim();
      const password = String(body.password ?? "");
      const user = await findUserByEmail(db, email);
      if (!user || !verifyPassword(user, password)) {
        sendJson(res, 401, { error: "Invalid email or password." });
        return true;
      }
      const token = signAuthToken(user.id, user.email);
      sendJson(res, 200, { token, user: { id: user.id, email: user.email } });
    } catch {
      sendJson(res, 500, { error: "Login failed." });
    }
    return true;
  }

  // GET /v1/auth/me
  if (req.method === "GET" && parts[0] === "auth" && parts[1] === "me") {
    const auth = getBearerUserId(req);
    if (!auth) {
      sendJson(res, 401, { error: "Unauthorized" });
      return true;
    }
    sendJson(res, 200, { user: { id: auth.userId, email: auth.email } });
    return true;
  }

  // POST /v1/auth/forgot-password (stub — email delivery not wired yet)
  if (req.method === "POST" && parts[0] === "auth" && parts[1] === "forgot-password") {
    try {
      const body = (await readJsonBody(req)) as { email?: string };
      void String(body.email ?? "").trim();
      sendJson(res, 200, { ok: true });
    } catch {
      sendJson(res, 500, { error: "Request failed." });
    }
    return true;
  }

  // POST /v1/auth/reset-password (stub — token verification + email not wired yet)
  if (req.method === "POST" && parts[0] === "auth" && parts[1] === "reset-password") {
    try {
      const body = (await readJsonBody(req)) as { token?: string; password?: string };
      const token = String(body.token ?? "").trim();
      const password = String(body.password ?? "");
      if (!token || !password) {
        sendJson(res, 400, { error: "Token and password are required." });
        return true;
      }
      if (password.length < 8) {
        sendJson(res, 400, { error: "Password must be at least 8 characters." });
        return true;
      }
      sendJson(res, 501, { error: "Password reset is not enabled yet" });
    } catch {
      sendJson(res, 500, { error: "Request failed." });
    }
    return true;
  }

  const auth = getBearerUserId(req);
  if (!auth) {
    sendJson(res, 401, { error: "Unauthorized" });
    return true;
  }

  // GET /v1/projects
  if (req.method === "GET" && parts[0] === "projects" && parts.length === 1) {
    const projects = await listProjectsForUser(db, auth.userId);
    sendJson(res, 200, { projects });
    return true;
  }

  // POST /v1/projects
  if (req.method === "POST" && parts[0] === "projects" && parts.length === 1) {
    const body = (await readJsonBody(req)) as { name?: string };
    const name = String(body.name ?? "").trim();
    if (!name) {
      sendJson(res, 400, { error: "Project name is required." });
      return true;
    }
    const project = await createProject(db, auth.userId, name);
    sendJson(res, 201, { project });
    return true;
  }

  // GET /v1/projects/:id
  if (req.method === "GET" && parts[0] === "projects" && parts.length === 2) {
    const project = await getProjectForUser(db, parts[1]!, auth.userId);
    if (!project) {
      sendJson(res, 404, { error: "Project not found." });
      return true;
    }
    sendJson(res, 200, { project });
    return true;
  }

  // GET /v1/projects/:id/api-keys
  if (req.method === "GET" && parts[0] === "projects" && parts[2] === "api-keys" && parts.length === 3) {
    const project = await getProjectForUser(db, parts[1]!, auth.userId);
    if (!project) {
      sendJson(res, 404, { error: "Project not found." });
      return true;
    }
    const keys = await listApiKeysForProject(db, project.id);
    sendJson(res, 200, { apiKeys: keys });
    return true;
  }

  // POST /v1/projects/:id/api-keys
  if (req.method === "POST" && parts[0] === "projects" && parts[2] === "api-keys" && parts.length === 3) {
    const project = await getProjectForUser(db, parts[1]!, auth.userId);
    if (!project) {
      sendJson(res, 404, { error: "Project not found." });
      return true;
    }
    const { fullKey, row } = await createApiKeyForProject(db, project.id);
    sendJson(res, 201, { apiKey: row, fullKey });
    return true;
  }

  // DELETE /v1/projects/:id/api-keys/:keyId
  if (
    req.method === "DELETE" &&
    parts[0] === "projects" &&
    parts[2] === "api-keys" &&
    parts.length === 4
  ) {
    const project = await getProjectForUser(db, parts[1]!, auth.userId);
    if (!project) {
      sendJson(res, 404, { error: "Project not found." });
      return true;
    }
    const ok = await revokeApiKey(db, project.id, parts[3]!);
    sendJson(res, ok ? 200 : 404, { ok });
    return true;
  }

  const projectId = parts[1]!;
  const project = await getProjectForUser(db, projectId, auth.userId);

  // GET /v1/projects/:id/events
  if (req.method === "GET" && parts[0] === "projects" && parts[2] === "events" && parts.length === 3) {
    if (!project) {
      sendJson(res, 404, { error: "Project not found." });
      return true;
    }
    const query = parseQuery(req);
    const pageSize = 50;
    const allowedAction = new Set(["record", "login", "conversion", "custom", "install"]);
    const actionType = query.get("actionType");
    const eventLabel = query.get("event")?.trim().slice(0, 500) ?? "";
    const token = query.get("token")?.trim() ?? "";
    const filter = {
      ...(actionType && allowedAction.has(actionType) ? { actionType } : {}),
      ...(eventLabel ? { eventLabel } : {}),
      ...(token ? { tokenHash: tokenHashForLookup(project.company_id, token) } : {}),
    };
    const total = await countSdkEvents(db, project.company_id, filter);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const requested = Math.max(1, parseInt(query.get("page") ?? "1", 10) || 1);
    const page = Math.min(requested, totalPages);
    const events = await listSdkEvents(db, project.company_id, {
      ...filter,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    sendJson(res, 200, { events, total, page, pageSize, totalPages });
    return true;
  }

  // GET /v1/projects/:id/links
  if (req.method === "GET" && parts[0] === "projects" && parts[2] === "links" && parts.length === 3) {
    if (!project) {
      sendJson(res, 404, { error: "Project not found." });
      return true;
    }
    const links = await listTrackingLinks(db, project.company_id);
    sendJson(res, 200, { links });
    return true;
  }

  // POST /v1/projects/:id/links
  if (req.method === "POST" && parts[0] === "projects" && parts[2] === "links" && parts.length === 3) {
    if (!project) {
      sendJson(res, 404, { error: "Project not found." });
      return true;
    }
    try {
      const body = (await readJsonBody(req)) as {
        name?: string;
        slug?: string;
        iosUrl?: string;
        androidUrl?: string;
        webUrl?: string;
      };
      const name = String(body.name ?? "").trim();
      const slug = String(body.slug ?? "").trim().toLowerCase();
      if (!name || !slug) {
        sendJson(res, 400, { error: "Name and slug are required." });
        return true;
      }
      if (!/^[a-z0-9-]+$/.test(slug)) {
        sendJson(res, 400, { error: "Slug must be lowercase alphanumeric with hyphens." });
        return true;
      }
      const link = await createTrackingLink(db, {
        companyId: project.company_id,
        name,
        slug,
        destinationType: "multi",
        iosUrl: body.iosUrl?.trim() || undefined,
        androidUrl: body.androidUrl?.trim() || undefined,
        webUrl: body.webUrl?.trim() || undefined,
      });
      sendJson(res, 201, { link });
    } catch (e) {
      sendJson(res, 500, { error: e instanceof Error ? e.message : "Failed to create link." });
    }
    return true;
  }

  // DELETE /v1/projects/:id/links/:linkId
  if (req.method === "DELETE" && parts[0] === "projects" && parts[2] === "links" && parts.length === 4) {
    if (!project) {
      sendJson(res, 404, { error: "Project not found." });
      return true;
    }
    const ok = await deleteTrackingLink(db, project.company_id, parts[3]!);
    sendJson(res, ok ? 200 : 404, { ok });
    return true;
  }

  // POST /v1/projects/:id/links/:linkId/presets
  if (req.method === "POST" && parts[0] === "projects" && parts[2] === "links" && parts[4] === "presets" && parts.length === 5) {
    if (!project) {
      sendJson(res, 404, { error: "Project not found." });
      return true;
    }
    const linkId = parts[3]!;
    const link = await getTrackingLinkForCompany(db, project.company_id, linkId);
    if (!link) {
      sendJson(res, 404, { error: "Link not found." });
      return true;
    }
    const body = (await readJsonBody(req)) as {
      label?: string;
      mediaSource?: string;
      campaignId?: string;
      adgroupId?: string;
      creativeId?: string;
      deepLinkValue?: string;
    };
    const label = String(body.label ?? "").trim();
    const mediaSource = String(body.mediaSource ?? "").trim();
    const campaignId = String(body.campaignId ?? "").trim();
    if (!label || !mediaSource || !campaignId) {
      sendJson(res, 400, { error: "Label, media source, and campaign are required." });
      return true;
    }
    const presets = link.campaign_presets_json ? (JSON.parse(link.campaign_presets_json) as unknown[]) : [];
    presets.push({
      id: crypto.randomUUID(),
      label,
      mediaSource,
      campaignId,
      adgroupId: body.adgroupId?.trim() || undefined,
      creativeId: body.creativeId?.trim() || undefined,
      deepLinkValue: body.deepLinkValue?.trim() || undefined,
    });
    await updateTrackingLinkCampaignPresets(db, project.company_id, linkId, JSON.stringify(presets));
    sendJson(res, 201, { ok: true });
    return true;
  }

  // DELETE /v1/projects/:id/links/:linkId/presets/:presetId
  if (
    req.method === "DELETE" &&
    parts[0] === "projects" &&
    parts[2] === "links" &&
    parts[4] === "presets" &&
    parts.length === 6
  ) {
    if (!project) {
      sendJson(res, 404, { error: "Project not found." });
      return true;
    }
    const linkId = parts[3]!;
    const presetId = parts[5]!;
    const link = await getTrackingLinkForCompany(db, project.company_id, linkId);
    if (!link) {
      sendJson(res, 404, { error: "Link not found." });
      return true;
    }
    const presets = (link.campaign_presets_json ? JSON.parse(link.campaign_presets_json) : []) as { id: string }[];
    const next = presets.filter((p) => p.id !== presetId);
    await updateTrackingLinkCampaignPresets(db, project.company_id, linkId, JSON.stringify(next));
    sendJson(res, 200, { ok: true });
    return true;
  }

  // GET /v1/projects/:id/settings
  if (req.method === "GET" && parts[0] === "projects" && parts[2] === "settings" && parts.length === 3) {
    if (!project) {
      sendJson(res, 404, { error: "Project not found." });
      return true;
    }
    const settings = await getAttributionSettings(db, project.company_id);
    sendJson(res, 200, { settings, companyId: project.company_id });
    return true;
  }

  // PUT /v1/projects/:id/settings
  if (req.method === "PUT" && parts[0] === "projects" && parts[2] === "settings" && parts.length === 3) {
    if (!project) {
      sendJson(res, 404, { error: "Project not found." });
      return true;
    }
    const body = (await readJsonBody(req)) as {
      iosAppId?: string;
      androidPackage?: string;
      iosTeamId?: string;
      associatedDomain?: string;
      partnerPostbackUrl?: string;
      androidSha256Certs?: string[];
      skanIds?: string[];
      installAttributionWindowHours?: number;
      enableProbabilisticMatching?: boolean;
    };
    await upsertAttributionSettings(db, project.company_id, {
      iosAppId: body.iosAppId?.trim() || null,
      androidPackage: body.androidPackage?.trim() || null,
      iosTeamId: body.iosTeamId?.trim() || null,
      associatedDomain: body.associatedDomain?.trim() || null,
      partnerPostbackUrl: body.partnerPostbackUrl?.trim() || null,
      androidSha256Certs: body.androidSha256Certs,
      skanIds: body.skanIds,
      installAttributionWindowHours: body.installAttributionWindowHours,
      enableProbabilisticMatching: body.enableProbabilisticMatching,
    });
    sendJson(res, 200, { ok: true });
    return true;
  }

  // GET /v1/projects/:id/campaigns/summary
  if (req.method === "GET" && parts[0] === "projects" && parts[2] === "campaigns" && parts[3] === "summary" && parts.length === 4) {
    if (!project) {
      sendJson(res, 404, { error: "Project not found." });
      return true;
    }
    const query = parseQuery(req);
    const summary = await campaignSummary(db, project.company_id, query.get("from") ?? undefined, query.get("to") ?? undefined);
    const organic = await organicVsNonOrganic(db, project.company_id);
    sendJson(res, 200, { summary, organic });
    return true;
  }

  // GET /v1/projects/:id/attribution/installs
  if (req.method === "GET" && parts[0] === "projects" && parts[2] === "attribution" && parts[3] === "installs" && parts.length === 4) {
    if (!project) {
      sendJson(res, 404, { error: "Project not found." });
      return true;
    }
    const limit = Math.min(200, Math.max(1, parseInt(parseQuery(req).get("limit") ?? "50", 10) || 50));
    const installs = await listInstallAttributions(db, project.company_id, limit);
    sendJson(res, 200, { installs });
    return true;
  }

  // GET /v1/projects/:id/skan/postbacks
  if (req.method === "GET" && parts[0] === "projects" && parts[2] === "skan" && parts[3] === "postbacks" && parts.length === 4) {
    if (!project) {
      sendJson(res, 404, { error: "Project not found." });
      return true;
    }
    const limit = Math.min(200, Math.max(1, parseInt(parseQuery(req).get("limit") ?? "50", 10) || 50));
    const postbacks = await listSkanPostbacks(db, project.company_id, limit);
    sendJson(res, 200, { postbacks });
    return true;
  }

  sendJson(res, 404, { error: "Not found" });
  return true;
}

export function isDashboardPath(path: string): boolean {
  return path === "/v1/auth/register" ||
    path === "/v1/auth/login" ||
    path === "/v1/auth/me" ||
    path.startsWith("/v1/projects") ||
    path.startsWith("/v1/auth/");
}
