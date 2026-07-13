import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { hashApiKey, generateApiKey } from "@eventiqn/shared";
import { getPostgresPool, initPostgresSchema, closePostgresPool } from "../src/db/postgres.js";
import { resolveCompanyIdFromApiKeyPg } from "../src/services/apiKeyAuth.js";

loadEnv({ path: resolve(process.cwd(), ".env") });

test("resolveCompanyIdFromApiKeyPg returns company for stored hash", async (t) => {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    t.skip("DATABASE_URL not set — copy .env.example to .env and run npm run db:up");
    return;
  }

  process.env.API_KEY_PEPPER = "test-pepper-pg";
  await initPostgresSchema();
  const db = getPostgresPool();

  const userId = crypto.randomUUID();
  const companyId = crypto.randomUUID();
  const projectId = crypto.randomUUID();
  const email = `t-${userId.slice(0, 8)}@example.com`;

  await db.query(`DELETE FROM users WHERE email = $1`, [email]);
  await db.query(`INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)`, [
    userId,
    email,
    "x",
  ]);
  await db.query(`INSERT INTO projects (id, user_id, name, company_id) VALUES ($1, $2, $3, $4)`, [
    projectId,
    userId,
    "P1",
    companyId,
  ]);

  const { fullKey, prefix } = generateApiKey();
  const keyHash = hashApiKey(fullKey, "test-pepper-pg");
  const keyId = crypto.randomUUID();
  await db.query(`INSERT INTO api_keys (id, project_id, key_prefix, key_hash) VALUES ($1, $2, $3, $4)`, [
    keyId,
    projectId,
    prefix,
    keyHash,
  ]);

  const resolved = await resolveCompanyIdFromApiKeyPg(db, fullKey);
  assert.equal(resolved, companyId);

  await db.query(`DELETE FROM api_keys WHERE id = $1`, [keyId]);
  await db.query(`DELETE FROM projects WHERE id = $1`, [projectId]);
  await db.query(`DELETE FROM users WHERE id = $1`, [userId]);
  await closePostgresPool();
});
