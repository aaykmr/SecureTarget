import test from "node:test";
import assert from "node:assert/strict";
import { createDb } from "../src/db/client.js";
import { resolveCompanyIdFromApiKey } from "../src/services/apiKeyAuth.js";
import { hashApiKey, generateApiKey } from "@securetarget/shared";
import crypto from "node:crypto";

test("resolveCompanyIdFromApiKey returns company for stored hash", () => {
  process.env.API_KEY_PEPPER = "test-pepper";
  const db = createDb(":memory:");
  const userId = crypto.randomUUID();
  const companyId = crypto.randomUUID();
  const projectId = crypto.randomUUID();
  db.prepare(`INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)`).run(
    userId,
    "t@example.com",
    "x"
  );
  db.prepare(`INSERT INTO projects (id, user_id, name, company_id) VALUES (?, ?, ?, ?)`).run(
    projectId,
    userId,
    "P1",
    companyId
  );
  const { fullKey, prefix } = generateApiKey();
  const keyHash = hashApiKey(fullKey, "test-pepper");
  const keyId = crypto.randomUUID();
  db.prepare(`INSERT INTO api_keys (id, project_id, key_prefix, key_hash) VALUES (?, ?, ?, ?)`).run(
    keyId,
    projectId,
    prefix,
    keyHash
  );
  const resolved = resolveCompanyIdFromApiKey(db, fullKey);
  assert.equal(resolved, companyId);
});
