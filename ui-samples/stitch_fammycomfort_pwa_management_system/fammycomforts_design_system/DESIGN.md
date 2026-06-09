---
name: Fammy Comforts Design System
colors:
  surface: '#12131a'
  surface-dim: '#12131a'
  surface-bright: '#383941'
  surface-container-lowest: '#0d0e15'
  surface-container-low: '#1a1b22'
  surface-container: '#1e1f27'
  surface-container-high: '#292931'
  surface-container-highest: '#34343c'
  on-surface: '#e3e1ec'
  on-surface-variant: '#bbcbb8'
  inverse-surface: '#e3e1ec'
  inverse-on-surface: '#2f3038'
  outline: '#859583'
  outline-variant: '#3c4a3c'
  surface-tint: '#31e368'
  primary: '#e8ffe4'
  on-primary: '#003912'
  primary-container: '#50fa7b'
  on-primary-container: '#00702c'
  inverse-primary: '#006e2b'
  secondary: '#d7baff'
  on-secondary: '#411478'
  secondary-container: '#593090'
  on-secondary-container: '#caa4ff'
  tertiary: '#edfbff'
  on-tertiary: '#00363e'
  tertiary-container: '#8ceafe'
  on-tertiary-container: '#006a79'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#69ff88'
  primary-fixed-dim: '#31e368'
  on-primary-fixed: '#002108'
  on-primary-fixed-variant: '#00531e'
  secondary-fixed: '#eddcff'
  secondary-fixed-dim: '#d7baff'
  on-secondary-fixed: '#290055'
  on-secondary-fixed-variant: '#593090'
  tertiary-fixed: '#a3eeff'
  tertiary-fixed-dim: '#75d4e8'
  on-tertiary-fixed: '#001f25'
  on-tertiary-fixed-variant: '#004e5a'
  background: '#12131a'
  on-background: '#e3e1ec'
  surface-variant: '#34343c'
typography:
  hero-display:
    fontFamily: Syne
    fontSize: 48px
    fontWeight: '800'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  headline-sm:
    fontFamily: Space Grotesk
    fontSize: 18px
    fontWeight: '600'
    lineHeight: '1.4'
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-caps:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.05em
  data-mono:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.4'
  headline-lg-mobile:
    fontFamily: Space Grotesk
    fontSize: 28px
    fontWeight: '700'
    lineHeight: '1.2'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 0.5rem
  sm: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  sidebar-width: 280px
  bottom-nav-height: 64px
---

## Brand & Style
The design system is engineered for a premium, operational hospitality PWA catering to the Kenyan market. It balances high-end hospitality aesthetics with the rigorous functional requirements of property management. The brand personality is **modern, calm, and operational**—evoking trust through precision while maintaining a welcoming atmosphere for guests.

The visual style is a hybrid of **Modern Corporate** and **Glassmorphism**, utilizing deep backgrounds in the default dark mode to reduce eye strain for staff during night shifts, and clean, high-contrast surfaces in light mode for outdoor/daytime use. The aesthetic relies on technical typography and vibrant "status-driven" accents to ensure information density remains readable and actionable.

## Colors
This design system utilizes a semantic color palette where hues are tied directly to operational states. 

- **Primary (Green):** Represents health, availability, and successful payments. Used for primary actions and "Success" states.
- **Accent (Purple):** Reserved for VIP guests, management-level overrides, and premium features.
- **Cyan:** Used for informational callouts and confirmed booking statuses.
- **Orange:** Indicates transitional states like "Cleaning in Progress," "Pending," or "Checkout Due."
- **Red:** Used exclusively for overdue tasks, urgent maintenance, or cancelled bookings.

**Default Mode:** Dark. The dark palette uses `#0c0d14` (Deep) for the base canvas to create a sophisticated, high-end feel.
**Light Mode:** Transitions to an airy `#eef2f7` base with high-contrast slate text for maximum legibility in bright environments.

