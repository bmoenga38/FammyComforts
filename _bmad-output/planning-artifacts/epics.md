---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - PRD.md
  - _bmad-output/planning-artifacts/architecture.md
  - DESIGN_SYSTEM.md
  - DEMO_REVIEW_REPORT.md
  - docs/index.md
status: 'complete'
completedAt: '2026-06-04'
revisedAt: '2026-06-04'
revisionNote: 'Post-readiness revision: Payments resequenced before Front Desk; guest portal moved into Payments; 4 oversized stories split; backup + CI/CD stories added.'
---

# SommyComfort - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for SommyComfort, decomposing the requirements from the PRD, the design system (acting as the UX input), and the Architecture decisions into implementable stories.

> **Run mode note:** Produced via the BMAD `create-epics-and-stories` workflow in autonomous ("YOLO") mode. The PRD has no pre-numbered FRs, so they were derived from `PRD.md` §5 (Core Scope) plus cross-cutting auth/notifications. There is no standalone UX-design document, so `DESIGN_SYSTEM.md` was used as the UX input.
>
> **Revision 2026-06-04 (post-readiness):** Acting on `implementation-readiness-report-2026-06-04.md`, the MVP was made build-clean: **Payments (now Epic 5) is sequenced before Front Desk (now Epic 6)** so the money engine exists before the flows that need it; the **guest portal** (invoices/receipts) moved into Payments; four **oversized stories were split**; and **backup/DR** + **CI-CD/Docker** stories were added to Epic 1.

## Requirements Inventory

### Functional Requirements

**Guest PWA**
- FR1: Public property landing and room catalog showing available and booked rooms with status.
- FR2: Room detail view with gallery, amenities, rules, pricing, capacity, floor, room number, size, and location.
- FR3: Date-based availability search (check-in / check-out).
- FR4: No-account guest booking flow.
- FR5: Guest detail capture (full name, email, phone, DOB, nationality, ID type, ID/passport number).
- FR6: Optional guest ID document image upload (front/back).
- FR7: Payment-method choice at booking time (cash, M-Pesa, card) with split-payment capture.
- FR8: Special requests / booking notes and required consent checkboxes.
- FR9: Booking confirmation page with generated reference number.
- FR10: Guest booking lookup by phone/email and reference number.
- FR11: Guest portal to view booking status, invoices, receipts, and requests.

**Admin Portal**
- FR12: Admin dashboard with key metrics (occupancy, revenue, restaurant revenue, outstanding balances, check-ins/outs, damages, room status, housekeeping) and a daily action queue.
- FR13: Property/branch/room/room-type/rate/amenity/policy/tax/notification settings management.
- FR14: Staff management with custom roles and granular permissions (RBAC).
- FR15: Payment-method configuration (cash, card/POS, manual M-Pesa, STK push).
- FR16: Booking-source management (website, direct, walk-in, OTA, agent, phone, WhatsApp).
- FR17: Audit logs for sensitive actions.

**Front Desk**
- FR18: Booking creation and editing.
- FR19: Guest creation and profile management.
- FR20: Calendar / room-availability view.
- FR21: Check-in workflow with ID verification.
- FR22: Check-out workflow with balance check, damage/asset checks, receipt, and housekeeping trigger.
- FR23: Extend-stay, change-room, cancel, no-show, and refund workflows.
- FR24: Partial and split payment recording.

**Operations / Caretaker**
- FR25: Mobile daily-operations dashboard (arrivals, departures, current stays, pending balances, late checkouts).
- FR26: Room-readiness board (available, occupied, dirty, cleaning, maintenance, blocked).
- FR27: Housekeeping assignment and status updates.
- FR28: Maintenance and damage reporting with photos.
- FR29: Per-room asset checklist and checkout verification.
- FR30: Escalations for unpaid balances, failed payments, dirty rooms, missing assets, and low stock.

**Housekeeping**
- FR31: Task queue by priority and assigned room.
- FR32: Start / pause / complete / flag-issue task actions.
- FR33: Cleaning checklist templates by room type.
- FR34: Photo upload for cleaning proof or damage.
- FR35: Offline queue for task updates on poor networks.

**Inventory**
- FR36: Product catalog (unit, category, cost, selling price, stock qty, reorder level, active status).
- FR37: Suppliers and purchase orders.
- FR38: Stock-movement audit trail.
- FR39: Stocktake workflow.
- FR40: Low-stock alerts.
- FR41: Usage tracking from restaurant orders and room consumables.

**Restaurant / Room Service**
- FR42: Menu products linked to inventory.
- FR43: Order creation (room service, dine-in, takeaway, bar).
- FR44: Kitchen display with status lanes (pending, preparing, ready, served, paid, cancelled).
- FR45: Order charges posted to guest room or paid separately.
- FR46: Restaurant revenue reports and top-selling items.

**Reporting**
- FR47: Revenue reports by date, room, room type, source, and payment method.
- FR48: Occupancy and average-length-of-stay reports.
- FR49: Outstanding balances and collections report.
- FR50: Profit & loss with expenses and purchases.
- FR51: Inventory value, purchases, low-stock, movements, and top-selling reports.
- FR52: Guest analytics (returning guests, nationality, top spenders).
- FR53: Tax/VAT report with export.
- FR54: Asset report and damage/missing-item charges.

**Cross-Cutting Platform**
- FR55: User authentication (login, logout, token refresh, password reset).
- FR56: Notifications (booking confirmations, task assignments, payment updates, check-in/out reminders, escalations) via email, SMS, WhatsApp, and web push.

### NonFunctional Requirements

