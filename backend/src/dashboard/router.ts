import type { IncomingMessage, ServerResponse } from "node:http";
import crypto from "node:crypto";
import type pg from "pg";
import { verifyAuthToken, signAuthToken } from "./jwt.js";
import {
  createApiKeyForProject,
  createProject,
  findUserByEmail,
  getProjectForUser,
  listApiKeysForProject,
  listProjectsForUser,
  revokeApiKey,
  verifyPassword,
} from "./repos.js";
import {
  acceptInvite,
  createGlobalAdminUser,
  createInvite,
  createMemberUser,
  createOrganization,
  createPersonalOrganizationForUser,
  findUserById,
  getInviteByRawToken,
  getOrganization,
  isGlobalAdminEmail,
  isOrgMember,
  isOrgOwner,
  listOrgMembers,
  listOrganizations,
  listOrganizationsForUser,
  listOrganizationsPaginated,
  listOrganizationsWithAccess,
  listPendingInvites,
  updateMemberPermissions,
  userHasOrgTab,
  type OrgTabKey,
  type OrgTabPermissions,
} from "./organizations.js";
import { sendInviteEmail } from "../services/email.js";
import {
  createWaitlistInquiry,
  getWaitlistInquiry,
  linkInquiryOrganization,
  listWaitlistInquiries,
  setWaitlistInquiryDisabled,
} from "./waitlist.js";
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
  isLinkType,
  listTrackingLinks,
  parseLinkConfig,
  updateTrackingLinkCampaignPresets,
  upsertAttributionSettings,
  type LinkConfig,
  type LinkType,
} from "../services/trackingLinks.js";

function appBaseUrl(): string {
  return (
    process.env.APP_PUBLIC_URL?.trim() ||
    process.env.VITE_APP_URL?.trim() ||
    "http://localhost:5173"
  ).replace(/\/$/, "");
}