## Typography
The typographic scale is highly functional, using four distinct typefaces to categorize information:
1.  **Syne:** Used for large Hero sections and branding moments. It adds a touch of avant-garde luxury.
2.  **Space Grotesk:** The workhorse for UI headings. Its geometric nature feels modern and technical.
3.  **Inter:** Used for all body copy, descriptions, and form labels to ensure maximum accessibility and readability.
4.  **JetBrains Mono:** Dedicated to financial data (KES values) and Room IDs/Booking codes. This ensures tabular figures align perfectly and look distinct from prose.

**Formatting Note:** All currency must be formatted as `KES 0,000` using the Monospace font style to emphasize the operational nature of the PWA.

## Layout & Spacing
The design system follows a **Mobile-First** philosophy. 

- **Mobile PWA:** Navigation is anchored to a fixed bottom bar containing five core destinations: Book, Admin, Desk, Clean, and Kitchen. This ensures high-frequency actions are within thumb-reach.
- **Desktop:** The layout reflows to include a 280px fixed left sidebar for navigation, with the main content area using a fluid grid (max-width 1440px).
- **Grid:** A 12-column grid is used for desktop, while mobile relies on a single-column stack with `1rem` (16px) horizontal safe-area margins.
- **Rhythm:** An 8px linear scaling system is used for padding and margins to maintain consistent vertical rhythm.

## Elevation & Depth
Depth is created through **Tonal Layering** and subtle **Glows** rather than heavy drop shadows.

- **Level 0 (Base):** Deepest layer (`#0c0d14`), used for the background.
- **Level 1 (Card/Surface):** Surface layer (`#2d2f3d`), used for content containers. These feature a very subtle 1px border (`#44475a`) to define edges.
- **Level 2 (Interactive/Floating):** Used for modals and dropdowns. These employ a backdrop-blur (12px) to maintain context of the layer below.
- **Interactive States:** Primary buttons and active status cards utilize a "Soft Glow"—a colored shadow matching the element's color (e.g., Green shadow for available rooms) with high blur (15-20px) and low opacity (20%).

## Shapes
The shape language is "Modern Rounded," striking a balance between friendly and professional. 

- **Cards:** Use a generous 14px radius to soften the high-density data layouts.
- **Interactive Elements:** Buttons and Input fields use a tighter 10px radius, providing a distinct visual difference from structural containers.
- **Badges:** Status indicators (Confirmed, Pending, etc.) are always fully pill-shaped (rounded-full) to make them instantly recognizable as non-interactive status markers.
- **Icons:** Lucide icons are used throughout, set to a 2px stroke width for a clean, consistent weight that matches the typography.

## Components

### Buttons
- **Primary:** Solid `#50fa7b` (Dark Mode) or `#16a34a` (Light Mode) with 10px radius. Includes a soft matching glow.
- **Secondary/Ghost:** Bordered with 1px stroke, no fill.
- **Navigation:** Bottom bar icons should be 24px with a 12px label beneath them in `label-caps` style.

### Input Fields
- **Default:** Background uses `#353849` with a subtle `#44475a` border.
- **Focus State:** The border transitions to Primary Green with a 2px outer ring glow.
- **Prefixes:** Use the icon set for common inputs (e.g., User icon for Guest name, Key icon for Room ID).

### Status Badges
- Pill-shaped with a light-tint background and high-contrast text.
- Example: "Available" badge is light green background with dark green text.

### Cards
- Standard Room Card: Features the Room ID in `data-mono` (Top Left), Status Badge (Top Right), and Price/Night in `data-mono` (Bottom Right).
- 14px corner radius with `1.5rem` internal padding.

### Bottom Navigation (PWA)
- Fixed at the bottom. 
- Height: 64px. 
- Background: `#21222c` (Dark Mode) with a 1px top border.
- Active state indicated by a Primary Green tint on the icon and label.