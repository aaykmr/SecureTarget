# EventIQN — client integration guide

For **application developers** wiring Web, iOS, or Android apps to EventIQN’s ingest API (or official SDKs). This document does **not** cover running the EventIQN dashboard or ingest server; operators should use [`README.md`](../README.md).

---

## 1. What you need from your EventIQN host

Obtain these from the **project / integration** screen your provider gives you (often after login to a dashboard):

| Item | How you use it |
|------|----------------|
| **API key** | HTTP header **`x-api-key`** on every request. Treat as a secret; prefer env vars or server-side injection on web. |
| **`companyId`** | UUID for your project. Include it in JSON bodies as **`companyId`** on **`/v1/record`** (the server still resolves identity from the API key). |
| **Ingest base URL (`endpoint`)** | Origin of the ingest API only, e.g. `https://ingest.example.com` — no path suffix. SDKs trim trailing slashes. |

Example config shape:

```ts
{
  apiKey: "<from dashboard>",
  companyId: "<uuid from dashboard>",
  endpoint: "https://ingest.example.com"
}
```

**Authorization:** Ingest always trusts **`x-api-key`** and binds events to that key’s project. Do not assume the client-sent **`companyId`** alone proves tenancy.

---

## 2. Session bootstrap and privacy

**Flow:** Call **`POST /v1/session/bootstrap`** once per app install / browser profile (or after you clear the stored session). You receive **`sessionId`**. Store it client-side and send it as **`x-session-id`** on **`/v1/record`** when your deployment expects sessions.

**What EventIQN persists:** Only an **opaque session id**, **company id**, and **timestamps**. **Device JSON, user-agent, and IP are not stored** from bootstrap. The request body must still include **`occurredAt`** and **`device.platform`** (`web` \| `ios` \| `android`) so the API can validate the payload; extra device fields are optional for you and are **not** retained server-side.

**Your systems:** Keep IP, full device profile, and internal user identity **in your own backend or warehouse** if you need them. Correlate with EventIQN using **`sessionId`**, **`eventId`**, and the same **opaque token** you send on login/conversion events.

---

## 3. HTTP API

Base URL = your **`endpoint`**. Bodies are JSON.

### 3.1 Headers

| Header | Required | Purpose |
|--------|----------|---------|
| `Content-Type` | Yes | `application/json` |
| `x-api-key` | Yes | Your API key |
| `x-session-id` | As required by your host | From bootstrap; may be mandatory if the operator enables session enforcement server-side |

### 3.2 `POST /v1/session/bootstrap`

**Body (minimal shape):**

```json
{
  "occurredAt": "2026-05-01T12:00:00.000Z",
  "device": { "platform": "web" }
}
```

**Response:** `{ "sessionId": "sess_…" }`

### 3.3 `POST /v1/record`

Send one JSON object per event.

**Required for all events:**

- **`actionType`:** `record` \| `login` \| `conversion` \| `custom` (use **`custom`** for views/screens and other analytics that should not create attribution **click** rows)
- **`eventId`**, **`companyId`**, **`occurredAt`**

Other fields depend on the action (e.g. **`token`**, **`conversionName`**). Official SDKs set **`token`** to the same value as **`sessionId`** from bootstrap (the install/session identifier). Exact validation rules are in **`packages/contracts/src/events.ts`**.

**Example (`login`):**

```bash
curl -sS -X POST "$ENDPOINT/v1/record" \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "x-session-id: sess_abc..." \
  -d '{
    "actionType": "login",
    "eventId": "evt-login-1",
    "companyId": "your-company-id",
    "occurredAt": "2026-05-01T12:00:00.000Z",
    "token": "sess_abc..."
  }'
```

Use the **same** string for **`x-session-id`** and **`token`** (your bootstrap `sessionId`).

---

## 4. Official SDKs (summary)

| Platform | Integration |
|----------|-------------|
| **Web** | Hosted **`sdk.js`** URL from your provider, or npm **`@eventiqn/web-sdk`**. Global: `EventIQN.init({ apiKey, companyId, endpoint })`, then `trackRecord` / `trackLogin` / `trackConversion`. |
| **iOS** | Initialize with config + `endpoint`; SDK bootstraps session and sends **`x-session-id`** on tracks. |
| **Android** | `EventIQNSdk` with `EventIQNConfig(apiKey, companyId, endpoint)`; session id in app storage; same track APIs. |

More examples and options: [`docs/sdk-integration.md`](sdk-integration.md).

---

## 5. Troubleshooting (client-side)

| Symptom | What to check |
|---------|----------------|
| **401** Invalid / revoked API key | Key copied correctly; key not rotated/revoked; you are hitting the **correct ingest URL** for the environment that issued the key. |
| **403** Invalid session | Session id missing, expired, or wrong environment; run bootstrap again or clear stored session and retry. |
| **CORS** errors (browser) | Your site origin must be allowed by the ingest server’s CORS policy — ask the operator to allow your production/staging origin. |
| **400** Invalid body | **`actionType`** and required fields for that action; **`device.platform`** on bootstrap. |

---

## 6. Operators and self-hosting

Environment variables, database paths, running the dashboard, and ingest process management are documented in [`README.md`](../README.md).