function inviteUrlForToken(token: string): string {
  return `${appBaseUrl()}/invite?token=${encodeURIComponent(token)}`;
}

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
  const configured =
    process.env.DASHBOARD_CORS_ORIGIN?.trim() ||
    process.env.CORS_ORIGIN?.trim() ||
    "*";
  const requestOrigin = String(req.headers.origin ?? "").trim();

  let allowOrigin = configured;
  if (configured === "*") {
    // Reflect Origin when present so credentialed/local-dev browsers stay happy.
    allowOrigin = requestOrigin || "*";
  } else if (requestOrigin) {
    const allowed = configured.split(",").map((o) => o.trim()).filter(Boolean);
    if (allowed.includes(requestOrigin)) {
      allowOrigin = requestOrigin;
    }
  }

  res.setHeader("Access-Control-Allow-Origin", allowOrigin);
  if (allowOrigin !== "*") {
    res.setHeader("Vary", "Origin");
  }
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Access-Control-Request-Private-Network",
  );
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Max-Age", "86400");

  // Chrome Private Network Access / local-network preflight (localhost:3000 → :8080)
  if (String(req.headers["access-control-request-private-network"] ?? "").toLowerCase() === "true") {
    res.setHeader("Access-Control-Allow-Private-Network", "true");
  }
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

  // POST /v1/auth/register — public signup disabled
  if (req.method === "POST" && parts[0] === "auth" && parts[1] === "register") {
    sendJson(res, 403, { error: "Public registration is disabled. Request access via the waitlist." });
    return true;
  }

  // POST /v1/auth/sign-up-internal — open signup (allowlisted emails become global_admin)
  if (req.method === "POST" && parts[0] === "auth" && parts[1] === "sign-up-internal") {
    try {
      const body = (await readJsonBody(req)) as {
        email?: string;
        password?: string;
        confirmPassword?: string;
        passwordConfirm?: string;
      };
      const email = String(body.email ?? "").trim();
      const password = String(body.password ?? "");
      const confirmPassword = String(body.confirmPassword ?? body.passwordConfirm ?? "");
      if (!email || !password) {
        sendJson(res, 400, { error: "Email and password are required." });
        return true;
      }
      if (password !== confirmPassword) {
        sendJson(res, 400, { error: "Passwords do not match." });
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
      const asAdmin = isGlobalAdminEmail(email);
      const user = asAdmin
        ? await createGlobalAdminUser(db, email, password)
        : await createMemberUser(db, email, password);
      if (!asAdmin) {
        await createPersonalOrganizationForUser(db, user);
      }
      const token = signAuthToken(user.id, user.email);
      sendJson(res, 201, {
        token,
        user: { id: user.id, email: user.email, role: user.role },
      });
    } catch {
      sendJson(res, 500, { error: "Registration failed." });
    }
    return true;
  }

  // POST /v1/auth/accept-invite
  if (req.method === "POST" && parts[0] === "auth" && parts[1] === "accept-invite") {
    try {
      const body = (await readJsonBody(req)) as {
        token?: string;
        password?: string;
        confirmPassword?: string;
      };
      const token = String(body.token ?? "").trim();
      const password = String(body.password ?? "");
      const confirmPassword = String(body.confirmPassword ?? "");
      if (!token || !password) {
        sendJson(res, 400, { error: "Token and password are required." });
        return true;
      }
      if (password !== confirmPassword) {
        sendJson(res, 400, { error: "Passwords do not match." });
        return true;
      }
      if (password.length < 8) {
        sendJson(res, 400, { error: "Password must be at least 8 characters." });
        return true;
      }
      const user = await acceptInvite(db, token, password);
      const jwt = signAuthToken(user.id, user.email);
      sendJson(res, 200, {
        token: jwt,
        user: { id: user.id, email: user.email, role: user.role },
      });
    } catch (e) {
      sendJson(res, 400, { error: e instanceof Error ? e.message : "Invite acceptance failed." });
    }
    return true;
  }

  // GET /v1/invites/:token — public preview
  if (req.method === "GET" && parts[0] === "invites" && parts.length === 2) {
    const invite = await getInviteByRawToken(db, parts[1]!);
    if (!invite || invite.accepted_at || new Date(invite.expires_at).getTime() < Date.now()) {
      sendJson(res, 404, { error: "Invite not found or expired." });
      return true;
    }
    sendJson(res, 200, {
      invite: {
        email: invite.email,
        organizationName: invite.organization_name,
        expiresAt: invite.expires_at,
      },
    });
    return true;
  }

  // POST /v1/waitlist — public homepage inquiries
  if (req.method === "POST" && parts[0] === "waitlist" && parts.length === 1) {
    try {
      const body = (await readJsonBody(req)) as {
        name?: string;
        email?: string;
        phone?: string;
        organization?: string;
        message?: string;
      };
      const name = String(body.name ?? "").trim();
      const email = String(body.email ?? "").trim().toLowerCase();
      const phone = String(body.phone ?? "").trim();
      const organization = String(body.organization ?? "").trim();
      const message = String(body.message ?? "").trim();

      if (!name || name.length < 2) {
        sendJson(res, 400, { error: "Name is required." });
        return true;
      }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        sendJson(res, 400, { error: "A valid work email is required." });
        return true;
      }
      if (!organization) {
        sendJson(res, 400, { error: "Organization is required." });
        return true;
      }
      if (phone) {
        const normalized = phone.replace(/[\s-]/g, "");
        if (!/^\+[1-9]\d{6,14}$/.test(normalized)) {
          sendJson(res, 400, { error: "Enter a valid phone number with country code." });
          return true;
        }
      }

      const inquiry = await createWaitlistInquiry(db, {
        name,
        email,
        phone: phone || null,
        organization,
        message,
      });
      sendJson(res, 201, { ok: true, id: inquiry.id });
    } catch {
      sendJson(res, 500, { error: "Could not submit inquiry." });
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
      sendJson(res, 200, {
        token,
        user: { id: user.id, email: user.email, role: user.role },
      });
    } catch {
      sendJson(res, 500, { error: "Login failed." });
    }
    return true;
  }

  // GET /v1/auth/me
  if (req.method === "GET" && parts[0] === "auth" && parts[1] === "me") {
    try {
      const auth = getBearerUserId(req);
      if (!auth) {
        sendJson(res, 401, { error: "Unauthorized" });
        return true;
      }
      const user = await findUserById(db, auth.userId);
      if (!user) {
        sendJson(res, 401, { error: "Unauthorized" });
        return true;
      }
      const organizations = await listOrganizationsWithAccess(
        db,
        user.id,
        user.role === "global_admin",
      );
      sendJson(res, 200, {
        user: { id: user.id, email: user.email, role: user.role },
        organizations,
      });
    } catch (e) {
      console.error("[dashboard] /v1/auth/me failed", e);
      sendJson(res, 500, { error: "Failed to load session." });
    }
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

  const user = await findUserById(db, auth.userId);
  if (!user) {
    sendJson(res, 401, { error: "Unauthorized" });
    return true;
  }
  const isAdmin = user.role === "global_admin";

  async function requireOrgAccess(orgId: string): Promise<boolean> {
    if (isAdmin) return true;
    return isOrgMember(db, orgId, user!.id);
  }

  async function requireOrgOwner(orgId: string): Promise<boolean> {
    if (isAdmin) return true;
    return isOrgOwner(db, orgId, user!.id);
  }

  async function requireTab(orgId: string, tab: OrgTabKey): Promise<boolean> {
    return userHasOrgTab(db, orgId, user!.id, tab, isAdmin);
  }

  async function requireProjectTab(projectOrgId: string | null, tab: OrgTabKey): Promise<boolean> {
    if (!projectOrgId) return isAdmin;
    return requireTab(projectOrgId, tab);
  }

  // GET /v1/waitlist — global admin inquiries
  if (req.method === "GET" && parts[0] === "waitlist" && parts.length === 1) {
    if (!isAdmin) {
      sendJson(res, 403, { error: "Global admin required." });
      return true;
    }
    const query = parseQuery(req);
    const statusRaw = query.get("status") ?? "all";
    const status =
      statusRaw === "open" || statusRaw === "converted" || statusRaw === "disabled"
        ? statusRaw
        : "all";
    const result = await listWaitlistInquiries(db, {
      q: query.get("q") ?? undefined,
      page: parseInt(query.get("page") ?? "1", 10) || 1,
      pageSize: parseInt(query.get("pageSize") ?? "20", 10) || 20,
      status,
    });
    sendJson(res, 200, result);
    return true;
  }

  // POST /v1/waitlist/:id/disable  { disabled?: boolean }
  if (
    req.method === "POST" &&
    parts[0] === "waitlist" &&
    parts[2] === "disable" &&
    parts.length === 3
  ) {
    if (!isAdmin) {
      sendJson(res, 403, { error: "Global admin required." });
      return true;
    }
    const body = (await readJsonBody(req)) as { disabled?: boolean };
    const disabled = body.disabled !== false;
    const inquiry = await setWaitlistInquiryDisabled(db, parts[1]!, disabled);
    if (!inquiry) {
      sendJson(res, 404, { error: "Inquiry not found." });
      return true;
    }
    sendJson(res, 200, { inquiry });
    return true;
  }

  // POST /v1/waitlist/:id/create-organization
  if (
    req.method === "POST" &&
    parts[0] === "waitlist" &&
    parts[2] === "create-organization" &&
    parts.length === 3
  ) {
    if (!isAdmin) {
      sendJson(res, 403, { error: "Global admin required." });
      return true;
    }
    const inquiry = await getWaitlistInquiry(db, parts[1]!);
    if (!inquiry) {
      sendJson(res, 404, { error: "Inquiry not found." });
      return true;
    }
    if (inquiry.disabled_at) {
      sendJson(res, 400, { error: "This inquiry is disabled." });
      return true;
    }
    if (inquiry.created_organization_id) {
      sendJson(res, 409, { error: "An organization was already created from this inquiry." });
      return true;
    }
    const body = (await readJsonBody(req)) as { name?: string };
    const name = String(body.name ?? inquiry.organization).trim();
    if (!name) {
      sendJson(res, 400, { error: "Organization name is required." });
      return true;
    }
    const organization = await createOrganization(db, name, user.id);
    await linkInquiryOrganization(db, inquiry.id, organization.id);
    sendJson(res, 201, { organization, inquiryId: inquiry.id });
    return true;
  }

  // GET /v1/organizations
  if (req.method === "GET" && parts[0] === "organizations" && parts.length === 1) {
    const query = parseQuery(req);
    const pageRaw = query.get("page");
    const pageSizeRaw = query.get("pageSize");
    const q = query.get("q") ?? undefined;
    const wantsPaged = pageRaw != null || pageSizeRaw != null || q != null;

    if (wantsPaged) {
      const result = await listOrganizationsPaginated(db, {
        q,
        page: parseInt(pageRaw ?? "1", 10) || 1,
        pageSize: parseInt(pageSizeRaw ?? "20", 10) || 20,
        forUserId: isAdmin ? undefined : user.id,
      });
      sendJson(res, 200, result);
      return true;
    }

    if (!isAdmin) {
      const organizations = await listOrganizationsForUser(db, user.id);
      sendJson(res, 200, { organizations });
      return true;
    }
    const organizations = await listOrganizations(db);
    sendJson(res, 200, { organizations });
    return true;
  }

  // POST /v1/organizations
  if (req.method === "POST" && parts[0] === "organizations" && parts.length === 1) {
    if (!isAdmin) {
      sendJson(res, 403, { error: "Global admin required." });
      return true;
    }
    const body = (await readJsonBody(req)) as { name?: string };
    const name = String(body.name ?? "").trim();
    if (!name) {
      sendJson(res, 400, { error: "Organization name is required." });
      return true;
    }
    const organization = await createOrganization(db, name, user.id);
    sendJson(res, 201, { organization });
    return true;
  }

  // GET /v1/organizations/:id
  if (req.method === "GET" && parts[0] === "organizations" && parts.length === 2) {
    const org = await getOrganization(db, parts[1]!);
    if (!org || !(await requireOrgAccess(org.id))) {
      sendJson(res, 404, { error: "Organization not found." });
      return true;
    }
    sendJson(res, 200, { organization: org });
    return true;
  }

  // GET /v1/organizations/:id/members
  if (
    req.method === "GET" &&
    parts[0] === "organizations" &&
    parts[2] === "members" &&
    parts.length === 3
  ) {
    const orgId = parts[1]!;
    if (!(await requireOrgAccess(orgId))) {
      sendJson(res, 404, { error: "Organization not found." });
      return true;
    }
    if (!(await requireTab(orgId, "users"))) {
      sendJson(res, 403, { error: "Users tab permission required." });
      return true;
    }
    const members = await listOrgMembers(db, orgId);
    const pendingInvites = await listPendingInvites(db, orgId);
    sendJson(res, 200, {
      members,
      pendingInvites: pendingInvites.map((i) => ({
        id: i.id,
        email: i.email,
        expiresAt: i.expires_at,
        createdAt: i.created_at,
      })),
    });
    return true;
  }

  // PATCH /v1/organizations/:id/members/:userId
  if (
    req.method === "PATCH" &&
    parts[0] === "organizations" &&
    parts[2] === "members" &&
    parts.length === 4
  ) {
    const orgId = parts[1]!;
    const targetUserId = parts[3]!;
    if (!(await requireOrgAccess(orgId))) {
      sendJson(res, 404, { error: "Organization not found." });
      return true;
    }
    if (!(await requireOrgOwner(orgId))) {
      sendJson(res, 403, { error: "Organization owner required." });
      return true;
    }
    const body = (await readJsonBody(req)) as { permissions?: Partial<OrgTabPermissions> };
    if (!body.permissions || typeof body.permissions !== "object") {
      sendJson(res, 400, { error: "permissions object is required." });
      return true;
    }
    try {
      const member = await updateMemberPermissions(db, orgId, targetUserId, body.permissions);
      if (!member) {
        sendJson(res, 404, { error: "Member not found." });
        return true;
      }
      sendJson(res, 200, { member });
    } catch (e) {
      sendJson(res, 400, { error: e instanceof Error ? e.message : "Could not update permissions." });
    }
    return true;
  }

  // POST /v1/organizations/:id/invites
  if (
    req.method === "POST" &&
    parts[0] === "organizations" &&
    parts[2] === "invites" &&
    parts.length === 3
  ) {
    const orgId = parts[1]!;
    if (!(await requireOrgAccess(orgId))) {
      sendJson(res, 404, { error: "Organization not found." });
      return true;
    }
    if (!(await requireOrgOwner(orgId))) {
      sendJson(res, 403, { error: "Organization owner required." });
      return true;
    }
    const org = await getOrganization(db, orgId);
    if (!org) {
      sendJson(res, 404, { error: "Organization not found." });
      return true;
    }
    const body = (await readJsonBody(req)) as { email?: string };
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
      sendJson(res, 400, { error: "A valid email is required." });
      return true;
    }
    const { invite, rawToken } = await createInvite(db, {
      organizationId: orgId,
      email,
      invitedByUserId: user.id,
    });
    const inviteUrl = inviteUrlForToken(rawToken);
    const emailResult = await sendInviteEmail({
      to: email,
      organizationName: org.name,
      inviteUrl,
    });
    sendJson(res, 201, {
      invite: {
        id: invite.id,
        email: invite.email,
        expiresAt: invite.expires_at,
      },
      inviteUrl,
      emailSent: emailResult.sent,
      emailError: emailResult.error ?? null,
    });
    return true;
  }

  // GET /v1/projects
  if (req.method === "GET" && parts[0] === "projects" && parts.length === 1) {
    const organizationId = parseQuery(req).get("organizationId") ?? undefined;
    if (organizationId) {
      if (!(await requireOrgAccess(organizationId))) {
        sendJson(res, 403, { error: "Not a member of this organization." });
        return true;
      }
      if (!(await requireTab(organizationId, "projects"))) {
        sendJson(res, 403, { error: "Projects permission required." });
        return true;
      }
    }
    const projects = await listProjectsForUser(db, user.id, isAdmin, organizationId || undefined);
    sendJson(res, 200, { projects });
    return true;
  }

  // POST /v1/projects
  if (req.method === "POST" && parts[0] === "projects" && parts.length === 1) {
    const body = (await readJsonBody(req)) as { name?: string; organizationId?: string };
    const name = String(body.name ?? "").trim();
    const organizationId = String(body.organizationId ?? "").trim();
    if (!name) {
      sendJson(res, 400, { error: "Project name is required." });
      return true;
    }
    if (!organizationId) {
      sendJson(res, 400, { error: "organizationId is required." });
      return true;
    }
    if (!(await requireOrgAccess(organizationId))) {
      sendJson(res, 403, { error: "Not a member of this organization." });
      return true;
    }
    if (!(await requireOrgOwner(organizationId))) {
      sendJson(res, 403, { error: "Organization owner required to create projects." });
      return true;
    }
    const project = await createProject(db, user.id, name, organizationId);
    sendJson(res, 201, { project });
    return true;
  }

  // GET /v1/projects/:id
  if (req.method === "GET" && parts[0] === "projects" && parts.length === 2) {
    const project = await getProjectForUser(db, parts[1]!, user.id, isAdmin);
    if (!project) {
      sendJson(res, 404, { error: "Project not found." });
      return true;
    }
    if (!(await requireProjectTab(project.organization_id, "projects"))) {
      sendJson(res, 403, { error: "Projects permission required." });
      return true;
    }
    sendJson(res, 200, { project });
    return true;
  }

  // GET /v1/projects/:id/api-keys
  if (req.method === "GET" && parts[0] === "projects" && parts[2] === "api-keys" && parts.length === 3) {
    const project = await getProjectForUser(db, parts[1]!, user.id, isAdmin);
    if (!project) {
      sendJson(res, 404, { error: "Project not found." });
      return true;
    }
    if (!(await requireProjectTab(project.organization_id, "app_settings"))) {
      sendJson(res, 403, { error: "App settings permission required." });
      return true;
    }
    const keys = await listApiKeysForProject(db, project.id);
    sendJson(res, 200, { apiKeys: keys });
    return true;
  }

  // POST /v1/projects/:id/api-keys
  if (req.method === "POST" && parts[0] === "projects" && parts[2] === "api-keys" && parts.length === 3) {
    const project = await getProjectForUser(db, parts[1]!, user.id, isAdmin);
    if (!project) {
      sendJson(res, 404, { error: "Project not found." });
      return true;
    }
    if (!(await requireProjectTab(project.organization_id, "app_settings"))) {
      sendJson(res, 403, { error: "App settings permission required." });
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
    const project = await getProjectForUser(db, parts[1]!, user.id, isAdmin);
    if (!project) {
      sendJson(res, 404, { error: "Project not found." });
      return true;
    }
    if (!(await requireProjectTab(project.organization_id, "app_settings"))) {
      sendJson(res, 403, { error: "App settings permission required." });
      return true;
    }
    const ok = await revokeApiKey(db, project.id, parts[3]!);
    sendJson(res, ok ? 200 : 404, { ok });
    return true;
  }

  const projectId = parts[1]!;
  const project = await getProjectForUser(db, projectId, user.id, isAdmin);

  async function denyUnlessProjectTab(tab: OrgTabKey): Promise<boolean> {
    if (!project) {
      sendJson(res, 404, { error: "Project not found." });
      return true;
    }
    if (!(await requireProjectTab(project.organization_id, tab))) {
      sendJson(res, 403, { error: "Permission denied." });
      return true;
    }
    return false;
  }

  // GET /v1/projects/:id/events
  if (req.method === "GET" && parts[0] === "projects" && parts[2] === "events" && parts.length === 3) {
    if (await denyUnlessProjectTab("events")) return true;
    const query = parseQuery(req);
    const pageSize = Math.min(100, Math.max(1, parseInt(query.get("pageSize") ?? "50", 10) || 50));
    const allowedAction = new Set(["record", "login", "conversion", "custom", "install"]);
    const actionType = query.get("actionType");
    const eventLabel = query.get("event")?.trim().slice(0, 500) ?? "";
    const token = query.get("token")?.trim() ?? "";
    const filter = {
      ...(actionType && allowedAction.has(actionType) ? { actionType } : {}),
      ...(eventLabel ? { eventLabel } : {}),
      ...(token ? { tokenHash: tokenHashForLookup(project!.company_id, token) } : {}),
    };
    const total = await countSdkEvents(db, project!.company_id, filter);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const requested = Math.max(1, parseInt(query.get("page") ?? "1", 10) || 1);
    const page = Math.min(requested, totalPages);
    const events = await listSdkEvents(db, project!.company_id, {
      ...filter,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    sendJson(res, 200, { events, total, page, pageSize, totalPages });
    return true;
  }

  // GET /v1/projects/:id/links
  if (req.method === "GET" && parts[0] === "projects" && parts[2] === "links" && parts.length === 3) {
    if (await denyUnlessProjectTab("links")) return true;
    const linkTypeRaw = parseQuery(req).get("linkType");
    const linkType = linkTypeRaw && isLinkType(linkTypeRaw) ? linkTypeRaw : undefined;
    const links = await listTrackingLinks(db, project!.company_id, linkType);
    sendJson(res, 200, { links });
    return true;
  }

  // POST /v1/projects/:id/links
  if (req.method === "POST" && parts[0] === "projects" && parts[2] === "links" && parts.length === 3) {
    if (await denyUnlessProjectTab("links")) return true;
    try {
      const body = (await readJsonBody(req)) as {
        name?: string;
        slug?: string;
        linkType?: string;
        iosUrl?: string;
        androidUrl?: string;
        webUrl?: string;
        defaultParams?: Record<string, unknown>;
        config?: LinkConfig;
        mediaSource?: string;
        campaignId?: string;
        channel?: string;
        referrerCode?: string;
        defaultDeepLinkValue?: string;
        viewThroughWindowHours?: number;
        destinationUrl?: string;
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
      const linkType: LinkType = body.linkType && isLinkType(body.linkType) ? body.linkType : "one_link";
      const config: LinkConfig = {
        ...parseLinkConfig(body.config),
        ...(body.referrerCode ? { referrerCode: String(body.referrerCode).trim() } : {}),
        ...(body.defaultDeepLinkValue
          ? { defaultDeepLinkValue: String(body.defaultDeepLinkValue).trim() }
          : {}),
        ...(typeof body.viewThroughWindowHours === "number"
          ? { viewThroughWindowHours: body.viewThroughWindowHours }
          : {}),
        ...(body.destinationUrl ? { destinationUrl: String(body.destinationUrl).trim() } : {}),
      };

      let webUrl = body.webUrl?.trim() || undefined;
      let iosUrl = body.iosUrl?.trim() || undefined;
      let androidUrl = body.androidUrl?.trim() || undefined;
      if (config.destinationUrl && (linkType === "short_link" || linkType === "hyperlink" || linkType === "ctv" || linkType === "referral" || linkType === "vta")) {
        webUrl = webUrl || config.destinationUrl;
      }
      if (linkType === "hyperlink" && !webUrl) {
        sendJson(res, 400, { error: "Web URL is required for hyperlinks." });
        return true;
      }
      if (linkType === "short_link" && !webUrl) {
        sendJson(res, 400, { error: "Destination URL is required for short links." });
        return true;
      }
      if (linkType === "deeplink" && !iosUrl && !androidUrl) {
        sendJson(res, 400, { error: "At least one app URL is required for deeplinks." });
        return true;
      }
      if (linkType === "one_link" && !iosUrl && !androidUrl && !webUrl) {
        sendJson(res, 400, { error: "At least one destination URL is required for One Link." });
        return true;
      }

      const defaultParams: Record<string, unknown> = { ...(body.defaultParams ?? {}) };
      if (body.mediaSource) defaultParams.mediaSource = String(body.mediaSource).trim();
      if (body.campaignId) defaultParams.campaignId = String(body.campaignId).trim();
      if (body.channel) defaultParams.channel = String(body.channel).trim();
      if (config.defaultDeepLinkValue) defaultParams.deepLinkValue = config.defaultDeepLinkValue;

      const link = await createTrackingLink(db, {
        companyId: project!.company_id,
        name,
        slug,
        linkType,
        iosUrl,
        androidUrl,
        webUrl,
        defaultParams: Object.keys(defaultParams).length ? defaultParams : undefined,
        config: Object.keys(config).length ? config : undefined,
      });
      sendJson(res, 201, { link });
    } catch (e) {
      sendJson(res, 500, { error: e instanceof Error ? e.message : "Failed to create link." });
    }
    return true;
  }

  // DELETE /v1/projects/:id/links/:linkId
  if (req.method === "DELETE" && parts[0] === "projects" && parts[2] === "links" && parts.length === 4) {
    if (await denyUnlessProjectTab("links")) return true;
    const ok = await deleteTrackingLink(db, project!.company_id, parts[3]!);
    sendJson(res, ok ? 200 : 404, { ok });
    return true;
  }

  // POST /v1/projects/:id/links/:linkId/presets
  if (req.method === "POST" && parts[0] === "projects" && parts[2] === "links" && parts[4] === "presets" && parts.length === 5) {
    if (await denyUnlessProjectTab("links")) return true;
    const linkId = parts[3]!;
    const link = await getTrackingLinkForCompany(db, project!.company_id, linkId);
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
    await updateTrackingLinkCampaignPresets(db, project!.company_id, linkId, JSON.stringify(presets));
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
    if (await denyUnlessProjectTab("links")) return true;
    const linkId = parts[3]!;
    const presetId = parts[5]!;
    const link = await getTrackingLinkForCompany(db, project!.company_id, linkId);
    if (!link) {
      sendJson(res, 404, { error: "Link not found." });
      return true;
    }
    const presets = (link.campaign_presets_json ? JSON.parse(link.campaign_presets_json) : []) as { id: string }[];
    const next = presets.filter((p) => p.id !== presetId);
    await updateTrackingLinkCampaignPresets(db, project!.company_id, linkId, JSON.stringify(next));
    sendJson(res, 200, { ok: true });
    return true;
  }

  // GET /v1/projects/:id/settings
  if (req.method === "GET" && parts[0] === "projects" && parts[2] === "settings" && parts.length === 3) {
    if (await denyUnlessProjectTab("app_settings")) return true;
    const settings = await getAttributionSettings(db, project!.company_id);
    sendJson(res, 200, { settings, companyId: project!.company_id });
    return true;
  }

  // PUT /v1/projects/:id/settings
  if (req.method === "PUT" && parts[0] === "projects" && parts[2] === "settings" && parts.length === 3) {
    if (await denyUnlessProjectTab("app_settings")) return true;
    const body = (await readJsonBody(req)) as {
      iosAppId?: string;
      androidPackage?: string;
      iosTeamId?: string;
      associatedDomain?: string;
      partnerPostbackUrl?: string;
      androidSha256Certs?: string[];
      skanIds?: string[];
      installAttributionWindowHours?: number;
      viewThroughAttributionWindowHours?: number;
      enableProbabilisticMatching?: boolean;
    };
    await upsertAttributionSettings(db, project!.company_id, {
      iosAppId: body.iosAppId?.trim() || null,
      androidPackage: body.androidPackage?.trim() || null,
      iosTeamId: body.iosTeamId?.trim() || null,
      associatedDomain: body.associatedDomain?.trim() || null,
      partnerPostbackUrl: body.partnerPostbackUrl?.trim() || null,
      androidSha256Certs: body.androidSha256Certs,
      skanIds: body.skanIds,
      installAttributionWindowHours: body.installAttributionWindowHours,
      viewThroughAttributionWindowHours: body.viewThroughAttributionWindowHours,
      enableProbabilisticMatching: body.enableProbabilisticMatching,
    });
    sendJson(res, 200, { ok: true });
    return true;
  }

  // GET /v1/projects/:id/campaigns/summary
  if (req.method === "GET" && parts[0] === "projects" && parts[2] === "campaigns" && parts[3] === "summary" && parts.length === 4) {
    if (await denyUnlessProjectTab("campaigns")) return true;
    const query = parseQuery(req);
    const summary = await campaignSummary(db, project!.company_id, query.get("from") ?? undefined, query.get("to") ?? undefined);
    const organic = await organicVsNonOrganic(db, project!.company_id);
    sendJson(res, 200, { summary, organic });
    return true;
  }

  // GET /v1/projects/:id/attribution/installs
  if (req.method === "GET" && parts[0] === "projects" && parts[2] === "attribution" && parts[3] === "installs" && parts.length === 4) {
    if (await denyUnlessProjectTab("attribution")) return true;
    const limit = Math.min(200, Math.max(1, parseInt(parseQuery(req).get("limit") ?? "50", 10) || 50));
    const installs = await listInstallAttributions(db, project!.company_id, limit);
    sendJson(res, 200, { installs });
    return true;
  }

  // GET /v1/projects/:id/skan/postbacks
  if (req.method === "GET" && parts[0] === "projects" && parts[2] === "skan" && parts[3] === "postbacks" && parts.length === 4) {
    if (await denyUnlessProjectTab("skan")) return true;
    const limit = Math.min(200, Math.max(1, parseInt(parseQuery(req).get("limit") ?? "50", 10) || 50));
    const postbacks = await listSkanPostbacks(db, project!.company_id, limit);
    sendJson(res, 200, { postbacks });
    return true;
  }

  sendJson(res, 404, { error: "Not found" });
  return true;
}

export function isDashboardPath(path: string): boolean {
  return (
    path.startsWith("/v1/auth/") ||
    path.startsWith("/v1/projects") ||
    path.startsWith("/v1/organizations") ||
    path.startsWith("/v1/invites/") ||
    path.startsWith("/v1/waitlist")
  );
}
