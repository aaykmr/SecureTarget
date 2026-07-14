import crypto from "node:crypto";
import { compareSync, hashSync } from "bcryptjs";
import type pg from "pg";
import { generateApiKey, hashApiKey } from "@eventiqn/shared";
import type { UserRow } from "./organizations.js";

function pepper(): string {
  return (
    process.env.API_KEY_PEPPER?.trim() ??
    process.env.APP_SECRET?.trim() ??
    "dev-api-key-pepper-change-me"
  );
}

export type { UserRow };

export async function findUserByEmail(db: pg.Pool, email: string): Promise<UserRow | undefined> {
  const { rows } = await db.query<UserRow>(
    `SELECT id, email, password_hash, role FROM users WHERE email = $1`,
    [email.toLowerCase().trim()],
  );
  return rows[0];
}

/** @deprecated Use createGlobalAdminUser or invite acceptance */
export async function createUser(db: pg.Pool, email: string, password: string): Promise<UserRow> {
  const id = crypto.randomUUID();
  const passwordHash = hashSync(password, 10);
  await db.query(
    `INSERT INTO users (id, email, password_hash, role) VALUES ($1, $2, $3, 'member')`,
    [id, email.toLowerCase().trim(), passwordHash],
  );
  return {
    id,
    email: email.toLowerCase().trim(),
    password_hash: passwordHash,
    role: "member",
  };
}

export function verifyPassword(user: UserRow, password: string): boolean {
  if (!user.password_hash) return false;
  return compareSync(password, user.password_hash);
}

export type ProjectRow = {
  id: string;
  user_id: string;
  organization_id: string | null;
  name: string;
  company_id: string;
  created_at: string;
};

export async function listProjectsForUser(
  db: pg.Pool,
  userId: string,
  isGlobalAdmin: boolean,
  organizationId?: string,
): Promise<ProjectRow[]> {
  const orgFilter = organizationId?.trim();
  if (isGlobalAdmin) {
    if (orgFilter) {
      const { rows } = await db.query<ProjectRow>(
        `SELECT id, user_id, organization_id, name, company_id, created_at::text
         FROM projects WHERE organization_id = $1 ORDER BY created_at DESC`,
        [orgFilter],
      );
      return rows;
    }
    const { rows } = await db.query<ProjectRow>(
      `SELECT id, user_id, organization_id, name, company_id, created_at::text
       FROM projects ORDER BY created_at DESC`,
    );
    return rows;
  }
  if (orgFilter) {
    const { rows } = await db.query<ProjectRow>(
      `SELECT p.id, p.user_id, p.organization_id, p.name, p.company_id, p.created_at::text
       FROM projects p
       INNER JOIN organization_members m ON m.organization_id = p.organization_id
       WHERE m.user_id = $1 AND p.organization_id = $2
       ORDER BY p.created_at DESC`,
      [userId, orgFilter],
    );
    return rows;
  }
  const { rows } = await db.query<ProjectRow>(
    `SELECT p.id, p.user_id, p.organization_id, p.name, p.company_id, p.created_at::text
     FROM projects p
     INNER JOIN organization_members m ON m.organization_id = p.organization_id
     WHERE m.user_id = $1
     ORDER BY p.created_at DESC`,
    [userId],
  );
  return rows;
}

export async function createProject(
  db: pg.Pool,
  userId: string,
  name: string,
  organizationId: string,
): Promise<ProjectRow> {
  const id = crypto.randomUUID();
  const companyId = crypto.randomUUID();
  await db.query(
    `INSERT INTO projects (id, user_id, organization_id, name, company_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, userId, organizationId, name, companyId],
  );
  const { rows } = await db.query<ProjectRow>(
    `SELECT id, user_id, organization_id, name, company_id, created_at::text FROM projects WHERE id = $1`,
    [id],
  );
  return rows[0]!;
}

export async function getProjectForUser(
  db: pg.Pool,
  projectId: string,
  userId: string,
  isGlobalAdmin: boolean,
): Promise<ProjectRow | undefined> {
  if (isGlobalAdmin) {
    const { rows } = await db.query<ProjectRow>(
      `SELECT id, user_id, organization_id, name, company_id, created_at::text FROM projects WHERE id = $1`,
      [projectId],
    );
    return rows[0];
  }
  const { rows } = await db.query<ProjectRow>(
    `SELECT p.id, p.user_id, p.organization_id, p.name, p.company_id, p.created_at::text
     FROM projects p
     INNER JOIN organization_members m ON m.organization_id = p.organization_id
     WHERE p.id = $1 AND m.user_id = $2`,
    [projectId, userId],
  );
  return rows[0];
}

export type ApiKeyRow = {
  id: string;
  project_id: string;
  key_prefix: string;
  created_at: string;
  revoked_at: string | null;
};

export async function listApiKeysForProject(db: pg.Pool, projectId: string): Promise<ApiKeyRow[]> {
  const { rows } = await db.query<ApiKeyRow>(
    `SELECT id, project_id, key_prefix, created_at::text, revoked_at::text
     FROM api_keys WHERE project_id = $1 ORDER BY created_at DESC`,
    [projectId],
  );
  return rows;
}

export async function revokeActiveApiKeysForProject(db: pg.Pool, projectId: string): Promise<void> {
  await db.query(
    `UPDATE api_keys SET revoked_at = NOW() WHERE project_id = $1 AND revoked_at IS NULL`,
    [projectId],
  );
}

export async function createApiKeyForProject(
  db: pg.Pool,
  projectId: string,
): Promise<{ fullKey: string; row: ApiKeyRow }> {
  const { fullKey, prefix } = generateApiKey();
  const id = crypto.randomUUID();
  const keyHash = hashApiKey(fullKey, pepper());
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE api_keys SET revoked_at = NOW() WHERE project_id = $1 AND revoked_at IS NULL`,
      [projectId],
    );
    await client.query(
      `INSERT INTO api_keys (id, project_id, key_prefix, key_hash) VALUES ($1, $2, $3, $4)`,
      [id, projectId, prefix, keyHash],
    );
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  const { rows } = await db.query<ApiKeyRow>(
    `SELECT id, project_id, key_prefix, created_at::text, revoked_at::text FROM api_keys WHERE id = $1`,
    [id],
  );
  return { fullKey, row: rows[0]! };
}

export async function revokeApiKey(
  db: pg.Pool,
  projectId: string,
  keyId: string,
): Promise<boolean> {
  const res = await db.query(
    `UPDATE api_keys SET revoked_at = NOW() WHERE id = $1 AND project_id = $2 AND revoked_at IS NULL`,
    [keyId, projectId],
  );
  return (res.rowCount ?? 0) > 0;
}
