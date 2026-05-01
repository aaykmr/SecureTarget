import crypto from "node:crypto";

export function getApiKeyPepper(): string {
  const raw = process.env.API_KEY_PEPPER ?? process.env.APP_SECRET ?? "dev-api-key-pepper-change-me";
  const s = typeof raw === "string" ? raw.trim() : String(raw).trim();
  return s.replace(/^\uFEFF/, "");
}

/** Short fingerprint of the active pepper (compare dashboard vs ingest logs). */
export function apiKeyPepperFingerprint(pepper = getApiKeyPepper()): string {
  return crypto.createHash("sha256").update(pepper).digest("hex").slice(0, 16);
}

export function hashApiKey(plainKey: string, pepper = getApiKeyPepper()): string {
  return crypto.createHash("sha256").update(`${pepper}:${plainKey}`).digest("hex");
}

/** Full secret shown once to the user; prefix is stored for display. */
export function generateApiKey(): { fullKey: string; prefix: string } {
  const raw = crypto.randomBytes(24).toString("base64url");
  const fullKey = `st_live_${raw}`;
  const prefix = fullKey.slice(0, 10);
  return { fullKey, prefix };
}
