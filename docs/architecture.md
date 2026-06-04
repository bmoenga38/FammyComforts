# SommyComfort - Architecture

**Date:** 2026-06-04
**Status:** Prototype (front-end only). Production architecture is specified in [PRD.md](../PRD.md) §10 but not yet implemented.

## Executive Summary

The current architecture is a **static, framework-free web prototype** served by a minimal Node static file server. All UI lives in a single HTML document; a small vanilla-JS script provides interactivity (view switching, theming, toasts); CSS custom properties provide the design system. There is no backend, persistence, authentication, or API layer in code today — those are planned.

This document describes (1) the **as-built** prototype architecture and (2) the **target** production architecture from the PRD, so feature planning can distinguish what exists from what is intended.

## Technology Stack

| Category | Technology | Notes |
|---|---|---|
| Markup | HTML5 | Single shell, six `<section class="view">` panels |
| Styling | CSS3 custom properties | Dark/light tokens, status colors, responsive grid/flex |
| Client logic | Vanilla ES6 JS | No framework, no bundler |
| Server | Node.js built-in `http`/`fs`/`path` | Static files only, zero npm dependencies |
| Typography | Google Fonts (Inter, Space Grotesk, Syne, JetBrains Mono) | Loaded via CDN `<link>` |

## Architecture Pattern (as-built)

**Pattern:** Client-side multi-view toggle (poor-man's SPA) over a static file host.

```
Browser ── GET / ──▶  server.js (Node http)
                         │  resolves path under prototype/ root only (403 if escapes)
                         │  maps extension → MIME, reads file, 200 / 404
                         ▼
                     index.html ──loads──▶ styles.css  (design tokens, layout, theming)
                                  └─loads──▶ app.js      (icons, view switching, theme, toasts)
```

### Key mechanisms

1. **View switching** — `app.js` listens on `.nav-item` buttons; clicking one removes `.active` from all nav items and `.view` sections, adds `.active` to the chosen pair, updates `#pageTitle` from a `titleByView` map, and closes the mobile menu. No URL/router involvement.
2. **Theming** — `data-theme` on `<html>` selects the CSS token set. The toggle button flips `dark`⇄`light` and persists to `localStorage["sommycomfort-theme"]`; the saved value is re-applied on load.
3. **Icon injection** — an `icons` object maps names to inline SVG markup; on load, every `[data-icon]` element is hydrated with the matching SVG.
4. **Ephemeral feedback** — `showToast()` shows a `#toast` element for ~2.6s; used by booking confirm and housekeeping completion demos.
5. **Server safety** — `server.js` normalizes the joined path and rejects anything not under `root` (path-traversal guard), returning `403`; missing files return `404`.

## Data Architecture

**As-built:** None. The prototype contains only hard-coded demo data inside the HTML (sample rooms, bookings, tasks, orders). There are no models, no database, and no persistence beyond the theme preference in `localStorage`.

**Planned (PRD §8):** ~28 core entities including Property, Branch, User/Staff, Role & Permission, Guest, Guest Document, Room, Room Type, Amenity, Rate Plan, Booking, Booking Payment, Invoice/Receipt, Housekeeping Task, Maintenance Issue, Room Asset, Asset Check, Damage Charge, Product, Product Category, Supplier, Purchase Order, Stock Movement, Stocktake, Restaurant Order (+ Items), Notification Log, Audit Log. These are not modeled in code yet — they are the input for the future `/bmad-create-architecture` and data-model work.

## API Design

**As-built:** None. `server.js` serves static files only — there are no application endpoints, no JSON APIs, and no request handlers beyond static file resolution.

**Planned (PRD §10):** A REST API (Laravel / NestJS / Django candidate) with realtime channels (WebSockets) for housekeeping, kitchen, calendar, and dashboard updates, plus payment callbacks (M-Pesa Daraja) and queued notification jobs.

## Component Overview

The prototype's UI is organized as six role views built from reusable CSS-class "components" (cards, status chips, tables, metric tiles, task cards, kanban columns, calendar slots). See [component-inventory.md](./component-inventory.md) for the full catalog.

## Source Tree

See [source-tree-analysis.md](./source-tree-analysis.md). In brief: `prototype/` holds all code (4 files); `method/`, `ui-samples/`, and root `*.md` hold planning/design; `_bmad/` + `_bmad-output/` hold tooling.

## Development Workflow

See [development-guide.md](./development-guide.md). In brief: `cd prototype && node server.js`, then open `http://127.0.0.1:4173`. No install, no build, no tests.

## Deployment Architecture

**As-built:** None. No Dockerfile, CI/CD, or hosting config is present. The prototype can be served by any static host, but no deployment is configured.

**Planned (PRD §6/§9):** Installable PWA (service worker, offline shell, background sync, push), S3-compatible storage for documents/images, daily backups, encryption in transit, and audit logging.

## Testing Strategy

**As-built:** None. No test files or test runner are present.

**Planned:** The repo includes a BMAD `tea` (Test Architect) module and a `method/06-qa/` checklist for future test design; nothing is wired up yet.

## Non-Functional Targets (from PRD §9/§11)

Mobile-first responsive UI; strong auth + RBAC; secure ID-document storage; audit logs for sensitive actions; PDF/CSV export; near-realtime updates; Lighthouse PWA ≥ 90; booking in < 3 min (guest) / < 2 min (reception); offline-capable housekeeping updates.

---

_Generated using BMAD Method `document-project` workflow_
