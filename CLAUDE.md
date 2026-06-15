# AngorHub — Project Instructions

Angular 21 front-end for Angor (Bitcoin project funding). Standalone-component Angular app, Tailwind CSS 3, Nostr (NDK / nostr-tools) for data.

## Scope: FRONT-END ONLY

This is a UX/UI workstream. Work ONLY on the front-end. This OVERRIDES any default behavior.

- Touch only client-facing code: `src/app/**` (components, pages, pipes), `src/assets/**`, `src/styles*`, `*.html` templates, Tailwind/PostCSS config, and component-level TypeScript that drives the view.
- DO change: templates, styles, layout, component view logic, routing for navigation/UX, accessibility, responsiveness, animations, assets.
- DO NOT change: backend/server code (`express`), API contracts, Nostr/relay protocol logic in `src/app/services/**`, data models in `src/app/models/**`, build/deploy infra, or dependency versions — unless the user explicitly asks.
- Treat services and models as read-only data sources. If a UX task seems to require a service/model/data change, STOP and ask the user first; do not modify them silently.
- No new runtime dependencies without explicit approval (see global rules). Prefer existing UI primitives already in the repo.

## Design system (ported from the Angor Prototype)

Source of truth for visual design is the local **Angor Prototype** (`~/Projects/angor-prototype/angor-prototype`, Vue 3). When porting UI here, reproduce it faithfully, then express it through the shared tokens/classes below — don't hardcode hex values in components.

- **Theme tokens** live in `src/styles.css` as CSS variables on `:root` (dark, default) and `html[data-theme="light"]`. Aligned to the prototype's `ultra-modern` / `ultra-modern-light` palettes. Use the Tailwind aliases (`bg-surface-ground`, `text-text`, `text-accent`, etc.) or `var(--token)`.
- **Buttons** (global classes in `styles.css`, combine with `.btn-base`): `.btn-neutral` (flat grey, prototype's primary CTA), `.btn-green` (flat brand green), `.btn-gradient` (green gradient — the reusable atom style). All theme-aware.
- **Hero text**: `.hero-font` + `.highlight-text` (italic green emphasis).
- **Background pattern**: applied once on the app shell (`app.component`) via `.pattern-overlay` (fixed, behind all content). Pages should keep section backgrounds transparent so it shows through; don't re-add it per page.
- Theme is read reactively via `ThemeService.isDarkTheme()` (signal-backed). Treat `ThemeService` as read-only.

## Dev workflow

- Dev server: `npm start` → http://localhost:4200/ (watch mode, auto-reload).
- Build: `npm run build` · Lint: `npm run lint`. Type-check and lint before considering work done.
- Tests: `npm test` (Karma/Jasmine).
