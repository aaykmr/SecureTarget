import { config as loadEnv } from "dotenv";
import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..");
// Next.js only auto-loads `.env*` from `web/`; load monorepo root so `NEXTAUTH_SECRET` etc. apply.
loadEnv({ path: path.join(repoRoot, ".env") });
loadEnv({ path: path.join(repoRoot, ".env.local"), override: true });

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"]
};

export default nextConfig;
