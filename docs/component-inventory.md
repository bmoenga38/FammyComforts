# Fammy Comforts - Component Inventory

**Date:** 2026-06-04

This catalogs the UI building blocks present in the **prototype** (`prototype/index.html` + `styles.css` + `app.js`). These are CSS-class-based components (no framework components yet). They define the visual vocabulary the production app should reproduce in React/Tailwind.

## Views (role-based screens)

| View ID | Title | Role | Highlights |
|---|---|---|---|
| `guest` | Guest Booking | Guest/client | Hero, featured booking card, room catalog, reservation form |
| `admin` | Admin Dashboard | Admin/owner | KPI metric grid, recent-bookings table, payment breakdown |
| `frontdesk` | Front Desk Calendar | Reception | Room availability calendar board |
| `operations` | Operations Manager | Ops manager | Phone-framed mobile daily-ops dashboard |
| `housekeeping` | Housekeeping Tasks | Housekeeping | Task cards with checklists and complete/flag actions |
| `kitchen` | Kitchen Display | Restaurant/kitchen | Kanban order lanes |

Views are toggled by `.nav-item` buttons via the `.active` class; titles come from the `titleByView` map in `app.js`.

## Layout & Navigation

| Component | Class / ID | Purpose |
|---|---|---|
| App shell | `.app-shell` | Sidebar + main panel grid |
| Sidebar | `.sidebar`, `.brand`, `.nav-list`, `.nav-item` | Brand mark, role navigation, footer |
| Sidebar footer | `.sidebar-footer`, `.online-pill`, `.theme-toggle` | "PWA ready" pill + theme toggle |
| Top bar | `.topbar`, `.eyebrow`, `#pageTitle`, `.top-actions` | Page title, search, notification bell |
| Mobile menu | `#mobileMenu`, `body.menu-open` | Slide-in nav on small screens |
| Search | `.search` | Global search input (visual only) |

## Display & Data Components

| Component | Class | Used in | Purpose |
|---|---|---|---|
| Metric tile | `.metric`, `.metric-grid` | Admin | KPI cards (occupancy, revenue, outstanding, tasks) |
| Panel | `.panel`, `.panel-head` | Admin | Sectioned content container |
| Data table | `.table-wrap`, `table` | Admin | Recent bookings list |
| Breakdown bars | `.breakdown` (`--w` width var) | Admin | Payment-method distribution |
| Status chip | `.status` + `.success`/`.info`/`.warning`/`.danger` | All | State badges (Available, Confirmed, Cleaning, Urgent…) |
| Status dot | `.status-dot` + variant | Operations | Inline state indicators in action queue |
| Chip row | `.chip-row` | Guest | Amenity tags (WiFi, 2 beds, Clean) |
| Segmented control | `.segmented` | Guest | Catalog filter (All / Available / Premium) |

## Domain Cards & Boards

| Component | Class | View | Purpose |
|---|---|---|---|
| Booking card | `.booking-card`, `.room-visual`, `.room-window/bed/lamp` | Guest | Featured room with CSS-drawn room visual + price |
| Room card | `.room-card`, `.mini-room` | Guest | Catalog grid item |
| Booking form | `.booking-form`, `.form-grid`, `.payment-strip`, `.payment-option` | Guest | Reservation capture + cash/M-Pesa/card selector |
| Calendar board | `.calendar-board`, `.calendar-row`, `.slot` (`available`/`booked`/`clean`/`warning`) | Front Desk | Per-room availability across days |
| Phone stage | `.phone-stage`, `.phone`, `.phone-content`, `.ops-alert`, `.ops-list` | Operations | Mobile dashboard mockup with alert + action queue |
| Task card | `.task-card`, `.checklist`, `.complete-task` | Housekeeping | Cleaning task with checklist + complete/flag |
| Kanban | `.kanban`, `.order-card`, `.empty-state` | Kitchen | Pending / Preparing / Ready / Served lanes |

## Controls & Feedback

| Component | Class / ID | Purpose |
|---|---|---|
| Buttons | `.btn` + `.primary`/`.ghost`/`.small`/`.full` | Primary/secondary actions |
| Icon button | `.icon-btn`, `.dot` | Notification bell with unread dot |
| Theme toggle | `#themeToggle`, `.sun`, `.moon` | Dark/light switch (persists to `localStorage`) |
| Toast | `#toast` (`.show`) | Transient confirmation messages (~2.6s) |
| Inline SVG icons | `[data-icon]` + `icons` map in `app.js` | bed, dashboard, calendar(+plus), wrench, brush, chef, sun, moon, menu, search, bell, smartphone, shield, credit, warning |

## Design System Linkage

Component styling follows [DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md):

- **Tokens:** dark/light palettes via CSS custom properties on `[data-theme]`; status colors map success→primary(green), info→cyan, warning→orange, danger→red, premium→accent(purple).
- **Radii/borders:** 8px radius, 1px borders for cards/buttons/inputs.
- **Fonts:** Inter (UI), Space Grotesk (headings), Syne (expressive), JetBrains Mono (IDs/numbers).
- **Production target:** icons should migrate to `lucide-react`; the recommended Lucide mapping is in `DESIGN_SYSTEM.md`.

## Interactive Behaviors (`app.js`)

| Behavior | Trigger | Effect |
|---|---|---|
| Icon hydration | on load | Fills `[data-icon]` with inline SVG |
| Theme restore | on load | Applies saved `sommycomfort-theme` |
| Theme toggle | `#themeToggle` click | Flips theme, persists, toasts |
| View switching | `.nav-item` click | Activates view + updates title |
| Mobile menu | `#mobileMenu` click | Toggles `body.menu-open` |
| Payment select | `.payment-option` click | Activates chosen method |
| Smooth scroll | `[data-scroll-target]` click | Scrolls to target section |
| Booking confirm | `#confirmBooking` click | Demo toast with fake reference |
| Task complete | `.complete-task` click | Marks task done, disables button, toasts |

---

_Generated using BMAD Method `document-project` workflow_
