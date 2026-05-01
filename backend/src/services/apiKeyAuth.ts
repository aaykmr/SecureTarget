import type { Database } from "better-sqlite3";
import { apiKeyPepperFingerprint, getApiKeyPepper, hashApiKey } from "@securetarget/shared";

function ingestDebugEnabled(): boolean {
  const v = process.env.INGEST_DEBUG;
  return v === "1" || v === "true" || v === "yes";
}

function logIngestDebug(message: string, data?: Record<string, unknown>): void {
  if (!ingestDebugEnabled()) return;
  const payload = data ? ` ${JSON.stringify(data)}` : "";
  // eslint-disable-next-line no-console
  console.log(`[ingest:api-key] ${message}${payload}`);
}

export function resolveCompanyIdFromApiKey(db: Database, apiKeyHeader: string): string | null {
  const trimmed = apiKeyHeader.trim();
  if (!trimmed) return null;
  const keyHash = hashApiKey(trimmed);
  const pepper = getApiKeyPepper();
  const pepperSource =
    process.env.API_KEY_PEPPER != null && process.env.API_KEY_PEPPER !== ""
      ? "API_KEY_PEPPER"
      : process.env.APP_SECRET != null && process.env.APP_SECRET !== ""
        ? "APP_SECRET"
        : "default-dev-pepper";

  logIngestDebug("resolving", {
    keyLength: trimmed.length,
    keyPrefix: `${trimmed.slice(0, 12)}${trimmed.length > 12 ? "…" : ""}`,
    hashPrefix: `${keyHash.slice(0, 16)}…`,
    pepperSource,
    pepperLength: pepper.length,
    pepperFingerprint: apiKeyPepperFingerprint(pepper)
  });

  const row = db
    .prepare(
      `SELECT p.company_id AS company_id
       FROM api_keys k
       INNER JOIN projects p ON k.project_id = p.id
       WHERE k.key_hash = ? AND k.revoked_at IS NULL`
    )
    .get(keyHash) as { company_id: string } | undefined;

  if (row?.company_id) {
    logIngestDebug("ok", { companyId: row.company_id });
    return row.company_id;
  }

  const keyRow = db
    .prepare(`SELECT id, key_prefix, revoked_at, project_id FROM api_keys WHERE key_hash = ?`)
    .get(keyHash) as { id: string; key_prefix: string; revoked_at: string | null; project_id: string } | undefined;

  const counts = db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM api_keys) AS api_keys,
        (SELECT COUNT(*) FROM projects) AS projects`
    )
    .get() as { api_keys: number; projects: number };

  if (keyRow) {
    const project = db.prepare(`SELECT id, company_id FROM projects WHERE id = ?`).get(keyRow.project_id) as
      | { id: string; company_id: string }
      | undefined;
    logIngestDebug("hash matches api_keys row but ingest query failed", {
      reason: keyRow.revoked_at ? "revoked" : project ? "join_or_data_issue" : "orphan_key_no_project",
      keyId: keyRow.id,
      keyPrefixStored: keyRow.key_prefix,
      revokedAt: keyRow.revoked_at,
      projectFound: Boolean(project)
    });
  } else {
    logIngestDebug("no row for hash (pepper/db mismatch or wrong key)", {
      tableCounts: counts,
      hint: "Ensure SECURETARGET_DB_PATH matches dashboard and API_KEY_PEPPER matches when the key was created"
    });

    const storedPrefix = trimmed.slice(0, 10);
    const byPrefix = db
      .prepare(
        `SELECT key_hash, revoked_at FROM api_keys WHERE key_prefix = ? ORDER BY created_at DESC LIMIT 1`
      )
      .get(storedPrefix) as { key_hash: string; revoked_at: string | null } | undefined;
    if (byPrefix) {
      const storedHp = `${byPrefix.key_hash.slice(0, 16)}…`;
      const match = byPrefix.key_hash === keyHash;
      logIngestDebug("compare by key_prefix (same key id, different hash = pepper changed)", {
        keyPrefix10: storedPrefix,
        computedHashPrefix: `${keyHash.slice(0, 16)}…`,
        storedHashPrefix: storedHp,
        hashesEqual: match,
        revoked: Boolean(byPrefix.revoked_at),
        diagnosis: match
          ? "unexpected — hashes match but main query failed"
          : "HASH_MISMATCH: DB row exists for this key prefix but hash differs. Common causes: (1) API_KEY_PEPPER differed when the key was created vs now — e.g. dashboard had no pepper in env (used default) while ingest loads .env; (2) trailing whitespace in .env — fixed by trimming in getApiKeyPepper(). Regenerate the key after fixing env, or compare pepperFingerprint logs from dashboard (API_KEY_DEBUG=1 on key create) with ingest."
      });
    } else {
      logIngestDebug("no api_keys row with key_prefix matching first 10 chars of header — wrong key or different DB");
    }
  }

  return null;
}
