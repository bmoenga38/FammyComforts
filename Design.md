# Fammy Comforts — Design Brief for Stitch AI

> Paste this entire file into Stitch. It is a complete, self-contained spec.
> At the end is an **EXPORT INSTRUCTIONS** section — follow it so the output
> comes back as files (HTML + CSS, or component files) that can be saved directly.

---

## 1. Product

**Fammy Comforts** is a modern, mobile-first **Progressive Web App (PWA)** for
running a Kenyan accommodation / hotel business. It has two clearly separated
experiences:

1. **Guest side** — public, polished, welcoming. Browse rooms, book, pay, no account required.
2. **Staff / Operations side** — fast, dense, status-driven dashboards used many
   times a day on mid-range Android phones (Admin, Front Desk, Operations
   Manager, Housekeeping, Restaurant/Kitchen).

**Currency is Kenyan Shilling (KES) everywhere.** Format as `KES 3,500`
(thousands separator, no decimals for whole amounts). Show prices per night as
`KES 3,500/night`.

**Design personality:** modern, calm, operational, premium hospitality.
NOT a gaming or fleet dashboard. Neon accents are used sparingly on a restrained
base. Guest screens get more whitespace and photos; staff screens prioritize
speed, clarity, and status visibility.

---

## 2. Design Tokens

Implement **both dark mode (default) and light mode** using CSS variables on
`[data-theme="dark"]` / `[data-theme="light"]`.

### Dark mode (default)
```css
--primary:      #50fa7b;  /* green - success/available/paid */
--accent:       #bd93f9;  /* purple - VIP/premium/manager action */
--cyan:         #8be9fd;  /* info/confirmed */
--orange:       #ffb86c;  /* warning/pending/cleaning */
--red:          #ff5555;  /* danger/overdue/damage */
--bg-deep:      #0c0d14;  /* page background */
--bg-alt:       #21222c;
--bg-card:      #2d2f3d;
--bg-input:     #353849;
--border:       #44475a;
--text:         #f8f8f2;
--text-muted:   #9ca3af;
--heading:      #f8f8f2;
```

### Light mode
```css
--primary:      #16a34a;
--accent:       #7c3aed;
--cyan:         #0891b2;
--orange:       #ea580c;
--red:          #dc2626;
--bg-deep:      #eef2f7;
--bg-alt:       #ffffff;
--bg-card:      #ffffff;
--bg-input:     #f1f5f9;
--border:       #e2e8f0;
--text:         #1e293b;
--text-muted:   #64748b;
--heading:      #0f172a;
```

### Status color mapping
| Meaning | Color |
|---|---|
| Available, paid, clean, completed | green `--primary` |
| Confirmed, checked-in, informational | cyan `--cyan` |
| Pending, partial payment, cleaning, checkout-due | orange `--orange` |
| Overdue, failed, damage, missing asset, urgent | red `--red` |
| VIP, premium room, manager action | purple `--accent` |

---

## 3. Typography

Load from Google Fonts:
```
Inter (400-700), Space Grotesk (400-700), Syne (600-800), JetBrains Mono (400-700)
```
- **Body / UI text:** `Inter`
- **Headings:** `Space Grotesk`
- **Big hero / marketing headline:** `Syne`
- **Money amounts, booking IDs, order IDs, table numbers:** `JetBrains Mono`
  with `font-variant-numeric: tabular-nums`

---

## 4. Components & Style Rules

- **Cards:** 14px radius, 1px `--border`, subtle shadow. Room cards use a real
  photo at the top with an `object-fit: cover` image (200–240px tall).
- **Buttons:** 10px radius, min-height 46px, icon + label. Primary = solid green
  with a soft glow shadow; ghost = `--bg-alt` background.
- **Inputs:** 10px radius, `--bg-input` background, visible green focus ring
  (`box-shadow: 0 0 0 3px` of the primary at 8% alpha).
- **Status badges / chips:** pill-shaped (999px radius), 0.76rem bold, colored
  by the status mapping above.
- **Tables:** dense but readable, sticky header, horizontal scroll on mobile,
  monospace for the reference/ID column.
- **Icons:** Lucide style, 20px, 2px stroke, rounded line caps. Use:
  `BedDouble, LayoutDashboard, CalendarCheck, CalendarPlus, CalendarDays, Users,
  Brush, Wrench, PackageCheck, Boxes, Utensils, ChefHat, CreditCard, Smartphone,
  Bell, Settings, Search, Sun, Moon, ShieldCheck, LogOut`.

