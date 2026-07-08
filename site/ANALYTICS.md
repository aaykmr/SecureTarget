# Google Analytics (GA4)

The marketing site loads GA4 when `VITE_GA_MEASUREMENT_ID` is set (e.g. `G-XXXXXXXXXX`).

Implementation: [`src/lib/analytics.ts`](src/lib/analytics.ts). GA loads only after cookie consent (see below). Section engagement starts after React mounts in [`src/App.tsx`](src/App.tsx).

## Cookie consent

[`CookieConsent`](src/components/CookieConsent.tsx) shows a bottom banner on first visit. Choice is stored in `localStorage` (`tt_cookie_consent`).

| Action | Analytics |
|--------|-----------|
| **Accept all** | GA4 script loads; page views and custom events run |
| **Essential only** | No gtag script; tracking helpers are no-ops |

Returning visitors: if analytics was previously accepted, GA initializes on page load without showing the banner again.

## Setup

1. Create a GA4 **Web** data stream and copy the measurement ID.
2. Local — add to `site/.env` (see [`.env.example`](.env.example)):

   ```bash
   VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
   ```

3. Production — add the same value as GitHub Actions secret **`VITE_GA_MEASUREMENT_ID`**. The [deploy workflow](../.github/workflows/deploy-site.yml) injects it at build time.
4. Restart `npm run dev:site` after changing local env. Redeploy for production.
5. Verify in **GA4 → Reports → Realtime** (and **Realtime → Events** for custom events).

If the env var is missing, no gtag script loads and tracking helpers are no-ops.

### Debugging: `dataLayer` fills but no Network requests

Google’s snippet must push the **`arguments` object**, not a JS `Array`:

```js
function gtag(){ dataLayer.push(arguments); }
```

If you see normal arrays in `dataLayer` (e.g. `Array(3)`) instead of `Arguments`, gtag.js will queue nothing and never hit `google-analytics.com/g/collect`.

In DevTools Network, filter by `collect` or `google-analytics`. GA4 often uses **`fetch` / `sendBeacon`** and may **batch** events, so a click/scroll may not produce one request per event.

## Automatic measurement

| Signal | Behavior |
|--------|----------|
| Page views | Initial load + hash changes (`/#about`, `/#contact`, etc.) |
| Sessions / users | Standard GA4 |
| Traffic / device / geo | Standard GA4 (where available) |

## Custom events

| Event | Fired when | Useful params |
|-------|------------|---------------|
| `cta_click` | CTA with `data-cta` is clicked | `cta_label`, `cta_location` |
| `generate_lead` | Contact form submit starts (also marks as a common conversion event name) | `form_name`, `method` |
| `contact_form_submit` | Contact form submit starts | `form_name` |
| `contact_form_success` | Google Sheets write succeeds | `form_name` |
| `contact_form_error` | Form not configured or request fails | `form_name`, `error_reason` |
| `mailto_click` | `mailto:` link click | `link_url`, `link_text`, `email` |
| `tel_click` | `tel:` link click | `link_url`, `link_text` |
| `outbound_click` | External `http(s)` link click | `link_url`, `link_domain`, `link_text` |
| `scroll_depth` | Reaches 25 / 50 / 75 / 90 / 100% (once per session load) | `percent_scrolled`, `page_path` |
| `section_view` | Section ≥ ~35% visible | `section_id` |
| `section_engagement` | Leaves section, tab hidden, or page unload (≥ 1s) | `section_id`, `engagement_time_sec`, `engagement_time_msec` |

### CTA markup

Buttons/links that should count as CTAs:

```html
<a
  href="#contact"
  className={styles.cta}
  data-cta="get_in_touch"
  data-cta-location="navbar"
>
  Get in touch
</a>
```

Current CTAs:

- Hero: `start_conversation`, `see_what_we_do` (`cta_location=hero`)
- Navbar: `get_in_touch` (`cta_location=navbar`)

Mailto / tel / outbound links are tracked automatically for all anchors (no extra attributes).

### Sections tracked

`home`, `about`, `services`, `advertisers`, `publishers`, `products`, `contact` (by element `id`).

## GA4 recommendations

1. **Admin → Events** — mark `generate_lead` and/or `contact_form_success` as **conversions**.
2. Optionally register custom dimensions for `cta_label`, `cta_location`, `section_id`, `percent_scrolled` if you want them as report breakdowns.
3. Use Realtime after clicking CTAs or submitting the contact form to confirm events fire before relying on standard reports (they can lag).

## Local checklist

- [ ] `VITE_GA_MEASUREMENT_ID` in `site/.env`
- [ ] Dev server restarted
- [ ] Accept cookies in the banner to enable tracking locally
- [ ] Realtime shows your visit (after consent)
- [ ] CTA / form / scroll events appear under Realtime → Events
- [ ] GitHub secret set before next production deploy