- NFR1: Installable PWA on Android/iOS/desktop/tablet; Lighthouse PWA ≥ 90.
- NFR2: Service worker with offline shell, cache strategy, and fallback screen.
- NFR3: Offline-capable task updates with background sync for queued actions.
- NFR4: Web push notifications.
- NFR5: Mobile-first responsive UI; fast startup on mid-range Android; low-bandwidth tolerant; clear online/offline indicators.
- NFR6: Strong authentication and role-based authorization.
- NFR7: Secure ID-document storage; encryption in transit; secure handling of sensitive identity data with retention rules.
- NFR8: Audit logs for bookings, payments, check-ins/outs, staff changes, and settings.
- NFR9: PDF export (invoices, receipts, reports, tax) and CSV/Excel export.
- NFR10: Real-time / near-real-time updates for housekeeping, kitchen, calendar, and dashboard (≤ 5 s).
- NFR11: Accessibility — keyboard navigation, contrast, and form labels.
- NFR12: Daily backup strategy; search and filters on operational tables.
- NFR13: Speed targets — guest booking < 3 min, reception booking < 2 min, check-in/out < 90 s.
- NFR14: Money correctness — exact integer-minor-unit amounts with reconciliation.

### Additional Requirements

(From `architecture.md`.)
- AR1: Initialize the project from the **Turborepo (pnpm) monorepo** starter with `apps/web`, `apps/api`, and `packages/{shared,db,config}` — this is **Epic 1, Story 1**.
- AR2: Web stack — Next.js 16.2 (App Router) + React 19 + TypeScript + Tailwind v4 + shadcn/ui + lucide-react; PWA via Serwist.
- AR3: API stack — NestJS 11.1 REST `/api/v1` + OpenAPI; Socket.IO gateway; Redis + BullMQ.
- AR4: Data — PostgreSQL 18 + Prisma 7; UUID v7 keys; snake_case DB ↔ camelCase TS via `@@map`. Tables created **only** by the first story that needs them. (Field-level schema: `data-model.md`.)
- AR5: Shared Zod schemas in `packages/shared` are the single web↔api contract; money via shared integer-cents utility; dates ISO-8601 UTC.
- AR6: Auth — JWT access + rotating refresh, argon2id; `PermissionsGuard` + `@RequirePermission(...)` on every non-public endpoint.
- AR7: Integrations — M-Pesa Daraja (STK push + manual reference + callback webhook; see `mpesa-daraja-integration-spec.md`); S3-compatible object storage with signed URLs; email/SMS/WhatsApp/web-push.
- AR8: CI/CD — GitHub Actions (lint + typecheck + Vitest + Playwright); Docker images per app; migrate-then-deploy.
- AR9: Audit-first — every money-affecting or sensitive action writes an `audit_log` row.

### UX Design Requirements

(From `DESIGN_SYSTEM.md` + the `prototype/`.)
- UX-DR1: Implement the dark + light theme as CSS custom-property tokens (palette, status, backgrounds, text) exactly per `DESIGN_SYSTEM.md`.
- UX-DR2: Typography system — Inter (UI), Space Grotesk (headings), Syne (expressive), JetBrains Mono (IDs/numbers).
- UX-DR3: Semantic status-color system and a reusable **StatusChip** component (success/info/warning/danger/premium) with the documented accommodation mapping.
- UX-DR4: `lucide-react` icon set wired to the documented feature→icon mapping.
- UX-DR5: Core reusable component library — Button, Input, Card, Table (dense, sticky headers), MetricTile, TaskCard, Kanban column, CalendarSlot, Toast, SegmentedControl, EmptyState.
- UX-DR6: Mobile operations patterns — large tap targets, fixed bottom actions, status chips, quick filters; phone-framed ops dashboard.
- UX-DR7: Guest-facing polish — generous whitespace, room photos, simple pricing, clear trust signals.
- UX-DR8: Theme toggle with persistence (localStorage) and restore on load.
- UX-DR9: Accessibility — aria labels, visible focus indicators, contrast compliance, labeled form fields.
- UX-DR10: Build the eight first-screen samples (guest catalog, room detail/booking, admin dashboard, front-desk calendar, ops mobile dashboard, housekeeping task, kitchen display, login) before full build-out.
- UX-DR-NOTE: No standalone UX spec exists — **the `prototype/` is the binding visual reference** for screen layout; `DESIGN_SYSTEM.md` is binding for tokens/components.

### FR Coverage Map

- FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR8, FR9, FR10 → **Epic 4** (Guest Booking Experience)
- FR11 → **Epic 5** (Payments — guest portal surfaces invoices/receipts)
- FR12 → **Epic 10** (Reporting, Exports & Notifications)
- FR13 → **Epic 3** (Property, Rooms, Rates & Amenities Setup)
- FR14, FR17, FR55 → **Epic 2** (Identity, Access & Staff Management)
- FR15 → **Epic 5** (Payments, Invoicing & Reconciliation)
- FR16, FR18, FR19, FR20, FR21, FR22, FR23, FR24 → **Epic 6** (Front Desk Operations)
- FR25, FR26, FR27, FR28, FR29, FR30, FR31, FR32, FR33, FR34, FR35 → **Epic 7** (Operations & Housekeeping)
- FR36, FR37, FR38, FR39, FR40, FR41 → **Epic 8** (Inventory & Procurement)
- FR42, FR43, FR44, FR45, FR46 → **Epic 9** (Restaurant & Kitchen)
- FR47, FR48, FR49, FR50, FR51, FR52, FR53, FR54, FR56 → **Epic 10** (Reporting, Exports & Notifications)
- UX-DR1–UX-DR10 → **Epic 1** (Platform Foundation & Design System), applied throughout
- NFR1–NFR5, NFR10, NFR11, NFR12 → addressed in **Epic 1** (PWA shell, realtime base, a11y, backup) and reinforced per-feature
- NFR6 → **Epic 2**; NFR7 → **Epics 2, 4 & 5**; NFR8 → **Epic 2** (used everywhere); NFR9 → **Epics 5 & 10**; NFR13 → Epics 4 & 6; NFR14 → **Epic 5**

