import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import pg from "pg";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
loadEnv({ path: resolve(root, ".env") });

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error("DATABASE_URL is not set — copy .env.example to .env at the repo root");
  process.exit(1);
}

const maxAttempts = Number(process.env.PG_WAIT_ATTEMPTS ?? 30);
const delayMs = Number(process.env.PG_WAIT_DELAY_MS ?? 1000);

for (let attempt = 1; attempt <= maxAttempts; attempt++) {
  const client = new pg.Client({ connectionString: url });
  try {
    await client.connect();
    await client.query("SELECT 1");
    await client.end();
    console.log(`Postgres ready (attempt ${attempt})`);
    process.exit(0);
  } catch (err) {
    await client.end().catch(() => {});
    if (attempt === maxAttempts) {
      console.error("Postgres did not become ready in time:", err instanceof Error ? err.message : err);
      process.exit(1);
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
}
