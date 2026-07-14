import crypto from "node:crypto";
import { hashSync } from "bcryptjs";
import type pg from "pg";
import {
  effectivePermissions,
  FULL_PERMISSIONS,
  memberHasTab,
  mergePermissions,
  normalizePermissions,
  RESTRICTIVE_DEFAULT,
  type OrgTabKey,
  type OrgTabPermissions,
} from "./permissions.js";

export type UserRole = "global_admin" | "member";
export type OrgMemberRole = "owner" | "member";

export type UserRow = {
  id: string;
  email: string;
  password_hash: string | null;
  role: UserRole;
};

export type OrganizationRow = {
  id: string;
  name: string;
  created_by_user_id: string | null;
  created_at: string;
};

export type OrganizationWithAccess = OrganizationRow & {
  role: OrgMemberRole | null;
  permissions: OrgTabPermissions;
};

export type OrganizationMemberRow = {
  organization_id: string;
  user_id: string;
  role: OrgMemberRole;
  email: string;
  created_at: string;
  permissions: OrgTabPermissions;
};

export type OrgMembershipRow = {
  organization_id: string;
  user_id: string;
  role: OrgMemberRole;
  permissions: unknown;
};

export {
  effectivePermissions,
  FULL_PERMISSIONS,
  memberHasTab,
  mergePermissions,
  normalizePermissions,
  RESTRICTIVE_DEFAULT,
  type OrgTabKey,
  type OrgTabPermissions,
};

export type InviteRow = {
  id: string;
  organization_id: string;
  email: string;
  token_hash: string;
  invited_by_user_id: string | null;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
};

export const GLOBAL_ADMIN_ALLOWLIST = new Set(["aaykmr@gmail.com"]);

export function isGlobalAdminEmail(email: string): boolean {
  return GLOBAL_ADMIN_ALLOWLIST.has(email.toLowerCase().trim());
}

export async function findUserByEmail(db: pg.Pool, email: string): Promise<UserRow | undefined> {
  const { rows } = await db.query<UserRow>(
    `SELECT id, email, password_hash, role FROM users WHERE email = $1`,
    [email.toLowerCase().trim()],
  );
  return rows[0];
}

export async function findUserById(db: pg.Pool, userId: string): Promise<UserRow | undefined> {
  const { rows } = await db.query<UserRow>(
    `SELECT id, email, password_hash, role FROM users WHERE id = $1`,
    [userId],
  );
  return rows[0];
}

export async function createGlobalAdminUser(
  db: pg.Pool,
  email: string,
  password: string,
): Promise<UserRow> {
  const id = crypto.randomUUID();
  const passwordHash = hashSync(password, 10);
  const normalized = email.toLowerCase().trim();
  await db.query(
    `INSERT INTO users (id, email, password_hash, role) VALUES ($1, $2, $3, 'global_admin')`,
    [id, normalized, passwordHash],
  );
  return { id, email: normalized, password_hash: passwordHash, role: "global_admin" };
}

export async function createMemberUser(
  db: pg.Pool,
  email: string,
  password: string,
): Promise<UserRow> {
  const id = crypto.randomUUID();
  const passwordHash = hashSync(password, 10);
  const normalized = email.toLowerCase().trim();
  await db.query(
    `INSERT INTO users (id, email, password_hash, role) VALUES ($1, $2, $3, 'member')`,
    [id, normalized, passwordHash],
  );
  return { id, email: normalized, password_hash: passwordHash, role: "member" };
}

/** Personal workspace for open internal signup (non–global-admin). */
export async function createPersonalOrganizationForUser(
  db: pg.Pool,
  user: UserRow,
): Promise<OrganizationRow> {
  const local = user.email.split("@")[0] || "My";
  const name = `${local}'s workspace`;
  const org = await createOrganization(db, name, user.id);
  await addOrgMember(db, org.id, user.id, "owner", FULL_PERMISSIONS);
  return org;
}