## Epic List

### Epic 1: Platform Foundation & Design System
Stand up the monorepo, the installable themed PWA shell, the realtime/data plumbing, the reusable component library, and the deploy/backup baseline so every later epic builds on a consistent, offline-ready, recoverable foundation.
**FRs covered:** (foundation — enables all) · **UX-DRs:** UX-DR1–UX-DR10 · **NFRs:** NFR1–NFR5, NFR10, NFR11, NFR12

### Epic 2: Identity, Access & Staff Management
Staff can securely sign in and admins can manage staff, roles, and granular permissions, with every sensitive action audited.
**FRs covered:** FR14, FR17, FR55 · **NFRs:** NFR6, NFR8

### Epic 3: Property, Rooms, Rates & Amenities Setup
Admins configure the property, rooms, room types, amenities, rate plans, policies, and tax so the rest of the system has real inventory to operate on.
**FRs covered:** FR13

### Epic 4: Guest Booking Experience
Guests browse, search, and book rooms end-to-end — capturing identity and payment intent — and can look up their booking afterward.
**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR8, FR9, FR10 · **NFRs:** NFR7, NFR13

### Epic 5: Payments, Invoicing & Reconciliation
A correct money engine built **before** the desk flows that depend on it: payment-method config, an exact ledger, M-Pesa (STK + manual), invoices/receipts, the guest portal, and reconciliation.
**FRs covered:** FR11, FR15 (+ realizes FR7) · **NFRs:** NFR14, NFR9, NFR7

### Epic 6: Front Desk Operations
Reception manages bookings and guests end-to-end: create/edit, calendar, check-in/out, modifications, booking sources, and payment recording (using the Epic 5 ledger).
**FRs covered:** FR16, FR18, FR19, FR20, FR21, FR22, FR23, FR24 · **NFRs:** NFR13

### Epic 7: Operations & Housekeeping
Operations and caretakers run the daily floor: ops dashboard, room-readiness board, housekeeping tasks with offline updates, maintenance/damage, asset checks, and escalations — live.
**FRs covered:** FR25, FR26, FR27, FR28, FR29, FR30, FR31, FR32, FR33, FR34, FR35 · **NFRs:** NFR3, NFR10

### Epic 8: Inventory & Procurement
Track stock end-to-end: product catalog, suppliers, purchase orders, stock movements, stocktake, low-stock alerts, and usage.
**FRs covered:** FR36, FR37, FR38, FR39, FR40, FR41

### Epic 9: Restaurant & Kitchen
Take and fulfill food/bar orders: inventory-linked menu, orders across channels, a live kitchen display, and charge-to-room.
**FRs covered:** FR42, FR43, FR44, FR45, FR46 · **NFRs:** NFR10

### Epic 10: Reporting, Exports & Notifications
Owners and accountants get trustworthy dashboards and reports with PDF/CSV export, and the platform notifies the right people across channels.
**FRs covered:** FR12, FR47, FR48, FR49, FR50, FR51, FR52, FR53, FR54, FR56 · **NFRs:** NFR9

## Release Plan

Decided 2026-06-04 (Brian); resequenced after the readiness review.

**Release 1 — MVP: Epics 1–6.** A property that can be configured, booked online and at the desk, and paid (including M-Pesa), with secure staff access and audit. Build order is the natural epic order 1→2→3→4→5→6 — Payments (5) precedes Front Desk (6) so the money engine and ledger exist before the desk flows that record against them.

| # | Epic | Release |
|---|---|---|
| 1 | Platform Foundation & Design System | **R1 (MVP)** |
| 2 | Identity, Access & Staff Management | **R1 (MVP)** |
| 3 | Property, Rooms, Rates & Amenities Setup | **R1 (MVP)** |
| 4 | Guest Booking Experience | **R1 (MVP)** |
| 5 | Payments, Invoicing & Reconciliation | **R1 (MVP)** |
| 6 | Front Desk Operations | **R1 (MVP)** |
| 7 | Operations & Housekeeping | R2 |
| 8 | Inventory & Procurement | R2 |
| 9 | Restaurant & Kitchen | R3 |
| 10 | Reporting, Exports & Notifications | R3 |

Deferred epics (7–10) remain fully specified in this backlog and are unchanged. A minimal slice of Epic 10 notifications (booking-confirmation + payment-update messages) and Epic 7's check-out → housekeeping trigger may be pulled forward into R1 if guest/desk flows need them — to be confirmed at sprint planning.

---

## Epic 1: Platform Foundation & Design System

Stand up the monorepo, the installable themed PWA shell, realtime/data plumbing, a reusable component library, and the deploy/backup baseline. After this epic, a user can install and load an offline-capable, themed app shell with the six role workspaces navigable, and developers have shared contracts, components, CI/CD, and backups in place.

### Story 1.1: Initialize the monorepo from the Turborepo starter

As a developer,
I want the project scaffolded from the agreed Turborepo monorepo starter,
So that all later work builds on the architecture's defined structure and shared tooling.

**Acceptance Criteria:**

**Given** an empty repository
**When** the starter command set from `architecture.md` is run
**Then** `apps/web` (Next.js 16 + Tailwind v4 + TS), `apps/api` (NestJS 11 + TS strict), and `packages/{shared,db,config}` exist
**And** `pnpm install` succeeds and `pnpm dev` starts both apps with shared lint/tsconfig presets (AR1)

### Story 1.2: Establish design tokens, typography, and theming

As a user,
I want the app to render in the SommyComfort dark and light themes with the correct fonts and colors,
So that the product looks consistent and on-brand from the first screen.

**Acceptance Criteria:**

