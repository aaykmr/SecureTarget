# Tracking links

EventIQN provides OneLink-style campaign URLs that record clicks **before** install.

## Create a link

In the dashboard: **Project → Links → Create link**. Set slug and destination URLs (iOS App Store, Play Store, web landing).

## Click URL format

```
GET {INGEST_URL}/v1/l/{slug}?pid={media_source}&c={campaign}&adset={adgroup}&ad={creative}&deep_link_value={value}
```

Supported aliases: `af_adset`, `af_ad`, `st_*` prefixed params.

## What happens on click

1. Server stores a `pending_clicks` row with campaign params and `click_id`
2. Sets cookie `st_click_id` for web continuity
3. Redirects to store or web landing with `st_click_id` appended

## Android deferred attribution

Play Store URL receives a `referrer` param containing `st_click_id`. The Android SDK reads Install Referrer on first open.

## Web

Landing pages with the Web SDK auto-capture `st_click_id` and UTMs via `captureAcquisitionContext()`.
