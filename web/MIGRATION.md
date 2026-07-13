# Web dashboard migration (Next.js → Vite React SPA)

## Done

- **Auth**: JWT in `localStorage`, `POST /v1/auth/register|login`, `GET /v1/auth/me`
- **Projects**: list, create, get project
- **API keys**: list, create (rotate), revoke
- **Pages**: landing, login, register, privacy, terms, projects list, project overview + integration snippets
- **Deploy**: static `dist/` → S3 + CloudFront (see `DEPLOYMENT.md`)

## Stubbed (UI placeholder, API not wired)

These routes render a “coming soon” panel until backend endpoints are ported from the old `web/lib/repos.ts`:

- `/dashboard/:id/campaigns`
- `/dashboard/:id/attribution`
- `/dashboard/:id/links`
- `/dashboard/:id/events`
- `/dashboard/:id/skan`
- `/dashboard/:id/settings/apps`

## Backend follow-ups

1. Port remaining dashboard repos to `backend/src/dashboard/repos.ts` + `router.ts` (events, links, campaigns, settings UI)
2. Move Cashfree webhook from old Next route to backend

## Data storage

When `DATABASE_URL` is set (local Docker or EC2 prod), **all** backend data uses Postgres: dashboard, ingest events, sessions, clicks, and device matching. SQLite is only used when `DATABASE_URL` is unset (unit tests).

## Removed

- Next.js `app/`, `middleware`, `next-auth`, `better-sqlite3` in `web/`
- Docker / App Runner deploy for `web/` (replaced by static S3 deploy)

## Env var mapping

| Old (Next) | New (Vite) |
|------------|------------|
| `NEXT_PUBLIC_APP_URL` | `VITE_APP_URL` |
| `NEXT_PUBLIC_INGEST_URL` | `VITE_INGEST_URL` |
| (server) | `VITE_API_URL` → backend |
