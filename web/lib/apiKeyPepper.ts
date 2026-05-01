/**
 * Read API key pepper in the Next.js app process only (not via packages/shared),
 * so bundling never inlines wrong env for server actions.
 */
export function getDashboardApiKeyPepper(): string {
  const raw = process.env.API_KEY_PEPPER ?? process.env.APP_SECRET ?? "dev-api-key-pepper-change-me";
  const s = typeof raw === "string" ? raw.trim() : String(raw).trim();
  return s.replace(/^\uFEFF/, "");
}
