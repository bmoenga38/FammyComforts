# Fammy Comforts - Source Tree Analysis

**Date:** 2026-06-04

## Overview

Fammy Comforts is a single-repository (monolith) project that currently holds a front-end **prototype**, an extensive **planning/method layer**, and **visual reference** material. Application source is confined to `prototype/`; everything else is documentation, templates, or tooling.

## Complete Directory Structure

```
Fammy Comforts/
├── prototype/                  # The runnable UI prototype (only executable code)
│   ├── index.html              # App shell + all six role views (entry HTML)
│   ├── app.js                  # Vanilla JS: icons, view switching, theme, toasts
│   ├── styles.css              # Design-token CSS, theming, responsive layout
│   └── server.js               # Zero-dependency Node static file server (entry)
│
├── method/                     # Custom delivery-method templates (Fammy Comforts Method)
│   ├── 01-product/             # product-brief + role-permission templates
│   ├── 02-ux/                  # ux-design template
│   ├── 03-architecture/        # architecture template
│   ├── 04-backlog/             # epics + story templates
│   ├── 05-implementation/      # implementation checklist
│   ├── 06-qa/                  # qa checklist
│   └── 07-launch/              # launch checklist
│
├── ui-samples/                 # Visual references
│   └── arrowpath-reference/    # design-doc, login, mobile mockups (HTML)
│
├── docs/                       # BMAD-generated project documentation (this folder)
│
├── _bmad/                      # BMAD Method engine, modules, config, scripts
├── _bmad-output/               # BMAD workflow artifacts (planning/impl/test)
├── .claude/ .agents/ .codex/   # Installed BMAD agent skills per tool
│
├── PRD.md                      # Product Requirements Document
├── DESIGN_SYSTEM.md            # Visual system: fonts, tokens, components, icons
├── DEVELOPMENT_PHASES.md       # Delivery phases
├── DEMO_REVIEW_REPORT.md       # Findings from the reference (Kemet) app
├── UI_SAMPLES.md               # UI sample reference index
├── SOMMYCOMFORT_METHOD.md      # Custom method overview
└── .gitignore
```

## Critical Directories

### `prototype/`

The only directory containing executable code. A self-contained static web prototype plus a local server.

**Purpose:** Provide a clickable, themeable UI reference for all six operational roles before the production stack is built.
**Contains:** `index.html` (markup + all views), `app.js` (interaction logic), `styles.css` (design tokens + layout), `server.js` (local host).
**Entry Points:** `server.js` (process entry), `index.html` (served at `/`).

### `method/`

**Purpose:** Houses the custom "Fammy Comforts Method" templates that mirror BMAD's planning discipline but are tailored to accommodation operations (product → UX → architecture → backlog → implementation → QA → launch).
**Contains:** One markdown template per stage folder (`01-product` … `07-launch`).

### `ui-samples/arrowpath-reference/`

**Purpose:** Visual design references adapted from the "Arrowpath" project, used as the basis for `DESIGN_SYSTEM.md`.
**Contains:** `design-doc.html`, `login.html`, `mobile-mockups.html`, `mobile-mockups-admin.html`.

### `_bmad/` and `_bmad-output/`

**Purpose:** Installed BMAD Method v6 engine (modules `bmm`, `tea`, `bmb`, `cis`, `core`, `automator`) and its generated artifact folders. Tooling, not application code.

## Entry Points

- **Main Entry:** `prototype/server.js` — starts the Node HTTP server on `127.0.0.1:${PORT||4173}`.
- **Additional:**
  - `prototype/index.html`: the served document; loads `styles.css` and `app.js`.

## File Organization Patterns

- **Flat prototype:** the prototype is intentionally flat (4 files, no folders) — markup, style, behavior, and server are each one file.
- **Numbered method stages:** `method/NN-stage/` enforces an ordered delivery flow.
- **Docs at root vs. `docs/`:** Human-authored planning docs live at the repo root; machine-/BMAD-generated docs live in `docs/`.

## Key File Types

### HTML
- **Pattern:** `prototype/index.html`, `ui-samples/**/*.html`
- **Purpose:** App shell and views; static visual references.
- **Examples:** `index.html`, `mobile-mockups-admin.html`

### JavaScript
- **Pattern:** `prototype/*.js`
- **Purpose:** Browser interaction (`app.js`) and Node static server (`server.js`).

### CSS
- **Pattern:** `prototype/styles.css`
- **Purpose:** Design-token theming and responsive layout.

### Markdown
- **Pattern:** root `*.md`, `method/**/*.md`, `docs/*.md`
- **Purpose:** Requirements, design system, method templates, generated docs.

## Asset Locations

No binary assets (images/audio/3D) are committed; the prototype uses inline SVG icons (defined in `app.js`) and a CSS-drawn "room visual". Fonts are loaded from Google Fonts CDN.

## Configuration Files

- **`prototype/server.js`**: contains the only runtime config — `PORT` env var (default `4173`) and the MIME-type table.
- **`.gitignore`**: ignores `.vscode/`, `node_modules/`, `dist/`, `build/`, `.env*`, logs, `Thumbs.db`, `Desktop.ini`.
- **`_bmad/config.toml`, `_bmad/bmm/config.yaml`**: BMAD tooling configuration (project name, output folders, user).

## Notes for Development

- The prototype has **no dependencies and no build step** — edit the four files and refresh.
- When migrating to the production stack (Next.js/React per PRD), the six views map naturally to routes/role layouts, the CSS tokens map to a Tailwind theme, and the inline SVG icon registry maps to `lucide-react`.
- The Node server is for **local preview only**; it is not a production server and exposes no APIs.

---

_Generated using BMAD Method `document-project` workflow_
