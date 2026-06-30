# SecureTarget SDK Integration (v1)

## Dashboard first
1. Run the Next.js app and register (`/register`).
2. Create a **project** — each project gets a stable **`companyId`** (UUID).
3. **Generate an API key** on the project page. The full key is shown **once**; store it securely.
4. Use the same **`API_KEY_PEPPER`** and **`SECURETARGET_DB_PATH`** (or equivalent DB path) for both the dashboard and ingest server so keys hash consistently.

Ingest requests must send the API key in the **`x-api-key`** header. The backend resolves the key to your project’s **`companyId`** and does not trust a different `companyId` sent in the JSON body for authorization.

## What this SDK does
- Records touchpoint, login, and conversion events for attribution.
- Uses the bootstrap **`sessionId`** as the opaque **`token`** on every **`/v1/record`** body (same value as **`x-session-id`**), so you can correlate users in the dashboard by that id without sending a separate app JWT.
- Does not collect device IDs, ad IDs, emails, or account PII.
- Persists only hashed token server-side.

## Backend endpoints
- `POST /v1/session/bootstrap` — **once per browser/app install** (or after `clearSession`). Body `{ occurredAt, device }` must include `device.platform` (`web` | `ios` | `android`). Device details are persisted in the SecureTarget device DB for install attribution matching; customer DB stores only opaque `sessionId`.
- `POST /v1/record` — all attribution events. JSON body must include **`actionType`**: `record`, `login`, `conversion`, `install`, or `custom`.
- `GET /v1/l/{slug}` — campaign tracking link (records click, redirects to store/web).
- `POST /v1/skan/postback` — SKAdNetwork aggregate postbacks.
- `POST /v1/costs` — ingest campaign cost data for ROAS.

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

await sdk.trackRecord({
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
- API: `trackRecord`, `trackLogin(eventId, occurredAt)`, `trackConversion`, `clearSession`. `setLoginToken` is deprecated (no-op).

## Android (Kotlin)
- Stores `sessionId` in SharedPreferences; sends **`x-session-id`** and **`token`** = session id on record calls.
- Optional: `ensureSession(device)` before tracking for bootstrap details.
- API: `ensureSession`, `trackRecord`, `trackLogin(eventId, occurredAt, callback)`, `trackConversion`, `clearSession`. `setLoginToken` is deprecated (no-op).

## Event payload contract
- Shared types and runtime guards are in `packages/contracts/src/events.ts`.
- Every **`/v1/record`** body includes **`actionType`** (`record` | `login` | `conversion` | `install` | `custom`) plus:
  - `eventId`
  - `companyId` (must still be present in JSON; ingest overwrites with the value tied to your API key)
  - `occurredAt` (ISO timestamp)
- **`token`:** use the bootstrap **`sessionId`** (same string as **`x-session-id`**) for `record` (when using sessions), login, and conversion. The backend hashes it for storage and dashboard filters.
- Privacy-first attribution extension fields:
  - `install`: optional `clickId`, `installReferrer`, `deepLinkUrl`, `isReinstall`. Triggers install attribution matching; response includes `attribution` object.
  - `record`: optional `eventSourcePartner`, `mediaSource`, `channel`, `campaignId`, `adgroupId`, `creativeId`, `costModel`, `costValue`, `costCurrency`, `landingUrl`, `referrer`.
  - `conversion`: optional `attributionLookbackHours`, `reengagementWindowHours`, `isRetargeting`, `retargetingConversionType`, `value`, `currency`.
  - Keep PII/device IDs out of payloads; put only business-safe values in `metadata`.

## Privacy model

- Customer attribution DB stores hashed tokens and campaign outcomes only.
- Device details (advertising IDs, install referrer, IP at bootstrap) are stored in the separate SecureTarget device DB (`SECURETARGET_DEVICE_DB_PATH`) for install matching.
- Bootstrap `device` may include `advertisingId`, `vendorId`, `installReferrer`, `deepLinkUrl`, `utm` when your app policy allows.
- See `docs/install-attribution.md` and `docs/tracking-links.md` for install campaign flows.
