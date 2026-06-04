# SommyComfort - Project Overview

**Date:** 2026-06-04
**Type:** Web (frontend) — installable PWA prototype
**Architecture:** Static multi-view single-page prototype served by a zero-dependency Node static file server

## Executive Summary

SommyComfort is a mobile-first **accommodation / rental operations platform** intended to ship as a production Progressive Web App (PWA). It targets the full operational surface of a guest-house / serviced-apartment business: guest self-booking, front-desk reservations, room & asset management, housekeeping, inventory, restaurant / room-service, payments (cash, M-Pesa, card), role-based staff access, notifications, and business reporting.

The repository today is in the **planning + prototype** stage. It contains:

- A working **front-end prototype** (`prototype/`) — a single `index.html` with six role-based views (Guest, Admin, Front Desk, Operations, Housekeeping, Kitchen), styled with a custom design-token CSS system, driven by a small vanilla-JS file (`app.js`), and served locally by a tiny Node `http` static server (`server.js`).
- A complete **product/requirements + method layer** (`PRD.md`, `DESIGN_SYSTEM.md`, `DEVELOPMENT_PHASES.md`, `DEMO_REVIEW_REPORT.md`, the `method/` template set, and `ui-samples/`).

There is **no backend, database, build pipeline, or test suite yet** — those are specified in the PRD as the target architecture but not implemented. The prototype is a clickable UI reference, not a functional application.

## Project Classification

- **Repository Type:** Monolith (single part)
- **Project Type(s):** Web — frontend prototype (vanilla HTML/CSS/JS) + minimal Node static server
- **Primary Language(s):** JavaScript (ES6, browser + Node), HTML5, CSS3
- **Architecture Pattern:** Client-side multi-view switching (no router/framework); static asset serving over Node's built-in `http` module

## Technology Stack Summary

| Category | Technology | Version | Justification |
|---|---|---|---|
| Markup | HTML5 | — | Single-document app shell with six `<section class="view">` panels |
| Styling | CSS3 with custom properties (design tokens) | — | Dark/light theming via `[data-theme]`, status color system, responsive layout |
| Client logic | Vanilla JavaScript (ES6) | — | Icon injection, view switching, theme toggle, toast, demo interactions — no framework |
| Web server | Node.js `http`/`fs`/`path` (built-in) | Node ≥ 18 recommended | Zero-dependency static file server for local prototype preview |
| Fonts | Google Fonts: Inter, Space Grotesk, Syne, JetBrains Mono | — | Per `DESIGN_SYSTEM.md` typography spec |
| Package manager | None | — | No `package.json`; prototype has no third-party dependencies |

> **Planned (per [PRD.md](../PRD.md) §10), not yet implemented:** Next.js/React + TypeScript + Tailwind front end; Laravel/NestJS/Django REST backend; PostgreSQL/MySQL; WebSockets realtime; Redis queues; S3 storage; M-Pesa Daraja payments; email/SMS/WhatsApp/push notifications.

## Key Features

The prototype demonstrates these role-based screens (see [component-inventory.md](./component-inventory.md)):

- **Guest Booking** — hero, room catalog cards with status chips, and a reservation form with cash / M-Pesa / card payment selection.
- **Admin** — KPI metric grid (occupancy, revenue, outstanding, open tasks), recent-bookings table, payment breakdown bars.
- **Front Desk** — room availability calendar board with per-day status slots.
- **Operations** — phone-framed mobile daily-ops dashboard with alerts and an action queue.
- **Housekeeping** — task cards with cleaning checklists and complete/flag actions.
- **Kitchen** — Kanban order board (Pending / Preparing / Ready / Served).

Cross-cutting prototype behaviors: light/dark theme toggle persisted to `localStorage`, inline SVG icon injection, toast notifications, mobile slide-in navigation, and smooth-scroll CTAs.

## Architecture Highlights

- **Single HTML shell, no router:** all six views live in `index.html`; `app.js` toggles an `.active` class to switch views and update the page title. No client-side routing library.
- **Design-token theming:** `styles.css` defines CSS custom properties for dark and light palettes; the theme is switched by setting `data-theme` on `<html>` and saved to `localStorage` under `sommycomfort-theme`.
- **Inline SVG icon registry:** `app.js` holds an `icons` map and hydrates any `[data-icon]` element — the production app is expected to migrate to `lucide-react` (per `DESIGN_SYSTEM.md`).
- **Static, hardened server:** `server.js` resolves requests under the prototype root only (path-traversal guard via `file.startsWith(root)`), maps a small MIME table, and returns 403/404 appropriately. No application logic or APIs.

## Development Overview

### Prerequisites

- Node.js (v18+ recommended) — only needed to run the local static server. The prototype can also be opened directly as a file, though serving via Node is preferred for correct MIME types.

### Getting Started

```bash
cd prototype
node server.js
# → SommyComfort prototype running on http://127.0.0.1:4173
```

Set `PORT` to override the default 4173.

### Key Commands

- **Install:** _none — no dependencies_
- **Dev:** `node server.js` (from `prototype/`)
- **Build:** _none — static assets, no build step_
- **Test:** _none — no test suite yet_

## Repository Structure

Monolith with a clear split between the **prototype app** (`prototype/`), **product/planning docs** (root `*.md` + `method/`), and **visual references** (`ui-samples/`, `DESIGN_SYSTEM.md`). BMAD-generated documentation lives in `docs/`; BMAD workflow tooling lives in `_bmad/` with outputs in `_bmad-output/`.

## Documentation Map

For detailed information, see:

- [index.md](./index.md) - Master documentation index
- [architecture.md](./architecture.md) - Detailed architecture
- [source-tree-analysis.md](./source-tree-analysis.md) - Directory structure
- [component-inventory.md](./component-inventory.md) - UI component catalog
- [development-guide.md](./development-guide.md) - Development workflow

---

_Generated using BMAD Method `document-project` workflow_
