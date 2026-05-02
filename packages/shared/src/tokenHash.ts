import crypto from "node:crypto";

/** SHA-256 hex of `salt:token` — same formula as ingest + dashboard event lookup. */
export function hashToken(token: string, salt: string): string {
  return crypto.createHash("sha256").update(`${salt}:${token}`).digest("hex");
}

export function tokenSaltForCompany(companyId: string, secret = "securetarget-v1"): string {
  return crypto.createHash("sha256").update(`${secret}:${companyId}`).digest("hex");
}
