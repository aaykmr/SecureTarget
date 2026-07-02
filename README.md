# SecureTarget (Privacy Attribution SDK v1)

Privacy-first attribution MVP with:

- Ingest backend (events API)
- Next.js dashboard (register, login, projects, API keys, integration snippets)
- Web SDK
- iOS/Android SDK skeletons
- SQLite persistence (shared DB file for ingest + dashboard)

## Prerequisites

- Node.js 20+ (recommended)
- npm 10+

## Setup

From the project root:

```bash
npm install
```

Create your local environment file:

```bash
cp .env.example .env
```

Edit `.env` and set at least `NEXTAUTH_SECRET`, `API_KEY_PEPPER`, and paths/URLs as needed. The dashboard and ingest **must use the same** `SECURETARGET_DB_PATH` and `API_KEY_PEPPER` so issued API keys validate on ingest.

Relative `SECURETARGET_DB_PATH` values (for example `securetarget.sqlite`) are resolved from the **monorepo root**, not from `web/` or `backend/`, so both processes share one file.

When generating API keys, the dashboard hashes using **`web/lib/apiKeyPepper.ts`** so the pepper matches ingest even when Next bundles workspace packages (do not rely on `process.env` inside `packages/shared` alone from server actions).

### Cashfree subscription (optional)

If you set **`CASHFREE_CLIENT_ID`** and **`CASHFREE_CLIENT_SECRET`** (see `.env.example`), billing is **enforced**: users need an **active** Cashfree subscription to **generate API keys** and open **ingest events** in the dashboard, and the **ingest server** only accepts keys for owners with an active subscription row in SQLite (`billing_subscriptions`). Configure Cashfree webhooks to **`{NEXT_PUBLIC_APP_URL}/api/webhooks/cashfree`**. Failed or cancelled subscription payments set the account to **`ON_HOLD`** and **revoke all API keys** for that user’s projects.

## Run dashboard (Next.js)

```bash
npm run dev --workspace web
```

Open `http://localhost:3000`. Register, create a project, then **generate an API key** and copy the **`companyId`** from the project page. Use the sidebar **Events** link (per project) to query `sdk_events` and filter by opaque token.

Set `NEXT_PUBLIC_INGEST_URL` in `.env` to the public base URL of your ingest server (used in dashboard snippets).

Set `NEXT_PUBLIC_APP_URL` to the dashboard’s public origin (e.g. `http://localhost:3000`) so integration snippets show the full **hosted SDK** script URL.

### Hosted browser SDK (`/sdk.js`)

The Web SDK is bundled into a static file served by the dashboard:

- **URL:** `https://<your-dashboard-domain>/sdk.js`
- **Global:** `window.SecureTarget` with `init(config)` and `SecureTargetClient` (same as the npm package).

The file is generated before `next dev` / `next build` via `npm run build:sdk-browser` (wired as `predev` / `prebuild` on the `web` workspace). Customer sites can load it with a `<script src="…/sdk.js">` tag; see the project page in the dashboard for a copy-paste example.

### Mobile SDK downloads (`/downloads/*.zip`)

iOS and Android source SDKs are packaged as zip files served by the dashboard:

- **iOS:** `/downloads/securetarget-ios-sdk.zip`
- **Android:** `/downloads/securetarget-android-sdk.zip`

Regenerate with `npm run build:sdk-zips` from the repo root (also runs on `web` predev/prebuild). Each archive includes source files and a short README.

Browser calls to the ingest API require CORS. The ingest server sets `Access-Control-Allow-Origin` from `CORS_ORIGIN` (default `*` for development).

### Debugging “Invalid or revoked API key”

Set `INGEST_DEBUG=1` in `.env` and restart ingest. Logs use prefix `[ingest:api-key]` and include **`pepperFingerprint`** (first 16 hex chars of SHA-256 of the effective pepper). To confirm the dashboard uses the same pepper as ingest, set `API_KEY_DEBUG=1`, generate a new key in the project page, and check the terminal where `next dev` runs for `[web:api-key]` — **`pepperFingerprint` must match** ingest. If it does not, the key was created with a different effective env (e.g. dashboard started without root `.env` loaded, or different `API_KEY_PEPPER`). **Regenerate the API key** after fixing env. Pepper values are trimmed and BOM-stripped to avoid `.env` whitespace issues.

## Run backend (ingest)

```bash
npm --workspace @securetarget/backend run start
```

Backend defaults:

- Port: `8080` (override with `PORT`)
- SQLite DB file: `securetarget.sqlite` in project root (override with `SECURETARGET_DB_PATH`)
- Environment variables are loaded automatically from `.env`
- Optional override: set `SECURETARGET_ENV_PATH` to load a different env file path

### Health check

```bash
curl http://localhost:8080/healthz
```

## Run tests

From root:

```bash
npm test
```

## API quick reference

All ingest requests are `POST` with JSON body and `x-api-key` header. The key must be one you generated in the dashboard. The server **ignores** any `companyId` in the body for authorization and attaches the `companyId` of the project that owns the key.

- `/v1/record` — JSON body includes **`actionType`**: `record`, `login`, `conversion`, or `custom` (telemetry/views; no `click_events` row)

## Example request

Replace `YOUR_API_KEY` with a key from the dashboard (project page):

```bash
curl -X POST http://localhost:8080/v1/record \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{
    "actionType":"login",
    "eventId":"evt-login-1",
    "companyId":"ignored-by-server",
    "occurredAt":"2026-04-30T12:00:00.000Z",
    "token":"opaque-session-token"
  }'
```

## SDK integration docs

- **`docs/CLIENT.md`** — **app integrator** guide (API keys, `endpoint`, bootstrap, `/v1/record`, SDKs, client-side troubleshooting).
- **`docs/sdk-integration.md`** — Web/iOS/Android integration flow and payload contract details.