---

## 5. Layout & Responsiveness (mobile-first)

- **Desktop (>1060px):** fixed left **sidebar** (280px) with brand + nav +
  theme toggle, main content area with a sticky top bar (page title + search +
  notifications).
- **Tablet (≤1060px):** sidebar collapses into a slide-in drawer opened by a
  hamburger; multi-column grids drop to 2 columns.
- **Phone (≤760px):** show a **fixed bottom navigation bar** (Book, Admin, Desk,
  Clean, Kitchen) with icon + label; respect `env(safe-area-inset-bottom)`.
  Grids collapse to 1–2 columns; large tap targets (min 44px).

---

## 6. Screens to Generate

Generate each screen in **both dark and light mode**. Use real-looking room
photography for guest screens (hotel/apartment interiors).

1. **Guest — Room catalog & booking** *(primary screen)*
   - Hero: headline, "Book a Room" + "Install PWA" buttons, trust row
     (ID-verified check-in · Pay via M-Pesa · Free cancellation 24h), and a
     featured room card with photo, `Available` badge, `KES 3,500/night`.
   - "Rooms and suites" section with a segmented filter (All / Available /
     Premium) and a grid of room cards: photo, status badge, name, capacity ·
     beds · location, price `KES x,xxx/night`.
   - Booking form: check-in, check-out, full name, phone (+254…), email,
     ID number; a price summary row (`2 nights · Executive Studio 6A` →
     `KES 7,000`); payment method toggle (Cash / M-Pesa / Card); Confirm button.

2. **Admin dashboard**
   - 4 metric cards: Occupancy `80%`, Revenue `KES 87,006`, Outstanding
     `KES 46,958`, Housekeeping `2 open tasks`.
   - "Recent bookings" table (Ref, Guest, Room, Status badge, Balance in KES).
   - "Payment breakdown" panel with Cash / M-Pesa / Card progress bars in KES.

3. **Front Desk — availability calendar**
   - "New Booking" button. A room-by-day grid (Room | Today | Tomorrow |
     Weekend) with colored slots: Available / Booked / Cleaning / Checkout.

4. **Operations Manager — mobile dashboard** (render inside a phone frame)
   - "Today" heading, an orange priority alert ("Room 103 needs priority
     cleaning"), a list of action rows with status dots (rooms available,
     housekeeping tasks, unpaid balance, kitchen order) each with an action,
     and a "Create task" button.

5. **Housekeeping — task board**
   - Task cards with status badge (In progress / Urgent), title, description, a
     cleaning checklist (checkboxes: Bedding changed, Bathroom cleaned, Assets
     verified), and a "Mark complete" / "Upload evidence" button.

6. **Restaurant / Kitchen — display board**
   - Kanban columns: Pending, Preparing, Ready, Served. Order cards show a
     monospace order ID (`ORD-811D6E`), description, and KES amount. Empty
     columns show an "No ready orders" empty state.

7. **Login + PWA install** (bonus)
   - Centered card: brand, email + password, sign-in button, and an "Install
     app" prompt; online/offline indicator.

---

## 7. Out of Scope (do NOT design)

Multi-property enterprise hierarchy, OTA/channel-manager integrations, loyalty
programs, dynamic pricing, full accounting, biometric ID, native apps. Keep to
the screens in section 6.

---

## 8. EXPORT INSTRUCTIONS  ← important

Produce **downloadable / copy-pasteable files**, not just a preview:

1. Output as a small set of files with clear names:
   - `index.html` — all screens, semantic HTML, linked to the stylesheet.
   - `styles.css` — all design tokens (both themes) + component styles.
   - `app.js` — theme toggle (persist to `localStorage`), view switching,
     payment toggle, and mobile drawer/bottom-nav behavior.
   - If your export targets React, instead output one file per screen as
     `.jsx` components plus a `tokens.css`, and a `README` listing them.
2. Use **plain HTML/CSS/vanilla JS** (no build step) unless React export is
   selected. Use CSS variables for all colors so theme switching is one
   attribute (`data-theme`) on `<html>`.
3. Use semantic, accessible markup: real `<button>`, `<label>` for inputs,
   `alt` text on images, sufficient contrast, keyboard focus styles.
4. Make every screen responsive per section 5, mobile-first.
5. At the very end, **list each file name and its full contents in separate
   code blocks** so they can be copied out one by one.

When ready, return the files. Begin with `index.html`.