**Given** the web app
**When** it loads
**Then** the dark/light CSS custom-property tokens from `DESIGN_SYSTEM.md` are applied and the fonts (Inter, Space Grotesk, Syne, JetBrains Mono) load (UX-DR1, UX-DR2)

**Given** any screen
**When** I toggle the theme
**Then** the theme switches and persists to localStorage and is restored on next load (UX-DR8)

### Story 1.3: Build the core UI primitives

As a developer,
I want the foundational UI primitives implemented once,
So that every feature reuses consistent, accessible base controls.

**Acceptance Criteria:**

**Given** the component library
**When** I import Button (primary/ghost/small/full), Input, Card, Table (dense, sticky header), and StatusChip (success/info/warning/danger/premium)
**Then** each renders per `DESIGN_SYSTEM.md` with 8px radii, semantic status colors, and lucide-react icons (UX-DR3, UX-DR4, UX-DR5)

**Given** any primitive
**When** audited for accessibility
**Then** it has labels/aria where needed, visible focus, and passes contrast checks (UX-DR9, NFR11)

### Story 1.4: Build the composite domain components

As a developer,
I want the higher-level composite components implemented,
So that operational screens reuse consistent domain widgets.

**Acceptance Criteria:**

**Given** the primitives from Story 1.3
**When** I import MetricTile, TaskCard, Kanban column, CalendarSlot, Toast, SegmentedControl, and EmptyState
**Then** each renders per `DESIGN_SYSTEM.md` and the prototype, composing the primitives (UX-DR5, UX-DR6)

### Story 1.5: Installable PWA app shell

As a guest or staff member,
I want to install the app and load its shell,
So that it behaves like a native app.

**Acceptance Criteria:**

**Given** the deployed web app
**When** I visit on a supported device
**Then** a web manifest + icons enable install and a Serwist service worker caches the app shell with an offline fallback screen (NFR1, NFR2)

### Story 1.6: Offline data, background sync, and Lighthouse target

As a staff member on a poor network,
I want offline-tolerant behavior and a fast, installable app,
So that I can keep working with intermittent connectivity.

**Acceptance Criteria:**

**Given** I am offline
**When** I open the installed app
**Then** the shell and last-cached views load and a clear offline indicator is shown (NFR5)

**Given** a queued mutation made offline
**When** connectivity returns
**Then** it replays via background sync in order (NFR3)

**Given** Lighthouse runs against the shell
**When** the PWA category is scored
**Then** it scores ≥ 90 (NFR1)

### Story 1.7: Role-workspace navigation shell

As a user,
I want the six role workspaces navigable within the app shell,
So that I can reach guest, admin, front desk, operations, housekeeping, and kitchen areas.

**Acceptance Criteria:**

**Given** the app shell (sidebar + top bar from the prototype)
**When** I select a workspace
**Then** the corresponding route group renders with its title, matching the prototype's six views (UX-DR6, UX-DR7, UX-DR10)

### Story 1.8: Shared contracts, realtime, and data plumbing

As a developer,
I want shared Zod schemas, the Socket.IO base, and the Prisma client wired,
So that later features have a typed contract, live channel, and DB access ready.

**Acceptance Criteria:**

**Given** `packages/shared`
**When** a schema and the money/date utilities are added
**Then** both web and api import them with no duplication (AR5)

**Given** the api
**When** it starts
**Then** a Socket.IO gateway accepts authenticated connections, a health endpoint returns OK, and Prisma connects to PostgreSQL via `packages/db` using the `data-model.md` schema (AR3, AR4, NFR10)

### Story 1.9: CI/CD pipeline and containerized deploy

As a developer,
I want automated checks and reproducible deploys,
So that changes ship safely.

**Acceptance Criteria:**

**Given** a pull request
**When** CI runs
**Then** GitHub Actions runs lint, typecheck, Vitest, and Playwright, blocking merge on failure (AR8)

**Given** a merge to main
**When** the pipeline runs
**Then** Docker images are built per app and a migrate-then-deploy step applies Prisma migrations before releasing (AR8)

### Story 1.10: Daily backup and disaster-recovery baseline

As an owner,
I want automated daily backups with a tested restore,
So that the property's data is recoverable.

**Acceptance Criteria:**

**Given** the production database and object storage
**When** the daily schedule runs
**Then** an automated backup is taken and retained per policy (NFR12)

**Given** a backup exists
**When** a restore drill is performed in a non-prod environment
**Then** data is recoverable and the procedure is documented

---

## Epic 2: Identity, Access & Staff Management

Staff can securely sign in, and admins can manage staff, custom roles, and granular permissions. Every sensitive action is audited. After this epic the platform has authoritative auth + RBAC + audit that all later epics depend on.

### Story 2.1: Staff authentication with JWT

As a staff member,
I want to log in and stay signed in securely,
So that I can access the tools my role permits.

**Acceptance Criteria:**

**Given** valid credentials
**When** I log in
**Then** I receive a short-lived access token and a rotating refresh token; passwords are verified against an argon2id hash (FR55, NFR6, AR6)

**Given** an expired access token
**When** the client refreshes
**Then** a new access token is issued and the old refresh token is invalidated; logout denylists the refresh token

### Story 2.2: Password reset

As a staff member,
I want to reset a forgotten password,
So that I can regain access without an admin.

**Acceptance Criteria:**

**Given** a registered email
**When** I request a reset
**Then** a time-limited reset token is issued and the event is audited (FR55, FR17)
**And** using it sets a new argon2id-hashed password and invalidates existing sessions

### Story 2.3: Roles and granular permissions (RBAC)

As an admin,
I want to define roles with permissions across the 18 permission areas,
So that staff only access what they should.

**Acceptance Criteria:**

**Given** the 12 base roles and 18 permission areas from the PRD
**When** I create or edit a role
**Then** I can grant/revoke per-area permissions, and the server enforces them via `@RequirePermission(...)` on every protected endpoint (FR14, NFR6, AR6)

