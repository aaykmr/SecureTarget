# SecureTarget web (dashboard SPA)

Vite + React client-side app. All auth and data go through the backend REST API (`/v1/*` on EC2). Postgres is used in production — not SQLite.

## Local development

```bash
# One-time setup
cp .env.example .env
cp web/.env.example web/.env

# Terminal 1 — Postgres (Docker) + backend
npm run dev:backend

# Terminal 2 — dashboard SPA
npm run dev:web
```

Open http://localhost:3000. Requires Docker for `npm run db:up` (Postgres on port 5432). API keys created in the dashboard are stored in Postgres and validated by ingest when `DATABASE_URL` is set.

Manual Postgres URL (Docker Compose): `postgres://securetarget:securetarget@localhost:5433/securetarget`

## Production architecture

| Component | Host |
|-----------|------|
| Dashboard SPA (`web/dist`) | S3 + CloudFront (static) |
| Backend API + ingest | EC2 |
| Postgres | EC2 (same instance or RDS) |

## Build

```bash
VITE_API_URL=https://api.yourdomain.com \
VITE_INGEST_URL=https://api.yourdomain.com \
VITE_APP_URL=https://app.yourdomain.com \
npm run build --workspace web
```

Output: `web/dist/` (includes `404.html` for SPA routing on S3).

SDK bundles (`public/sdk.js`, `public/downloads/*.zip`) are copied during `prebuild`.

## GitHub Actions deploy

Workflow: `.github/workflows/deploy-web.yml`

Required secrets:

| Secret | Purpose |
|--------|---------|
| `WEB_S3_BUCKET` | S3 bucket for the SPA |
| `WEB_CLOUDFRONT_DOMAIN` | CloudFront domain (fallback lookup) |
| `WEB_CLOUDFRONT_DISTRIBUTION_ID` | Optional — skips domain lookup |
| `VITE_API_URL` | Backend URL baked into the build |
| `VITE_INGEST_URL` | Ingest URL for integration snippets |
| `VITE_APP_URL` | Public dashboard origin (SDK script URL) |
| `AWS_*` | Same as site deploy |

## Backend on EC2

See `backend/DEPLOYMENT.md` for Postgres, env vars, and process setup.

## Migration status

See `web/MIGRATION.md` for which dashboard pages are fully ported vs stubbed.