export async function listOrganizations(db: pg.Pool): Promise<OrganizationRow[]> {
  const { rows } = await db.query<OrganizationRow>(
    `SELECT id, name, created_by_user_id, created_at::text FROM organizations ORDER BY created_at DESC`,
  );
  return rows;
}

export async function listOrganizationsPaginated(
  db: pg.Pool,
  opts: {
    q?: string;
    page?: number;
    pageSize?: number;
    /** When set (non–global-admin), restrict to memberships. */
    forUserId?: string;
  } = {},
): Promise<{
  organizations: OrganizationRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 20));
  const q = opts.q?.trim() ?? "";
  const where: string[] = [];
  const params: unknown[] = [];

  if (opts.forUserId) {
    params.push(opts.forUserId);
    where.push(`EXISTS (
      SELECT 1 FROM organization_members m
      WHERE m.organization_id = o.id AND m.user_id = $${params.length}
    )`);
  }
  if (q) {
    params.push(`%${q.toLowerCase()}%`);
    where.push(`lower(o.name) LIKE $${params.length}`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const countRes = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM organizations o ${whereSql}`,
    params,
  );
  const total = parseInt(countRes.rows[0]?.count ?? "0", 10) || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, opts.page ?? 1), totalPages);
  const offset = (page - 1) * pageSize;
  const listParams = [...params, pageSize, offset];
  const { rows } = await db.query<OrganizationRow>(
    `SELECT o.id, o.name, o.created_by_user_id, o.created_at::text
     FROM organizations o
     ${whereSql}
     ORDER BY o.name ASC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    listParams,
  );
  return { organizations: rows, total, page, pageSize, totalPages };
}

export async function getOrganization(
  db: pg.Pool,
  orgId: string,
): Promise<OrganizationRow | undefined> {
  const { rows } = await db.query<OrganizationRow>(
    `SELECT id, name, created_by_user_id, created_at::text FROM organizations WHERE id = $1`,
    [orgId],
  );
  return rows[0];
}

export async function createOrganization(
  db: pg.Pool,
  name: string,
  createdByUserId: string,
): Promise<OrganizationRow> {
  const id = crypto.randomUUID();
  await db.query(
    `INSERT INTO organizations (id, name, created_by_user_id) VALUES ($1, $2, $3)`,
    [id, name.trim(), createdByUserId],
  );
  const { rows } = await db.query<OrganizationRow>(
    `SELECT id, name, created_by_user_id, created_at::text FROM organizations WHERE id = $1`,
    [id],
  );
  return rows[0]!;
}

export async function listOrganizationsForUser(
  db: pg.Pool,
  userId: string,
): Promise<OrganizationRow[]> {
  const { rows } = await db.query<OrganizationRow>(
    `SELECT o.id, o.name, o.created_by_user_id, o.created_at::text
     FROM organizations o
     INNER JOIN organization_members m ON m.organization_id = o.id
     WHERE m.user_id = $1
     ORDER BY o.created_at DESC`,
    [userId],
  );
  return rows;
}

export async function listOrganizationsWithAccess(
  db: pg.Pool,
  userId: string,
  isGlobalAdmin: boolean,
): Promise<OrganizationWithAccess[]> {
  if (isGlobalAdmin) {
    const { rows } = await db.query<{
      id: string;
      name: string;
      created_by_user_id: string | null;
      created_at: string;
      role: OrgMemberRole | null;
      permissions: unknown;
    }>(
      `SELECT o.id, o.name, o.created_by_user_id, o.created_at::text,
              m.role, m.permissions
       FROM organizations o
       LEFT JOIN organization_members m
         ON m.organization_id = o.id AND m.user_id = $1
       ORDER BY o.created_at DESC`,
      [userId],
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      created_by_user_id: r.created_by_user_id,
      created_at: r.created_at,
      role: r.role,
      permissions: r.role
        ? effectivePermissions(r.role, r.permissions)
        : { ...FULL_PERMISSIONS },
    }));
  }

  const { rows } = await db.query<{
    id: string;
    name: string;
    created_by_user_id: string | null;
    created_at: string;
    role: OrgMemberRole;
    permissions: unknown;
  }>(
    `SELECT o.id, o.name, o.created_by_user_id, o.created_at::text,
            m.role, m.permissions
     FROM organizations o
     INNER JOIN organization_members m ON m.organization_id = o.id
     WHERE m.user_id = $1
     ORDER BY o.created_at DESC`,
    [userId],
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    created_by_user_id: r.created_by_user_id,
    created_at: r.created_at,
    role: r.role,
    permissions: effectivePermissions(r.role, r.permissions),
  }));
}