**Given** a staff member without a permission
**When** they call a protected endpoint or view a gated UI element
**Then** the server returns 403 and the UI hides/disables the element

### Story 2.4: Staff management

As an admin,
I want to create, edit, deactivate, and assign roles to staff,
So that my team's access reflects reality.

**Acceptance Criteria:**

**Given** the staff admin screen
**When** I create or edit a staff member
**Then** I can set profile fields and assign one or more roles, and changes are audited (FR14, FR17)

**Given** a deactivated staff member
**When** they attempt to log in
**Then** access is denied

### Story 2.5: Audit log of sensitive actions

As an admin/owner,
I want a tamper-evident log of sensitive actions,
So that I can investigate and meet accountability needs.

**Acceptance Criteria:**

**Given** any money-affecting or sensitive action (auth, settings, staff, identity)
**When** it occurs
**Then** an `audit_log` row records actor, action, entity, before/after, IP, and timestamp (FR17, NFR8, AR9)

**Given** the audit view
**When** I filter by actor, entity, or date range
**Then** matching entries are listed and exportable

---

## Epic 3: Property, Rooms, Rates & Amenities Setup

Admins configure the property, branches, rooms, room types, amenities, rate plans, policies, and tax. After this epic the system holds real bookable inventory and pricing that booking and operations depend on.

### Story 3.1: Property and branch settings

As an admin,
I want to configure property and branch details and policies,
So that guest-facing info and operational rules are correct.

**Acceptance Criteria:**

**Given** the settings screen
**When** I save property/branch details, check-in/out times, cancellation notice, and ID requirement
**Then** they persist and surface on guest-facing screens; changes are audited (FR13, FR17)

### Story 3.2: Room types and amenities

As an admin,
I want to manage room types and amenities,
So that rooms can be categorized and described consistently.

**Acceptance Criteria:**

**Given** the room-type admin
**When** I create a room type with capacity, size, and amenities
**Then** it is available to assign to rooms (FR13)

### Story 3.3: Rooms management

As an admin,
I want to create and manage individual rooms,
So that real units exist to book and operate.

**Acceptance Criteria:**

**Given** a room type exists
**When** I add a room with number, floor, location, and type
**Then** the room appears in catalog/calendar with an initial status (FR13)

### Story 3.4: Rate plans and tax

As an admin,
I want to set nightly rates and tax/VAT,
So that bookings price correctly.

**Acceptance Criteria:**

**Given** a room or room type
**When** I set a rate plan in KES and a tax/VAT rule
**Then** the price (stored as integer cents) and tax are applied in availability and booking calculations (FR13, NFR14)

### Story 3.5: Notification settings

As an admin,
I want to configure which notifications are enabled and their channels,
So that the property controls guest/staff messaging.

**Acceptance Criteria:**

**Given** the notification settings
**When** I enable/disable a notification type and channel (email/SMS/WhatsApp/push)
**Then** the preference is stored and respected by the notification engine (FR13, ties to FR56)

---

## Epic 4: Guest Booking Experience

Guests browse, search, and book rooms end-to-end, capture identity and payment intent, get a confirmation, and can look up their booking. Built on Epic 3 inventory; payment **processing** and the guest portal live in Epic 5. Story 4.6 records payment *intent* only, so this epic has no dependency on Epic 5.

### Story 4.1: Public room catalog

As a guest,
I want to see available and booked rooms with status and price,
So that I can choose where to stay.

**Acceptance Criteria:**

**Given** rooms configured in Epic 3
**When** I open the public catalog
**Then** room cards show status, price (KES), capacity, and location with guest-facing polish (FR1, UX-DR7)

### Story 4.2: Room detail view

As a guest,
I want a detailed room page,
So that I can evaluate amenities, rules, and pricing.

**Acceptance Criteria:**

**Given** a room in the catalog
**When** I open its detail page
**Then** I see gallery, amenities, capacity, floor, number, size, location, pricing, and availability (FR2)

### Story 4.3: Date availability search

As a guest,
I want to search by check-in/check-out dates,
So that I only see rooms free for my stay.

**Acceptance Criteria:**

**Given** the catalog
**When** I enter check-in and check-out dates
**Then** only rooms available for the full range are shown, with correct multi-night pricing (FR3, NFR14)

### Story 4.4: No-account booking with guest details

As a guest,
I want to book without creating an account,
So that I can reserve quickly.

**Acceptance Criteria:**

**Given** an available room and dates
**When** I complete the booking form (name, email, phone, DOB, nationality, ID type, ID number) with required consent checked
**Then** a booking is created in a pending state and the guest record is stored (FR4, FR5, FR8, NFR13)

**Given** missing required fields or unchecked consent
**When** I submit
**Then** validation errors are shown and no booking is created

### Story 4.5: Optional ID document upload

As a guest,
I want to optionally upload my ID images,
So that check-in is faster and compliant.

**Acceptance Criteria:**

**Given** the booking form
**When** I upload ID front/back images
**Then** they are stored in access-controlled object storage via signed URLs and linked to the booking, with access audited (FR6, NFR7, AR7)

### Story 4.6: Payment-method selection and split capture (intent)

As a guest,
I want to choose how I'll pay and optionally split,
So that the property knows my payment intent.

**Acceptance Criteria:**

**Given** the booking form
**When** I select cash, M-Pesa, or card and optionally split amounts
**Then** the chosen method(s) and amounts (integer cents) are recorded on the booking as intent for processing in Epic 5 (FR7, NFR14)
**And** no charge is attempted in this epic

### Story 4.7: Booking confirmation with reference

As a guest,
I want a confirmation with a reference number,
So that I have proof and can follow up.

**Acceptance Criteria:**

