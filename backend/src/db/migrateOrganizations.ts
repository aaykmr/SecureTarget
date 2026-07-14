import crypto from "node:crypto";
import type pg from "pg";

const GLOBAL_ADMIN_EMAIL = "aaykmr@gmail.com";

/**
 * Idempotent migrations for organizations / roles on existing databases.
 * CREATE TABLE IF NOT EXISTS alone will not alter older columns.
 */
export async function migrateOrganizationsSchema(db: pg.Pool): Promise<void> {
  await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member'`);
  await db.query(`ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL`);

  await db.query(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS organization_members (
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'member',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (organization_id, user_id)
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id)`);

  await db.query(`
    CREATE TABLE IF NOT EXISTS invites (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      invited_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      accepted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_invites_org ON invites(organization_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_invites_email ON invites(email)`);

  await db.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS organization_id TEXT`);

  // Backfill: one org per legacy project without organization_id
  const { rows: orphans } = await db.query<{
    id: string;
    name: string;
    user_id: string;
  }>(`SELECT id, name, user_id FROM projects WHERE organization_id IS NULL`);

  for (const project of orphans) {
    const orgId = crypto.randomUUID();
    await db.query(
      `INSERT INTO organizations (id, name, created_by_user_id) VALUES ($1, $2, $3)`,
      [orgId, project.name, project.user_id],
    );
    await db.query(
      `INSERT INTO organization_members (organization_id, user_id, role)
       VALUES ($1, $2, 'owner')
       ON CONFLICT DO NOTHING`,
      [orgId, project.user_id],
    );
    await db.query(`UPDATE projects SET organization_id = $1 WHERE id = $2`, [orgId, project.id]);
  }

  await db.query(
    `UPDATE users SET role = 'global_admin' WHERE lower(email) = $1`,
    [GLOBAL_ADMIN_EMAIL],
  );

  await db.query(`
    CREATE TABLE IF NOT EXISTS waitlist_inquiries (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      organization TEXT NOT NULL,
      message TEXT NOT NULL DEFAULT '',
      created_organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
      disabled_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.query(`ALTER TABLE waitlist_inquiries ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMPTZ`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_waitlist_created ON waitlist_inquiries(created_at DESC)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist_inquiries(email)`);
}
