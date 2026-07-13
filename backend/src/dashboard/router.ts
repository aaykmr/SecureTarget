import type { IncomingMessage, ServerResponse } from "node:http";
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

function applyDashboardCors(req: IncomingMessage, res: ServerResponse): void {
  const origin = process.env.DASHBOARD_CORS_ORIGIN ?? process.env.CORS_ORIGIN ?? "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
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