**Given** a completed booking
**When** the booking is created
**Then** a unique human-readable reference (e.g. BK-XXXX) is generated and shown, and a confirmation notification is queued (FR9, ties FR56)

### Story 4.8: Guest booking lookup

As a guest,
I want to look up my booking by reference and phone/email,
So that I can check its status without an account.

**Acceptance Criteria:**

**Given** a created booking
**When** I enter the reference plus my phone or email
**Then** the booking status, dates, room, and balance are displayed (FR10)

---

## Epic 5: Payments, Invoicing & Reconciliation

The correct money engine, built **before** Front Desk so the desk flows record against a real ledger. Covers payment-method config, the ledger, M-Pesa (STK + manual), invoices/receipts, the guest portal, and reconciliation. Realizes the payment intent captured in Epic 4.

### Story 5.1: Payment-method configuration

As an admin,
I want to configure available payment methods,
So that staff and guests only use enabled methods.

**Acceptance Criteria:**

**Given** the payment settings
**When** I enable cash, card/POS, manual M-Pesa, and/or M-Pesa STK push
**Then** only enabled methods appear in booking/checkout flows; changes are audited (FR15, FR17)

### Story 5.2: Exact money engine and ledger

As an accountant,
I want all amounts handled as exact integer minor units with a derived ledger,
So that balances and reports are trustworthy.

**Acceptance Criteria:**

**Given** any payment or charge
**When** it is recorded
**Then** it is stored as `amount_cents` + currency through the shared money utility, and booking balance is computed from the ledger (never hand-edited) (NFR14, AR5)

**Given** the intent recorded in Story 4.6
**When** the ledger initializes a booking's balance
**Then** the expected total reflects rate + tax and any captured intent

### Story 5.3: M-Pesa STK push initiation

As a guest or receptionist,
I want to start an M-Pesa STK push payment,
So that mobile-money payment can begin seamlessly.

**Acceptance Criteria:**

**Given** M-Pesa STK is enabled
**When** a payment is initiated
**Then** a Daraja STK push request is sent per `mpesa-daraja-integration-spec.md` and a pending payment is recorded with the checkout request id (FR7, AR7)

### Story 5.4: M-Pesa callback processing and confirmation

As an accountant,
I want STK callbacks processed reliably,
So that payments are confirmed or failed accurately.

**Acceptance Criteria:**

**Given** a pending STK payment
**When** Daraja posts the callback to the webhook
**Then** it is verified and processed via a queue, the payment is marked confirmed/failed, the ledger and booking balance update, and the result is idempotent on retries (FR7, NFR14, AR7)

### Story 5.5: Manual M-Pesa, cash, and card recording

As a receptionist,
I want to record manual M-Pesa references and cash/card payments,
So that all real payments are captured.

**Acceptance Criteria:**

**Given** a payment taken offline
**When** I record a manual M-Pesa reference or a cash/card amount
**Then** it posts to the ledger, updates the balance, and is flagged for reconciliation (FR24, NFR14)

### Story 5.6: Invoices and receipts (PDF)

As a guest or accountant,
I want invoices and receipts,
So that there is documentation for each transaction.

**Acceptance Criteria:**

**Given** a booking with ledger entries
**When** an invoice or receipt is generated
**Then** it reflects ledger amounts exactly and is available as a PDF (NFR9)

### Story 5.7: Guest portal for bookings, invoices, and requests

As a guest,
I want a lightweight portal,
So that I can view status, invoices/receipts, and submit requests.

**Acceptance Criteria:**

**Given** a verified booking lookup (Story 4.8)
**When** I open the portal
**Then** I can view booking status, invoices/receipts (Story 5.6), and submit a request that is queued for operations (FR11)
**And** in R1, submitted requests are stored and surfaced to staff even though the full operations workspace ships in R2

### Story 5.8: Reconciliation view

As an accountant,
I want to reconcile recorded payments against bookings,
So that discrepancies are caught.

**Acceptance Criteria:**

**Given** payments and bookings
**When** I open reconciliation
**Then** I can match payments to bookings, see unmatched/flagged items, and resolve them with an audited action (NFR14, FR17)

---

## Epic 6: Front Desk Operations

Reception manages the full booking lifecycle on-site: create/edit, guest profiles, calendar, check-in/out, modifications, booking sources, and payment recording. Builds on Epics 2–5; all money actions use the Epic 5 ledger.

### Story 6.1: Reception booking creation and editing

As a receptionist,
I want to create and edit bookings quickly,
So that I can serve walk-ins and phone bookings.

**Acceptance Criteria:**

**Given** availability
**When** I create a booking selecting guest, room, dates, source, and notes
**Then** it is saved in under the target time and editable later, with changes audited (FR18, FR16, NFR13, FR17)

### Story 6.2: Guest profile management

As a receptionist,
I want to create and manage guest profiles,
So that repeat guests and their history are tracked.

**Acceptance Criteria:**

**Given** the guests screen
**When** I create or edit a guest (identity, contact, ID)
**Then** the profile is stored and linkable to bookings, with booking count and total spent visible (FR19)

### Story 6.3: Availability calendar

As a receptionist,
I want a room-availability calendar,
So that I can see and act on room states across dates.

**Acceptance Criteria:**

**Given** rooms and bookings
**When** I open the calendar
**Then** each room shows per-day status (available/booked/cleaning/occupied/checkout) and I can start a new booking from a free slot (FR20, NFR10)

### Story 6.4: Check-in with ID verification

As a receptionist,
I want to check guests in and verify ID,
So that arrivals are processed correctly.

**Acceptance Criteria:**

**Given** a confirmed booking
**When** I check the guest in and confirm/capture ID
**Then** the booking moves to checked-in, the room becomes occupied, and the action is audited within the target time (FR21, NFR7, NFR13)

### Story 6.5: Check-out with balance and receipt

