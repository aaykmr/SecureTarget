# SecureTarget SDK Integration (v1)

## Dashboard first
1. Run the Next.js app and register (`/register`).
2. Create a **project** — each project gets a stable **`companyId`** (UUID).
3. **Generate an API key** on the project page. The full key is shown **once**; store it securely.
4. Use the same **`API_KEY_PEPPER`** and **`SECURETARGET_DB_PATH`** (or equivalent DB path) for both the dashboard and ingest server so keys hash consistently.

Ingest requests must send the API key in the **`x-api-key`** header. The backend resolves the key to your project’s **`companyId`** and does not trust a different `companyId` sent in the JSON body for authorization.

## What this SDK does
- Tracks click, login, and conversion events for attribution.
- Uses the bootstrap **`sessionId`** as the opaque **`token`** on every **`/v1/record`** body (same value as **`x-session-id`**), so you can correlate users in the dashboard by that id without sending a separate app JWT.
- Does not collect device IDs, ad IDs, emails, or account PII.
- Persists only hashed token server-side.

## Backend endpoints
- `POST /v1/session/bootstrap` — **once per browser/app install** (or after `clearSession`). Body `{ occurredAt, device }` must include `device.platform` (`web` | `ios` | `android`); ingest **validates** this shape but **does not persist** device JSON—only an opaque **`sessionId`** and timestamps are stored server-side.
- `POST /v1/record` — all attribution events (click, login, conversion). JSON body must include **`actionType`**: `click`, `login`, or `conversion`, plus the fields for that action (see contract below).

All requests require the **`x-api-key`** header (dashboard-issued key).

After bootstrap, send **`x-session-id`** with the returned `sessionId` on **`/v1/record`**. **Do not** repeat full device payloads on those calls—the server associates device details with the session row from bootstrap.

Set **`INGEST_REQUIRE_SESSION=1`** on the ingest service if you want to **reject** ingest events that omit a valid `x-session-id` (stronger enforcement).

## Session flow (all platforms)
1. Collect device metadata once **if your SDK or policy sends it** (platform is required in JSON; optional fields are not stored server-side).
2. `POST /v1/session/bootstrap` with `x-api-key` and JSON body `occurredAt` + `device`.
3. Store `sessionId` (web: `sessionStorage` by default; iOS: `UserDefaults`; Android: `SharedPreferences`).
4. On every `track*` call, send **`x-session-id`** and use the same **`sessionId`** as JSON **`token`** on record payloads—no device object in the **`/v1/record`** body. Keep extra identity in **your** backend if needed.

## Web SDK quickstart

### Option A: Hosted `sdk.js` from your dashboard

Your Next.js app serves a browser bundle at **`/sdk.js`**. Set `NEXT_PUBLIC_APP_URL` on the dashboard so snippets show the full script URL (e.g. `https://dashboard.example.com/sdk.js`).

After the script loads, use the global **`SecureTarget`** object (same API as `init` from npm):

```html
<script src="https://your-dashboard.example.com/sdk.js" async></script>
<script>
  document.addEventListener("DOMContentLoaded", function () {
    var st = SecureTarget.init({
      apiKey: "YOUR_API_KEY",
      companyId: "<companyId-from-dashboard>",
      endpoint: "https://your-ingest-host.example.com"
    });
  });
</script>
```

Do not expose production API keys in public static HTML; inject them from your server or build pipeline where possible.

### Option B: npm / bundler (monorepo or published package)

Use the **`companyId`** from your project page and the ingest base URL (e.g. set `NEXT_PUBLIC_INGEST_URL` in the dashboard `.env` to match your backend).

```ts
import { init } from "@securetarget/web-sdk";

const sdk = init({
  apiKey: process.env.NEXT_PUBLIC_ST_API_KEY!,
  companyId: "<companyId-from-dashboard>",
  endpoint: "https://your-ingest-host.example.com"
});

await sdk.trackClick({
  eventId: crypto.randomUUID(),
  occurredAt: new Date().toISOString(),
  campaignId: "spring-launch"
});

await sdk.trackLogin({
  eventId: crypto.randomUUID(),
  occurredAt: new Date().toISOString()
});

await sdk.trackConversion({
  eventId: crypto.randomUUID(),
  occurredAt: new Date().toISOString(),
  conversionName: "purchase",
  value: 99.5,
  currency: "USD"
});
```

Prefer injecting the API key via **environment variables** or server-side config rather than hard-coding in public HTML.

## iOS (Swift)
- Bootstraps on first use, persists `sessionId`, sends **`x-session-id`** and uses the same id as **`token`** on `/v1/record`.
- Optional: call `bootstrapSession(device:)` early with your own `SecureTargetDeviceDetails`.
- API: `trackClick`, `trackLogin(eventId, occurredAt)`, `trackConversion`, `clearSession`. `setLoginToken` is deprecated (no-op).

## Android (Kotlin)
- Stores `sessionId` in SharedPreferences; sends **`x-session-id`** and **`token`** = session id on record calls.
- Optional: `ensureSession(device)` before tracking for bootstrap details.
- API: `ensureSession`, `trackClick`, `trackLogin(eventId, occurredAt, callback)`, `trackConversion`, `clearSession`. `setLoginToken` is deprecated (no-op).

## Event payload contract
- Shared types and runtime guards are in `packages/contracts/src/events.ts`.
- Every **`/v1/record`** body includes **`actionType`** (`click` | `login` | `conversion`) plus:
  - `eventId`
  - `companyId` (must still be present in JSON; ingest overwrites with the value tied to your API key)
  - `occurredAt` (ISO timestamp)
- **`token`:** use the bootstrap **`sessionId`** (same string as **`x-session-id`**) for click (when using sessions), login, and conversion. The backend hashes it for storage and dashboard filters.

## Privacy defaults
- No device fingerprinting.
- No account-level PII requirements.
- Tokens are hashed in backend with company-derived salt before persistence.
