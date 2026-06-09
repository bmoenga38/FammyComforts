# Design System: Fammy Comforts Accommodation PWA

This visual direction is adapted from the Arrowpath project at `C:\Users\brycode\Desktop\Brian\Web\arrowpath`.

Reference UI samples are stored in:

- `ui-samples/arrowpath-reference/mobile-mockups.html`
- `ui-samples/arrowpath-reference/mobile-mockups-admin.html`
- `ui-samples/arrowpath-reference/login.html`
- `ui-samples/arrowpath-reference/design-doc.html`

## Design Personality

The app should feel modern, calm, operational, and premium. The guest side can be more polished and welcoming, while admin and operations screens should prioritize speed, clarity, status visibility, and repeated daily use.

Use the Arrowpath-inspired neon accent system carefully. For this accommodation product, avoid making the entire UI feel like a fleet or gaming interface. Use the green, purple, cyan, and orange colors as accents on a restrained hospitality operations base.

## Font Families

Primary UI font:

```css
font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

Display and headings:

```css
font-family: "Space Grotesk", "Inter", system-ui, sans-serif;
```

Optional expressive headings for premium admin/marketing screens:

```css
font-family: "Syne", "Space Grotesk", "Inter", sans-serif;
```

Code, references, booking IDs, and compact numeric labels:

```css
font-family: "JetBrains Mono", "Cascadia Code", "Fira Code", Consolas, monospace;
```

Google Fonts reference:

```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&family=Syne:wght@500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
```

## Dark Mode Tokens

```css
:root,
[data-theme="dark"] {
  --primary: #50fa7b;
  --primary-dark: #69ff90;
  --primary-dim: rgba(80, 250, 123, 0.08);
  --primary-glow: rgba(80, 250, 123, 0.25);
  --accent: #bd93f9;
  --accent-dim: rgba(189, 147, 249, 0.08);
  --cyan: #8be9fd;
  --orange: #ffb86c;
  --red: #ff5555;
  --pink: #ff79c6;
  --yellow: #f1fa8c;

  --bg-deep: #0c0d14;
  --bg: #282a36;
  --bg-alt: #21222c;
  --bg-card: #2d2f3d;
  --bg-input: #353849;
  --border: #44475a;
  --border-focus: #50fa7b;

  --text: #f8f8f2;
  --text-muted: #9ca3af;
  --text-dim: #6b7280;
  --heading: #f8f8f2;
}
```

## Light Mode Tokens

```css
[data-theme="light"] {
  --primary: #16a34a;
  --primary-dark: #065f28;
  --primary-dim: rgba(22, 163, 74, 0.08);
  --primary-glow: rgba(22, 163, 74, 0.15);
  --accent: #7c3aed;
  --accent-dim: #f5f3ff;
  --cyan: #0891b2;
  --orange: #ea580c;
  --red: #dc2626;
  --pink: #db2777;
  --yellow: #a16207;

  --bg-deep: #f1f5f9;
  --bg: #f8fafc;
  --bg-alt: #ffffff;
  --bg-card: #ffffff;
  --bg-input: #e2e8f0;
  --border: #cbd5e1;
  --border-focus: #16a34a;

  --text: #1e293b;
  --text-muted: #64748b;
  --text-dim: #94a3b8;
  --heading: #0f172a;
}
```

## Semantic Status Colors

```css
:root {
  --status-success: var(--primary);
  --status-info: var(--cyan);
  --status-warning: var(--orange);
  --status-danger: var(--red);
  --status-premium: var(--accent);

  --badge-danger-bg: rgba(255, 85, 85, 0.12);
  --badge-warning-bg: rgba(255, 184, 108, 0.12);
  --badge-info-bg: rgba(139, 233, 253, 0.10);
  --badge-success-bg: rgba(80, 250, 123, 0.10);
}
```

Recommended accommodation status mapping:

| Use Case | Color |
|---|---|
| Available, paid, clean, completed | `--status-success` |
| Confirmed, assigned, informational | `--status-info` |
| Pending, partial payment, cleaning | `--status-warning` |
| Overdue, failed, damage, missing asset | `--status-danger` |
| VIP, premium room, manager action | `--status-premium` |

## Component Style

- Cards: 8px radius, 1px border, subtle shadow only where hierarchy needs it.
- Buttons: 8px radius, clear icon plus label for important commands.
- Inputs: 8px radius, visible focus border using `--border-focus`.
- Tables: dense but readable, sticky headers for large admin screens.
- Mobile operations screens: large tap targets, fixed bottom actions, status chips, and quick filters.
- Guest booking screens: more whitespace, room photos, simple pricing, clear trust signals.

## Icons

Use `lucide-react` for implementation where possible.

Recommended icons:

| Feature | Lucide Icon |
|---|---|
| Dashboard | `LayoutDashboard` |
| Bookings | `CalendarCheck` |
| New booking | `CalendarPlus` |
| Calendar | `CalendarDays` |
| Guests | `Users` |
| Rooms | `BedDouble` |
| Room types | `Layers` |
| Amenities | `Sparkles` |
| Housekeeping | `Brush` |
| Maintenance | `Wrench` |
| Assets | `PackageCheck` |
| Inventory | `Boxes` |
| Purchases | `ShoppingCart` |
| Restaurant | `Utensils` |
| Kitchen | `ChefHat` |
| Payments | `CreditCard` |
| M-Pesa/mobile money | `Smartphone` |
| Reports | `ChartNoAxesCombined` |
| Employees | `UserRoundCog` |
| Roles/permissions | `ShieldCheck` |
| Notifications | `Bell` |
| Settings | `Settings` |
| Light mode | `Sun` |
| Dark mode | `Moon` |
| Search | `Search` |
| Sign out | `LogOut` |

## UI Samples to Build First

Create these first-screen samples before implementing the full app:

1. Guest room catalog with dark and light mode.
2. Room detail and booking form.
3. Admin dashboard.
4. Front desk booking calendar.
5. Operations manager mobile dashboard.
6. Caretaker/housekeeping task screen.
7. Restaurant kitchen display.
8. Login screen with PWA install prompt.