As a receptionist,
I want to check a guest out and settle the balance,
So that departures are financially clean.

**Acceptance Criteria:**

**Given** a checked-in booking
**When** I check the guest out
**Then** the system verifies the Epic 5 ledger balance, lets me record any final payment, and issues a receipt (FR22, NFR14)

**Given** an outstanding balance
**When** I attempt check-out
**Then** I am warned and must record payment or an explicit audited exception

### Story 6.6: Check-out asset verification and housekeeping trigger

As a receptionist,
I want the checkout to verify assets and trigger cleaning,
So that the room is correctly handed off.

**Acceptance Criteria:**

**Given** a check-out in progress
**When** I complete the asset/damage check
**Then** discrepancies are recorded (and chargeable), the room becomes dirty/cleaning, and a housekeeping task is triggered (FR22; ties FR29, FR27)
**Note (R1):** the full housekeeping workspace is R2; in R1 this creates the task record and flips room status.

### Story 6.7: Booking modifications (extend, change room, cancel, no-show, refund)

As a receptionist,
I want to modify bookings,
So that I can handle real-world changes.

**Acceptance Criteria:**

**Given** an active booking
**When** I extend the stay, change room, cancel, mark no-show, or initiate a refund
**Then** availability, pricing, ledger, and status update consistently and each action is audited (FR23, FR17, NFR14)

### Story 6.8: Partial and split payment recording

As a receptionist,
I want to record partial and split payments,
So that balances stay accurate.

**Acceptance Criteria:**

**Given** a booking with a balance
**When** I record one or more payments across methods
**Then** the balance recalculates exactly via the Epic 5 ledger and the payments persist for reconciliation (FR24, NFR14)

---

## Epic 7: Operations & Housekeeping

Operations and caretakers run the floor live: ops dashboard, room-readiness board, housekeeping tasks (offline-capable), maintenance/damage, asset checks, and escalations. Heavy realtime + offline. **(Release 2.)**

### Story 7.1: Mobile daily-operations dashboard

As an operations manager,
I want a mobile dashboard of today's activity,
So that I can run the day from my phone.

**Acceptance Criteria:**

**Given** the ops workspace
**When** I open the dashboard
**Then** I see arrivals, departures, current stays, pending balances, and late checkouts, updating in near-real-time (FR25, NFR10, UX-DR6)

### Story 7.2: Room-readiness board

As an operations manager,
I want a room-readiness board,
So that I can see and change room states.

**Acceptance Criteria:**

**Given** rooms with statuses
**When** I view the board
**Then** rooms show available/occupied/dirty/cleaning/maintenance/blocked, and authorized changes broadcast live to other users (FR26, NFR10)

### Story 7.3: Housekeeping task queue and assignment

As an operations manager,
I want to assign and prioritize housekeeping tasks,
So that rooms get cleaned in the right order.

**Acceptance Criteria:**

**Given** a dirty room or manual need
**When** I create/assign a task with priority and assignee
**Then** it appears in the assignee's queue ordered by priority, and assignment notifies them (FR27, FR31, ties FR56)

### Story 7.4: Housekeeping task execution with checklists

As a housekeeper,
I want to work tasks with room-type checklists,
So that cleaning is consistent and verifiable.

**Acceptance Criteria:**

**Given** an assigned task
**When** I start/pause/complete/flag it and tick checklist items (templated by room type)
**Then** status and checklist progress are saved, and completion can flip the room to clean (FR32, FR33)

### Story 7.5: Photo proof and offline task updates

As a housekeeper,
I want to attach photos and work offline,
So that I can capture proof/damage even on poor networks.

**Acceptance Criteria:**

**Given** a task
**When** I upload a proof/damage photo
**Then** it is stored via signed URL and linked to the task (FR34, NFR7)

**Given** I am offline
**When** I update tasks
**Then** updates queue locally and sync in order when connectivity returns, with a clear pending indicator, resolving conflicts per the documented policy (FR35, NFR3)

### Story 7.6: Maintenance and damage reporting

As a caretaker,
I want to report maintenance issues and damage with photos,
So that problems are tracked and charged where appropriate.

**Acceptance Criteria:**

**Given** an issue
**When** I report maintenance or damage with photos and notes
**Then** an issue record is created with status, and damage can be linked to a guest charge (FR28)

### Story 7.7: Per-room asset checklist and checkout verification

As a caretaker,
I want per-room asset checklists verified at checkout,
So that missing/damaged assets are caught.

**Acceptance Criteria:**

**Given** a room's asset list
**When** a checkout asset check runs
**Then** each asset is verified present/missing/damaged, and discrepancies create a damage charge and escalation (FR29, ties FR54)

### Story 7.8: Operational escalations

As an operations manager,
I want automatic escalations,
So that critical issues get attention.

**Acceptance Criteria:**

**Given** triggers (unpaid balance, failed payment, dirty room past SLA, missing asset, low stock)
**When** a trigger fires
**Then** an escalation is raised, surfaced on the dashboard, and notified to the right role (FR30, NFR10, ties FR56)

---

## Epic 8: Inventory & Procurement

Track stock end-to-end: product catalog, suppliers, purchase orders, stock movements, stocktake, low-stock alerts, and usage. Standalone; consumed by Epic 9. **(Release 2.)**

### Story 8.1: Product catalog

As an inventory manager,
I want a product catalog,
So that I can track items, costs, and stock.

**Acceptance Criteria:**

**Given** the inventory screen
**When** I create a product with unit, category, cost, selling price (cents), stock qty, reorder level, and active flag
**Then** it is saved and listed with search/filter (FR36, NFR12, NFR14)

### Story 8.2: Suppliers and purchase orders

As an inventory manager,
I want suppliers and purchase orders,
So that restocking is tracked.

**Acceptance Criteria:**

