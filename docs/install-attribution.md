# Install attribution

## Install event

Send `actionType: "install"` on first app open. All SDKs auto-fire this after bootstrap on first session.

```json
{
  "actionType": "install",
  "eventId": "uuid",
  "companyId": "your-company-id",
  "occurredAt": "2026-06-30T12:00:00.000Z",
  "token": "sess_...",
  "clickId": "optional-from-referrer",
  "installReferrer": "optional-android-referrer",
  "deepLinkUrl": "optional-universal-link"
}
```

Response includes attribution outcome:

```json
{
  "ok": true,
  "attribution": {
    "attributed": true,
    "isOrganic": false,
    "confidence": 1.0,
    "mediaSource": "facebook",
    "campaignId": "summer_sale",
    "clickId": "...",
    "ruleName": "click_id_exact"
  }
}
```

## Match rules (priority)

1. `click_id` exact — referrer, deep link, cookie
2. GAID / IDFA — device DB
3. Session `record` — same token in customer DB
4. Probabilistic — IP + UA + time window (configurable)

## Organic installs

When no rule matches above the confidence threshold, `isOrganic: true`.

## SDK callbacks

- Web: `sdk.onInstallAttribution((result) => { ... })`
- iOS: `sdk.onInstallAttribution { result in ... }`
- Android: `sdk.onInstallAttribution { result -> ... }`

## Device DB

Bootstrap device details are persisted in `SECURETARGET_DEVICE_DB_PATH` for matching. Customer DB stores hashed tokens and attribution outcomes only.