export async function isOrgMember(
  db: pg.Pool,
  orgId: string,
  userId: string,
): Promise<boolean> {
  const { rows } = await db.query<{ ok: number }>(
    `SELECT 1 AS ok FROM organization_members WHERE organization_id = $1 AND user_id = $2 LIMIT 1`,
    [orgId, userId],
  );
  return Boolean(rows[0]);
}

export async function getOrgMembership(
  db: pg.Pool,
  orgId: string,
  userId: string,
): Promise<OrgMembershipRow | undefined> {
  const { rows } = await db.query<OrgMembershipRow>(
    `SELECT organization_id, user_id, role, permissions
     FROM organization_members
     WHERE organization_id = $1 AND user_id = $2`,
    [orgId, userId],
  );
  return rows[0];
}

export async function isOrgOwner(
  db: pg.Pool,
  orgId: string,
  userId: string,
): Promise<boolean> {
  const membership = await getOrgMembership(db, orgId, userId);
  return membership?.role === "owner";
}

export async function userHasOrgTab(
  db: pg.Pool,
  orgId: string,
  userId: string,
  tab: OrgTabKey,
  isGlobalAdmin: boolean,
): Promise<boolean> {
  if (isGlobalAdmin) return true;
  const membership = await getOrgMembership(db, orgId, userId);
  if (!membership) return false;
  return memberHasTab(membership.role, membership.permissions, tab);
}

export async function listOrgMembers(
  db: pg.Pool,
  orgId: string,
): Promise<OrganizationMemberRow[]> {
  const { rows } = await db.query<{
    organization_id: string;
    user_id: string;
    role: OrgMemberRole;
    email: string;
    created_at: string;
    permissions: unknown;
  }>(
    `SELECT m.organization_id, m.user_id, m.role, u.email, m.created_at::text, m.permissions
     FROM organization_members m
     INNER JOIN users u ON u.id = m.user_id
     WHERE m.organization_id = $1
     ORDER BY m.created_at ASC`,
    [orgId],
  );
  return rows.map((r) => ({
    organization_id: r.organization_id,
    user_id: r.user_id,
    role: r.role,
    email: r.email,
    created_at: r.created_at,
    permissions: effectivePermissions(r.role, r.permissions),
  }));
}

export async function addOrgMember(
  db: pg.Pool,
  orgId: string,
  userId: string,
  role: OrgMemberRole = "member",
  permissions: OrgTabPermissions = role === "owner" ? FULL_PERMISSIONS : RESTRICTIVE_DEFAULT,
): Promise<void> {
  await db.query(
    `INSERT INTO organization_members (organization_id, user_id, role, permissions)
     VALUES ($1, $2, $3, $4::jsonb)
     ON CONFLICT (organization_id, user_id) DO NOTHING`,
    [orgId, userId, role, JSON.stringify(permissions)],
  );
}

export async function updateMemberPermissions(
  db: pg.Pool,
  orgId: string,
  userId: string,
  patch: Partial<OrgTabPermissions>,
): Promise<OrganizationMemberRow | undefined> {
  const membership = await getOrgMembership(db, orgId, userId);
  if (!membership) return undefined;
  if (membership.role === "owner") {
    throw new Error("Cannot change permissions for an organization owner");
  }
  const next = mergePermissions(normalizePermissions(membership.permissions), patch);
  await db.query(
    `UPDATE organization_members SET permissions = $1::jsonb
     WHERE organization_id = $2 AND user_id = $3`,
    [JSON.stringify(next), orgId, userId],
  );
  const members = await listOrgMembers(db, orgId);
  return members.find((m) => m.user_id === userId);
}

function hashInviteToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateInviteToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(32).toString("base64url");
  return { raw, hash: hashInviteToken(raw) };
}

export async function createInvite(
  db: pg.Pool,
  input: {
    organizationId: string;
    email: string;
    invitedByUserId: string;
    expiresInDays?: number;
  },
): Promise<{ invite: InviteRow; rawToken: string }> {
  const id = crypto.randomUUID();
  const { raw, hash } = generateInviteToken();
  const days = input.expiresInDays ?? 7;
  const email = input.email.toLowerCase().trim();
  await db.query(
    `INSERT INTO invites (id, organization_id, email, token_hash, invited_by_user_id, expires_at)
     VALUES ($1, $2, $3, $4, $5, NOW() + ($6::text || ' days')::interval)`,
    [id, input.organizationId, email, hash, input.invitedByUserId, String(days)],
  );
  const { rows } = await db.query<InviteRow>(
    `SELECT id, organization_id, email, token_hash, invited_by_user_id,
            expires_at::text, accepted_at::text, created_at::text
     FROM invites WHERE id = $1`,
    [id],
  );
  return { invite: rows[0]!, rawToken: raw };
}

export async function getInviteByRawToken(
  db: pg.Pool,
  rawToken: string,
): Promise<(InviteRow & { organization_name: string }) | undefined> {
  const hash = hashInviteToken(rawToken);
  const { rows } = await db.query<InviteRow & { organization_name: string }>(
    `SELECT i.id, i.organization_id, i.email, i.token_hash, i.invited_by_user_id,
            i.expires_at::text, i.accepted_at::text, i.created_at::text,
            o.name AS organization_name
     FROM invites i
     INNER JOIN organizations o ON o.id = i.organization_id
     WHERE i.token_hash = $1`,
    [hash],
  );
  return rows[0];
}

export async function acceptInvite(
  db: pg.Pool,
  rawToken: string,
  password: string,
): Promise<UserRow> {
  const invite = await getInviteByRawToken(db, rawToken);
  if (!invite) throw new Error("Invalid invite");
  if (invite.accepted_at) throw new Error("Invite already used");
  if (new Date(invite.expires_at).getTime() < Date.now()) throw new Error("Invite expired");

  const passwordHash = hashSync(password, 10);
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    let user = (
      await client.query<UserRow>(
        `SELECT id, email, password_hash, role FROM users WHERE email = $1`,
        [invite.email],
      )
    ).rows[0];

    if (user) {
      await client.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [
        passwordHash,
        user.id,
      ]);
      user = { ...user, password_hash: passwordHash };
    } else {
      const id = crypto.randomUUID();
      await client.query(
        `INSERT INTO users (id, email, password_hash, role) VALUES ($1, $2, $3, 'member')`,
        [id, invite.email, passwordHash],
      );
      user = { id, email: invite.email, password_hash: passwordHash, role: "member" };
    }

    await client.query(
      `INSERT INTO organization_members (organization_id, user_id, role, permissions)
       VALUES ($1, $2, 'member', $3::jsonb)
       ON CONFLICT (organization_id, user_id) DO NOTHING`,
      [invite.organization_id, user.id, JSON.stringify(RESTRICTIVE_DEFAULT)],
    );
    await client.query(`UPDATE invites SET accepted_at = NOW() WHERE id = $1`, [invite.id]);
    await client.query("COMMIT");
    return user;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function listPendingInvites(
  db: pg.Pool,
  orgId: string,
): Promise<InviteRow[]> {
  const { rows } = await db.query<InviteRow>(
    `SELECT id, organization_id, email, token_hash, invited_by_user_id,
            expires_at::text, accepted_at::text, created_at::text
     FROM invites
     WHERE organization_id = $1 AND accepted_at IS NULL AND expires_at > NOW()
     ORDER BY created_at DESC`,
    [orgId],
  );
  return rows;
}