**Given** suppliers exist
**When** I create a purchase order and receive it
**Then** stock increases via a recorded stock movement and the PO status updates (FR37, FR38)

### Story 8.3: Stock movements audit trail

As an inventory manager,
I want every stock change recorded,
So that I can audit inventory.

**Acceptance Criteria:**

**Given** any stock change (purchase, usage, adjustment, stocktake)
**When** it occurs
**Then** a stock-movement record captures product, qty delta, reason, actor, and timestamp (FR38)

### Story 8.4: Stocktake

As an inventory manager,
I want to perform a stocktake,
So that counted stock reconciles to system stock.

**Acceptance Criteria:**

**Given** products in stock
**When** I enter counted quantities and finalize
**Then** variances post as stock movements and on-hand updates (FR39, FR38)

### Story 8.5: Low-stock alerts and usage tracking

As an inventory manager,
I want low-stock alerts and usage tracking,
So that I reorder on time and see consumption.

**Acceptance Criteria:**

**Given** a reorder level
**When** stock falls to/below it
**Then** a low-stock alert/escalation is raised (FR40, ties FR30)

**Given** a restaurant order or room consumable is recorded
**When** it consumes stock
**Then** a usage stock movement decrements the product (FR41)

---

## Epic 9: Restaurant & Kitchen

Take and fulfill food/bar orders with an inventory-linked menu, multi-channel orders, a live kitchen display, and charge-to-room. Builds on Epics 5 (charges) and 8 (inventory). **(Release 3.)**

### Story 9.1: Inventory-linked menu

As a restaurant manager,
I want menu products linked to inventory,
So that selling food decrements stock.

**Acceptance Criteria:**

**Given** inventory products
**When** I create menu items linked to them
**Then** selling a menu item records usage against the linked inventory (FR42, FR41)

### Story 9.2: Order creation across channels

As a waiter,
I want to create orders for room service, dine-in, takeaway, and bar,
So that all order types are handled.

**Acceptance Criteria:**

**Given** the menu
**When** I create an order with items and a channel
**Then** the order is saved with line items and a status of pending (FR43)

### Story 9.3: Kitchen display with status lanes

As a chef,
I want a live kitchen display,
So that I can progress orders through preparation.

**Acceptance Criteria:**

**Given** pending orders
**When** I move an order across lanes (pending → preparing → ready → served → paid/cancelled)
**Then** the change broadcasts live to the display and order views within ≤ 5 s (FR44, NFR10)

### Story 9.4: Charge to room or pay separately

As a waiter,
I want to charge an order to a guest room or take separate payment,
So that billing is correct.

**Acceptance Criteria:**

**Given** a served order
**When** I charge it to a guest booking or take separate payment
**Then** the charge posts to the booking ledger (Epic 5) or records a standalone payment (FR45, NFR14)

### Story 9.5: Restaurant revenue and top-sellers

As a restaurant manager,
I want restaurant revenue and top-selling items,
So that I can manage performance.

**Acceptance Criteria:**

**Given** completed orders
**When** I open restaurant reporting
**Then** I see revenue and top-selling items for a date range (FR46, ties Epic 10)

---

## Epic 10: Reporting, Exports & Notifications

Owners and accountants get trustworthy dashboards and reports with PDF/CSV export, and the platform notifies the right people across channels. Aggregates data from all prior epics. **(Release 3.)**

### Story 10.1: Admin KPI dashboard and action queue

As an admin/owner,
I want a KPI dashboard with a daily action queue,
So that I see the property's health at a glance.

**Acceptance Criteria:**

**Given** operational data
**When** I open the dashboard
**Then** I see occupancy, revenue, restaurant revenue, outstanding balances, check-ins/outs, damages, room status, and housekeeping, plus an action queue, updating near-real-time (FR12, NFR10)

### Story 10.2: Revenue, occupancy, and balances reports

As an accountant,
I want revenue, occupancy, and outstanding-balance reports,
So that I understand financial performance.

**Acceptance Criteria:**

**Given** bookings and payments
**When** I run reports
**Then** revenue (by date/room/type/source/method), occupancy + average length of stay, and outstanding balances/collections compute correctly and trace to source records (FR47, FR48, FR49, NFR12)

### Story 10.3: Profit & loss and inventory reports

As an accountant,
I want P&L and inventory reports,
So that I see profitability and stock value.

**Acceptance Criteria:**

**Given** revenue, expenses, purchases, and stock data
**When** I run the reports
**Then** P&L (with expenses/purchases) and inventory (value, purchases, low-stock, movements, top-selling) compute correctly (FR50, FR51)

### Story 10.4: Guest analytics, tax/VAT, and asset reports

As an admin/accountant,
I want guest analytics, tax/VAT, and asset reports,
So that I cover compliance and guest insight.

**Acceptance Criteria:**

**Given** guest, tax, and asset data
**When** I run the reports
**Then** guest analytics (returning, nationality, top spenders), tax/VAT, and asset + damage/missing-charge reports compute correctly (FR52, FR53, FR54)

### Story 10.5: PDF and CSV/Excel export

As an accountant,
I want to export reports and documents,
So that I can share and file them.

**Acceptance Criteria:**

**Given** any report, invoice, or receipt
**When** I export
**Then** a PDF (documents/reports) and CSV/Excel (tabular reports) are generated, queued for large reports, and downloadable (NFR9, FR53)

### Story 10.6: Multi-channel notifications

As a guest or staff member,
I want timely notifications,
So that I stay informed of relevant events.

**Acceptance Criteria:**

**Given** enabled notification settings
**When** a booking confirmation, task assignment, payment update, check-in/out reminder, or escalation occurs
**Then** the right recipients are notified via the configured channels (email/SMS/WhatsApp/web push) through the queue (FR56, NFR4)

**Given** a delivery failure
**When** a channel errors
**Then** the failure is logged and retried per policy
