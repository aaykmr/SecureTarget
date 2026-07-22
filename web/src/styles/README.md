# Design tokens and styling

Colors, type scale, spacing, radii, and shadows for the web app are defined as **CSS variables** in this folder. **Edit `design-tokens-*.css` to retheme**; do not scatter hex values in feature code—use `var(--…)` in SCSS or add a variable in the token files.

## Token files

- **`design-tokens-base.css`** — Shared primitives (spacing scale, radius scale, focus rings, type scale in `rem`).
- **`design-tokens-dark.css`** — Semantic tokens for the default dark theme (`:root` / `html.dark`).
- **`design-tokens-light.css`** — Overrides for light mode (`html.light`).

These are imported from [`app/globals.css`](../app/globals.css) in order: base → dark → light, then global `body` rules (fonts, foreground/background).

## Component styles (Sass + CSS modules)

UI is styled with **co-located `*.module.scss` files** next to their `*.tsx` files. Rules should reference design tokens, for example `color: var(--color-fg-muted)` and `padding: var(--space-7)`.

- Optional shared patterns: [`_mixins.scss`](_mixins.scss) (e.g. input focus, body text) — use `@use` with a path relative to the module.

## Workflow

1. Change a semantic variable (e.g. `--color-accent-cta`) in the appropriate token file.
2. Rebuild or refresh; any SCSS or global CSS that uses that variable updates automatically.
3. For new components, add a `component-name.module.scss` and keep layout/spacing in tokens.

Fonts are self-hosted under `public/fonts` (see `styles/fonts.css`). Inter Variable + IBM Plex Mono latin woff2; Inter is preloaded from `index.html`.
