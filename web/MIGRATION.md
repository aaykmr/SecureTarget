# Web dashboard migration (Next.js → Vite React SPA)

## Done

- **Auth**: JWT in `localStorage`, `POST /v1/auth/register|login`, `GET /v1/auth/me`
- **Projects**: list, create, get project
- **API keys**: list, create (rotate), revoke
- **Pages**: landing, login, register, privacy, terms, projects list, project overview + integration snippets
- **Analytics**: campaigns summary, install attribution log, SDK events explorer, tracking links, SKAN postbacks, app settings
- **Deploy**: static `dist/` → S3 + CloudFront (see `DEPLOYMENT.md`)

## Remaining follow-ups

- Cashfree billing UI + webhook on backend (was on old Next dashboard)
- Link campaign preset add/delete UI (API wired; basic list display on links page)
- Password reset email delivery (API stubs return 501 for token reset)

## Data storage

When `DATABASE_URL` is set (local Docker or EC2 prod), **all** backend data uses Postgres: dashboard, ingest events, sessions, clicks, and device matching. SQLite is only used when `DATABASE_URL` is unset (unit tests).

Dashboard analytics endpoints require Postgres (`pgPool`); they are not available in SQLite-only test mode.

## Removed

- Next.js `app/`, `middleware`, `next-auth`, `better-sqlite3` in `web/`
- Docker / App Runner deploy for `web/` (replaced by static S3 deploy)

## Env var mapping

| Old (Next) | New (Vite) |
|------------|------------|
| `NEXT_PUBLIC_APP_URL` | `VITE_APP_URL` |
| `NEXT_PUBLIC_INGEST_URL` | `VITE_INGEST_URL` |
| (server) | `VITE_API_URL` → backend |
