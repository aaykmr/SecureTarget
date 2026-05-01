# SecureTarget — client & operator setup guide

This document explains how to **run the stack locally**, **configure environment variables**, and **integrate apps** (Web, iOS, Android) with the ingest API. It is written so **developers** and **automated assistants (LLMs)** can follow it without guessing paths or implicit steps.

---

## 1. What you are setting up

| Component | Role |
|-----------|------|
| **Dashboard** (`web/`) | Next.js app: register/login, create **projects**, issue **API keys**, copy **`companyId`**, host **`/sdk.js`**. |
| **Ingest backend** (`backend/`) | HTTP API: session bootstrap, event ingestion (`/v1/record`), SQLite persistence. |
| **SQLite DB** | Single file shared by dashboard + ingest when paths match (see below). |
| **SDKs** | `sdk/web`, `sdk/ios`, `sdk/android` — call ingest with `x-api-key`, optional `x-session-id`. |

**Authorization rule:** Every ingest request sends **`x-api-key`**. The server resolves that key to a **`companyId`** and **overwrites** any `companyId` in the JSON body for auth. Do not rely on the client-sent `companyId` for security.

---

## 2. Prerequisites

- **Node.js** 20+ (recommended), **npm** 10+
- For **iOS/Android** native SDKs: Xcode / Android Studio as usual (this repo documents paths only).

---

## 3. Repository layout (facts for tooling)

| Path | Contents |
|------|----------|
| Repo root | `package.json` workspaces, root `.env` |
| `web/` | Next.js dashboard |
| `backend/` | Ingest server entry (`src/server.ts`) |
| `sdk/web/` | Browser / npm Web SDK source |
| `web/public/sdk.js` | **Built** hosted bundle (run `npm run build:sdk-browser` from root after SDK changes) |
| `packages/contracts/src/events.ts` | JSON shape: `actionType`, `eventId`, `companyId`, `occurredAt`, etc. |
| `.env.example` | Template — copy to **`.env` at repo root** |

**Important:** Relative **`SECURETARGET_DB_PATH`** (e.g. `securetarget.sqlite`) is resolved from the **monorepo root**, not from `web/` or `backend/`.

---

## 4. First-time operator setup (local dev)

### 4.1 Install

From the **repository root**:

```bash
npm install
cp .env.example .env
```

Edit **root** `.env` (see section 5).

### 4.2 Required secrets / values

Generate a strong random string for **`API_KEY_PEPPER`** and for **`NEXTAUTH_SECRET`** (e.g. `openssl rand -base64 32`).

The dashboard and ingest **must** use the **same** values for:

- `API_KEY_PEPPER`
- `SECURETARGET_DB_PATH` (or equivalent absolute path to one SQLite file)

Otherwise API keys created in the dashboard will **not** validate on ingest (`401 Invalid or revoked API key`).

### 4.3 Run the dashboard

```bash
npm run dev --workspace web
```

Open **`http://localhost:3000`**, register, create a **project**, note **`companyId`**, **generate an API key** (shown once).

### 4.4 Run the ingest server

In another terminal, from **repo root**:

```bash
npm --workspace @securetarget/backend run start
```

Default ingest URL: **`http://localhost:8080`** (override with `PORT` in `.env`).

Health check:

```bash
curl http://localhost:8080/healthz
```

### 4.5 Align dashboard snippets with ingest

In root `.env`, set:

- **`NEXT_PUBLIC_INGEST_URL`** — base URL of the ingest server (e.g. `http://localhost:8080`).
- **`NEXT_PUBLIC_APP_URL`** — public origin of the dashboard (e.g. `http://localhost:3000`) so copy-paste snippets include the full **`/sdk.js`** URL.

---

## 5. Environment variables (reference)

Values below live in **root** `.env` unless your deployment splits services.

| Variable | Used by | Purpose |
|----------|---------|---------|
| `SECURETARGET_DB_PATH` | Dashboard + ingest | SQLite file path; relative → resolved from **repo root**. |
| `API_KEY_PEPPER` | Dashboard + ingest | Must match so hashed API keys verify. |
| `PORT` | Ingest | Listen port (default `8080`). |
| `CORS_ORIGIN` | Ingest | Browser `Origin` allowed for CORS (dev often `*`). |
| `NEXTAUTH_SECRET` / `NEXTAUTH_URL` | Dashboard | Auth session secret and canonical URL. |
| `NEXT_PUBLIC_INGEST_URL` | Dashboard UI | Shown in integration snippets. |
| `NEXT_PUBLIC_APP_URL` | Dashboard UI | Full URL for hosted `/sdk.js` in snippets. |
| `INGEST_REQUIRE_SESSION` | Ingest | If `1` or `true`, **`/v1/record`** requires valid **`x-session-id`**. Enable only after all clients bootstrap sessions. |
| `INGEST_DEBUG` | Ingest | Logs `[ingest:api-key]` diagnostics including **`pepperFingerprint`**. |
| `API_KEY_DEBUG` | Dashboard | Logs `[web:api-key]` **`pepperFingerprint`** when generating keys — must match ingest. |
| `SECURETARGET_ENV_PATH` | Ingest | Optional path to env file (defaults resolve toward repo `.env`). |

---

## 6. Integration credentials (what client apps need)

From the **dashboard project page**, copy:

| Credential | Where it appears |
|------------|------------------|
| **API key** | Generated once per key; store securely. Sent as header **`x-api-key`**. |
| **`companyId`** | Stable UUID for the project; still required in JSON bodies as **`companyId`** (server overwrites from key). |

Configure your app with:

- **`endpoint`** — ingest base URL with **no** trailing slash issues (SDKs normalize), e.g. `https://ingest.example.com`.

---

## 7. HTTP API (minimal contract)

Base URL = ingest **`endpoint`**. All bodies are JSON unless noted.

### 7.1 Headers

| Header | Required | Purpose |
|--------|----------|---------|
| `Content-Type` | Yes | `application/json` |
| `x-api-key` | Yes | Dashboard-issued API key |
| `x-session-id` | Recommended | Opaque session id from bootstrap; required if **`INGEST_REQUIRE_SESSION`** is enabled |

### 7.2 `POST /v1/session/bootstrap`

**When:** Once per browser profile / app install (or after explicit session clear). Sends **device metadata once**.

**Body (conceptual):**

```json
{
  "occurredAt": "2026-05-01T12:00:00.000Z",
  "device": {
    "platform": "web",
    "sdkVersion": "0.2.0"
  }
}
```

`device.platform` must be **`web`**, **`ios`**, or **`android`** (plus optional fields per contract).

**Response:**

```json
{ "sessionId": "sess_…" }
```

Store **`sessionId`** client-side; send it as **`x-session-id`** on later requests.

### 7.3 `POST /v1/record`

**When:** Every attribution event (click, login, conversion).

**Body:** Must include:

- **`actionType`**: **`click`** | **`login`** | **`conversion`**
- **`eventId`**, **`companyId`**, **`occurredAt`** (ISO-8601)

Additional fields depend on `actionType` (tokens, `conversionName`, campaign ids, etc.). See **`packages/contracts/src/events.ts`** for the exact guards.

**Example (`login`):**

```bash
curl -sS -X POST "$ENDPOINT/v1/record" \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "x-session-id: sess_your_session_if_any" \
  -d '{
    "actionType": "login",
    "eventId": "evt-login-1",
    "companyId": "ignored-for-auth-still-required",
    "occurredAt": "2026-05-01T12:00:00.000Z",
    "token": "opaque-session-token"
  }'
```

---

## 8. SDK usage (by platform)

### 8.1 Web

- **Hosted script:** Dashboard serves **`/sdk.js`** after build (`npm run build:sdk-browser` from root updates `web/public/sdk.js`).
- **Global:** `SecureTarget.init({ apiKey, companyId, endpoint })` then `trackClick` / `trackLogin` / `trackConversion`.
- **npm:** `@securetarget/web-sdk` from monorepo (`sdk/web`).

Details and examples: **`docs/sdk-integration.md`**.

### 8.2 iOS

- Sources: **`sdk/ios/Sources/SecureTargetSDK/`**
- Bootstraps session, persists id, sends **`x-session-id`** on track calls.

### 8.3 Android

- Sources: **`sdk/android/src/main/java/com/securetarget/sdk/SecureTargetSdk.kt`**
- Same pattern: bootstrap once, SharedPreferences for session id.

---

## 9. Rebuilding the hosted browser bundle

After changing **`sdk/web`**, from **repo root**:

```bash
npm run build:sdk-browser
```

Commit or deploy **`web/public/sdk.js`** if you serve the dashboard from production.

---

## 10. Troubleshooting

| Symptom | What to check |
|---------|----------------|
| `401` Invalid API key | Same **`API_KEY_PEPPER`** and **`SECURETARGET_DB_PATH`** on dashboard and ingest; restart both after `.env` changes. Regenerate key after fixing env. |
| Pepper mismatch | Set **`INGEST_DEBUG=1`** on ingest and **`API_KEY_DEBUG=1`** on dashboard; compare **`pepperFingerprint`** logs when generating a new key. |
| CORS errors in browser | Ingest **`CORS_ORIGIN`** includes your site origin (or `*` for dev). |
| Session required errors | Call **`/v1/session/bootstrap`** first, send **`x-session-id`**, or disable **`INGEST_REQUIRE_SESSION`** until clients are updated. |

Dashboard hashing note: the app uses **`web/lib/apiKeyPepper.ts`** so the pepper matches ingest when Next bundles shared code — do not strip that indirection without aligning ingest.

---

## 11. Related documentation

| File | Contents |
|------|----------|
| `docs/sdk-integration.md` | Deeper SDK integration, privacy notes, payload nuance |
| `README.md` | Monorepo commands, health check, quick API note |
| `.env.example` | All variables with comments |

---

## 12. LLM / automation checklist

When helping a user integrate or debug, verify in order:

1. Root **`.env`** exists; **`API_KEY_PEPPER`** and **`SECURETARGET_DB_PATH`** align across dashboard and ingest.
2. **`companyId`** and **API key** come from the **same project** in the dashboard.
3. Ingest **`endpoint`** matches **`NEXT_PUBLIC_INGEST_URL`** used in snippets (for humans).
4. **`POST /v1/session/bootstrap`** completed before relying on **`x-session-id`** (if sessions are required).
5. **`POST /v1/record`** body includes **`actionType`** and passes **`packages/contracts`** validation.
