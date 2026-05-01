# SecureTarget SDK Integration (v1)

## Dashboard first
1. Run the Next.js app and register (`/register`).
2. Create a **project** — each project gets a stable **`companyId`** (UUID).
3. **Generate an API key** on the project page. The full key is shown **once**; store it securely.
4. Use the same **`API_KEY_PEPPER`** and **`SECURETARGET_DB_PATH`** (or equivalent DB path) for both the dashboard and ingest server so keys hash consistently.

Ingest requests must send the API key in the **`x-api-key`** header. The backend resolves the key to your project’s **`companyId`** and does not trust a different `companyId` sent in the JSON body for authorization.

## What this SDK does
- Tracks click, login, and conversion events for attribution.
- Uses app-provided opaque login token.
- Does not collect device IDs, ad IDs, emails, or account PII.
- Persists only hashed token server-side.

## Backend endpoints
- `POST /v1/session/bootstrap` — **once per browser/app install** (or after `clearSession`). Sends `{ occurredAt, device }` where `device.platform` is `web`, `ios`, or `android`. Response: `{ sessionId }` (opaque id).
- `POST /v1/record` — all attribution events (click, login, conversion). JSON body must include **`actionType`**: `click`, `login`, or `conversion`, plus the fields for that action (see contract below).

All requests require the **`x-api-key`** header (dashboard-issued key).

After bootstrap, send **`x-session-id`** with the returned `sessionId` on **`/v1/record`**. **Do not** repeat full device payloads on those calls—the server associates device details with the session row from bootstrap.

Set **`INGEST_REQUIRE_SESSION=1`** on the ingest service if you want to **reject** ingest events that omit a valid `x-session-id` (stronger enforcement).

## Session flow (all platforms)
1. Collect device metadata once (platform, OS, locale, screen where applicable).
2. `POST /v1/session/bootstrap` with `x-api-key` and JSON body `occurredAt` + `device`.
3. Store `sessionId` (web: `sessionStorage` by default; iOS: `UserDefaults`; Android: `SharedPreferences`).
4. On every `track*` call, send **`x-session-id`** only—no device object in the ingest body.

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

sdk.setLoginToken("opaque-session-token");

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
- `SecureTargetSdk` bootstraps on first use, persists `sessionId`, and adds `x-session-id` to ingest requests.
- Optional: call `ensureSession(device:)` early (e.g. after launch) with your own `SecureTargetDeviceDetails`; otherwise defaults are used.
- API: `setLoginToken`, `trackClick`, `trackLogin`, `trackConversion`, `clearSession`.

## Android (Kotlin)
- `SecureTargetSdk(context, config)` stores the session id in SharedPreferences and sends `x-session-id` on track calls.
- Optional: `ensureSession(device)` before tracking to control device fields at bootstrap; otherwise `SecureTargetSdk.defaultDevice()` is used.
- API: `setLoginToken`, `ensureSession`, `trackClick`, `trackLogin`, `trackConversion`, `clearSession`.

## Event payload contract
- Shared types and runtime guards are in `packages/contracts/src/events.ts`.
- Every **`/v1/record`** body includes **`actionType`** (`click` | `login` | `conversion`) plus:
  - `eventId`
  - `companyId` (must still be present in JSON; ingest overwrites with the value tied to your API key)
  - `occurredAt` (ISO timestamp)

## Privacy defaults
- No device fingerprinting.
- No account-level PII requirements.
- Tokens are hashed in backend with company-derived salt before persistence.
