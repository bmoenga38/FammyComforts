# SommyComfort - Development Guide

**Date:** 2026-06-04

This guide covers working with the current **prototype**. There is no build system, dependency tree, or test suite yet — the prototype is intentionally minimal.

## Prerequisites

- **Node.js** v18+ (only to run the local static server). Verify with `node -v`.
- A modern browser (Chrome/Edge/Firefox/Safari) for previewing the PWA-style UI.
- No package manager, compiler, or framework CLI is required.

## Project Layout (what you edit)

All runnable code is in `prototype/`:

| File | Edit when you want to… |
|---|---|
| `prototype/index.html` | Add/change a view, markup, or demo data |
| `prototype/styles.css` | Adjust design tokens, theming, layout |
| `prototype/app.js` | Change interactions, icons, view logic |
| `prototype/server.js` | Change local server behavior (port, MIME) |

## Run Locally

```bash
cd prototype
node server.js
```

Then open <http://127.0.0.1:4173>. To use a different port:

```bash
# PowerShell
$env:PORT = 5000; node server.js
# bash
PORT=5000 node server.js
```

> The server reads files fresh on each request, so you only need to **refresh the browser** after editing `index.html`, `styles.css`, or `app.js`. Changes to `server.js` require restarting `node server.js`.

## Build

No build step — assets are served as-is. There is no bundler, transpiler, or minifier.

## Testing

No test framework is configured. The BMAD `tea` module and `method/06-qa/qa-checklist.md` are available for designing tests when the production stack lands, but nothing is wired up today.

## Common Tasks

### Add a new role view
1. In `index.html`, add a `<button class="nav-item" data-view="myview">` in `.nav-list` and a matching `<section class="view" id="myview">` in `.main-panel`.
2. In `app.js`, add `myview: "My View Title"` to the `titleByView` map.
3. Reuse existing component classes (cards, status chips, tables) for consistency.

### Add an icon
1. Add an entry to the `icons` map in `app.js` (name → inline SVG string).
2. Use it anywhere with `<span data-icon="name"></span>`.

### Add/adjust a status color
Edit the semantic status tokens in `styles.css` / per `DESIGN_SYSTEM.md` (success/info/warning/danger/premium) — don't hard-code hex values in components.

## Conventions

- **Design tokens over literals:** reference CSS custom properties (e.g. `var(--primary)`), not raw colors — keeps dark/light parity.
- **Class-based components:** reuse the documented component classes (see [component-inventory.md](./component-inventory.md)) instead of bespoke one-off styles.
- **Vanilla only (for now):** the prototype has zero dependencies — keep it that way until the production stack is chosen, so it stays trivially runnable.
- **Accessibility:** preserve existing `aria-*` labels, `role="status"` on the toast, and visible focus styles.

## Migration Notes (prototype → production)

Per [PRD.md](../PRD.md) §10 the production app is expected to be Next.js/React + TypeScript + Tailwind, with a REST backend (Laravel/NestJS/Django), PostgreSQL/MySQL, realtime via WebSockets, and PWA service-worker support. When migrating:

- Map the six views to routes/role layouts.
- Translate `styles.css` tokens into a Tailwind theme.
- Replace the inline SVG `icons` map with `lucide-react`.
- Replace hard-coded demo data with API-backed data per the PRD entity list.

## Next Planning Steps (BMAD)

This documentation feeds the BMAD planning flow. Recommended next:

1. `/bmad-create-architecture` — design the real architecture (DB, API, PWA, auth, realtime), referencing `docs/index.md` and `PRD.md`.
2. `/bmad-prd` — bring the existing `PRD.md` into a BMAD-structured PRD if you want it gated/validated.
3. `/bmad-create-epics-and-stories` → `/bmad-sprint-planning` → build loop.

---

_Generated using BMAD Method `document-project` workflow_
