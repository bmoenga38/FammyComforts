# Fammy Comforts — Lounge Management System (PWA Prototype)

A premium, multi-role, installable **Progressive Web App** prototype for the Fammy Comforts
lounge & accommodation business (Kenyan hospitality market). Frontend-only — all data is
mocked. Built to match the authoritative design system in
`../stitch_fammycomforts_pwa_management_system/fammycomforts_design_system/DESIGN.md`.

> Future-ready: the Notification Center is designed around the SMS Sender ID **`FAMMY`**
> so it can later be wired to a real SMS + push gateway.

## Run it

No build step required.

```bash
# Option A — just open it
start index.html            # Windows
# (note: service worker + install prompt need http; file:// still renders fine)

# Option B — serve locally (enables PWA install / offline)
npx serve .                 # or: python -m http.server 8080
# then visit http://localhost:8080
```

## What's inside

| Role | Workspace |
|------|-----------|
| **Customer** | Home · Book a lounge (date→pay→QR) · My trips · Check-in QR · Rewards · Profile |
| **Reception** | Front desk (arrivals/departures) · Walk-ins · Occupancy board · Customer lookup |
| **Operations** | Daily ops KPIs · Analytics (revenue, occupancy, peak hours, retention) · Staff · Forecast |
| **Lounge Assistant** | Tasks · Room prep checklist · Maintenance · Incident reporting |
| **Administrator** | User management · Roles & permissions · Notification templates · Config · Audit log |

Switch roles from the **workspace switcher** (sidebar on desktop, drawer on mobile).

### Cross-cutting
- **Theme system** — dark default + airy light mode, toggled top-right, persisted to `localStorage`.
- **AI copilot** (UI) — `auto_awesome` button: try "Show today's occupancy", "Who is checking in next?".
- **Notification Center** — SMS / Push / Email previews rendered as phone bubbles, Sender ID `FAMMY`.
- **PWA** — `manifest.json` + `sw.js`, install prompt, offline cache, live network-status chip.

## Architecture

```
fammycomforts_pwa/
├─ index.html          App shell + Tailwind token config (from DESIGN.md)
├─ manifest.json       PWA manifest
├─ sw.js               Service worker (network-first nav, cache-first assets)
├─ css/styles.css      Compiled, hand-tuned stylesheet (runs as-is)
├─ scss/               SCSS source of the design system
│  ├─ _tokens.scss     Colors · radii · spacing · motion
│  ├─ _typography.scss Syne · Space Grotesk · Inter · JetBrains Mono
│  ├─ _themes.scss     Dark/light CSS-variable bindings
│  ├─ _layout.scss     Sidebar / bottom-nav / responsive grid
│  ├─ _components.scss Cards · badges · buttons · inputs · glass
│  └─ main.scss        Entry point
└─ js/
   ├─ data.js          Mock data (rooms, guests, bookings, staff, tasks, analytics)
   ├─ theme.js         html.dark toggle + persistence
   ├─ components.js    Reusable render helpers (kpi, roomCard, charts, toast, modal…)
   ├─ app.js           SPA engine: hash router, role nav, all views
   └─ pwa.js           SW registration · install · network status
```

## Design system (from DESIGN.md)
- **Colors** are semantic & status-driven: green = available/success, purple = VIP, cyan = info,
  orange = pending/cleaning, red = urgent/cancelled.
- **Money & codes** always render in **JetBrains Mono** as `KES 0,000`.
- **Cards** 14px radius · **controls** 10px · **badges** fully pill-shaped · soft colored glows over heavy shadows.
- **Dark is the default**; light mode is an airy ivory for daytime/outdoor use.

---
Prototype only — no backend. Generated as an investor-grade demo and a foundation for production planning.
