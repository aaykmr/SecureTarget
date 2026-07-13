# TrustTargets marketing site

Static React company website for **TrustTargets** — a services-led marketing partner (strategy, campaigns, affiliate, and partner operations).

## Develop

```bash
npm run dev:site
```

Open http://localhost:5173

## Build

```bash
npm run build --workspace @eventiqn/site
```

Output: `site/dist/`

## Brand assets

Drop logo and favicon files in [`public/`](public/). See [`public/README.md`](public/README.md) for filenames. They are served from `/` in dev and copied into `dist/` on build.

## Analytics

Google Analytics 4 setup, env vars, and custom events: [`ANALYTICS.md`](ANALYTICS.md).
