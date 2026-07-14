import crypto from "node:crypto";
import type pg from "pg";

export type WaitlistInquiryRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  organization: string;
  message: string;
  created_organization_id: string | null;
  disabled_at: string | null;
  created_at: string;
};

const SELECT_COLS = `id, name, email, phone, organization, message,
            created_organization_id, disabled_at::text, created_at::text`;

export async function createWaitlistInquiry(
  db: pg.Pool,
  input: {
    name: string;
    email: string;
    phone?: string | null;
    organization: string;
    message?: string;
  },
): Promise<WaitlistInquiryRow> {
  const id = crypto.randomUUID();
  await db.query(
    `INSERT INTO waitlist_inquiries (id, name, email, phone, organization, message)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      id,
      input.name.trim(),
      input.email.toLowerCase().trim(),
      input.phone?.trim() || null,
      input.organization.trim(),
      (input.message ?? "").trim(),
    ],
  );
  const { rows } = await db.query<WaitlistInquiryRow>(
    `SELECT ${SELECT_COLS} FROM waitlist_inquiries WHERE id = $1`,
    [id],
  );
  return rows[0]!;
}

export async function listWaitlistInquiries(
  db: pg.Pool,
  opts: {
    q?: string;
    page?: number;
    pageSize?: number;
    status?: "all" | "open" | "converted" | "disabled";
  } = {},
): Promise<{ inquiries: WaitlistInquiryRow[]; total: number; page: number; pageSize: number; totalPages: number }> {
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 20));
  const q = opts.q?.trim() ?? "";
  const status = opts.status ?? "all";

  const where: string[] = [];
  const params: unknown[] = [];

  if (q) {
    params.push(`%${q.toLowerCase()}%`);
    where.push(
      `(lower(name) LIKE $${params.length} OR lower(email) LIKE $${params.length} OR lower(coalesce(phone, '')) LIKE $${params.length} OR lower(organization) LIKE $${params.length} OR lower(coalesce(message, '')) LIKE $${params.length})`,
    );
  }
  if (status === "open") {
    where.push(`created_organization_id IS NULL AND disabled_at IS NULL`);
  } else if (status === "converted") {
    where.push(`created_organization_id IS NOT NULL AND disabled_at IS NULL`);
  } else if (status === "disabled") {
    where.push(`disabled_at IS NOT NULL`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const countRes = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM waitlist_inquiries ${whereSql}`,
    params,
  );
  const total = parseInt(countRes.rows[0]?.count ?? "0", 10) || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, opts.page ?? 1), totalPages);
  const offset = (page - 1) * pageSize;

  const listParams = [...params, pageSize, offset];
  const { rows } = await db.query<WaitlistInquiryRow>(
    `SELECT ${SELECT_COLS}
     FROM waitlist_inquiries
     ${whereSql}
     ORDER BY created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    listParams,
  );

  return { inquiries: rows, total, page, pageSize, totalPages };
}

export async function getWaitlistInquiry(
  db: pg.Pool,
  id: string,
): Promise<WaitlistInquiryRow | undefined> {
  const { rows } = await db.query<WaitlistInquiryRow>(
    `SELECT ${SELECT_COLS} FROM waitlist_inquiries WHERE id = $1`,
    [id],
  );
  return rows[0];
}

export async function linkInquiryOrganization(
  db: pg.Pool,
  inquiryId: string,
  organizationId: string,
): Promise<void> {
  await db.query(
    `UPDATE waitlist_inquiries SET created_organization_id = $1 WHERE id = $2`,
    [organizationId, inquiryId],
  );
}

export async function setWaitlistInquiryDisabled(
  db: pg.Pool,
  inquiryId: string,
  disabled: boolean,
): Promise<WaitlistInquiryRow | undefined> {
  if (disabled) {
    await db.query(
      `UPDATE waitlist_inquiries SET disabled_at = NOW() WHERE id = $1 AND disabled_at IS NULL`,
      [inquiryId],
    );
  } else {
    await db.query(`UPDATE waitlist_inquiries SET disabled_at = NULL WHERE id = $1`, [inquiryId]);
  }
  return getWaitlistInquiry(db, inquiryId);
}
