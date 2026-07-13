# SecureTarget dashboard (web)

Vite + React SPA. Auth and data use the backend REST API with **Postgres** locally and in production.

## Local development

```bash
cp .env.example .env
cp web/.env.example web/.env
npm run dev:backend   # terminal 1 — Docker Postgres + API on :8080
npm run dev:web       # terminal 2 — SPA on :3000
```

See [`DEPLOYMENT.md`](DEPLOYMENT.md) and [`MIGRATION.md`](MIGRATION.md).
