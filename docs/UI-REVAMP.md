# UI Revamp — prototype adoption status, mapping & backend gap list

Source of truth: `ui-samples/fammycomfort_pwa/` (read in full). Design system,
shell, guest flow, and reception views are adopted; logic/architecture unchanged
— every screen calls the pre-existing Convex queries/mutations.

## Mapping: prototype view → app route → backend

| Prototype (app.js) | App route / component | Backend |
|---|---|---|
| Design tokens (index.html + styles.css) | `globals.css` (tokens + component layer) | — |
| Shell: sidebar/topbar/bottom-nav/drawer | `components/shell/*` | — |
| V.search + roomCard (customer Book) | `/book/[orgSlug]` | `catalog.rooms`, `paymentMethods.enabledMethods` |
| openBooking 3-step modal | `/book/[orgSlug]/[roomId]` (stepper page) | `catalog.roomDetail`, `guestBookings.create/generateUploadUrl` |
| Trips/receipt/portal + invoice | `/book/[orgSlug]/lookup`, `/book/[orgSlug]/invoice/[id]` | `guestBookings.portal`, `guestRequests.submit`, `mpesa.initiateStk`, `invoices.*` |
| V.desk (KPIs, workflow, quick actions, arrivals/in-house) | `/front-desk` Desk tab | `deskBookings.board` + lifecycle mutations |
| V.calendar (room×date grid, tap-free-cell-to-book) | `/front-desk` Calendar tab | `calendar.grid` → prefills New booking |
| V.occupancy (room board by floor + status rpanel) | `/front-desk` Rooms tab (right-docked panel) | `rooms.list`, `rooms.setStatus` |
| V.lookup (guest stat cards) | `/front-desk` Guests tab | `guests.list/create` |
| quickBooking (front desk) | `/front-desk` New booking tab | `deskBookings.create` |
| Invoice (KRA 16% VAT, print) | invoice doc view + `print-doc` rules | `invoices.generate` (ledger snapshot) |
| Admin overview/users/roles/config | `/admin`, `/admin/access`, `/admin/setup`, `/admin/payments` (token-reskinned; prototype layouts pending Phase 5) | existing RBAC/staff/audit/setup/payments fns |

## Remaining (Phase 5)
- Operations view (V.ops/analytics/staff/forecast): KPI + chart layouts — needs
  analytics aggregates (see gaps); basic KPIs derivable client-side.
- Housekeeping (V.tasks/prep/maintenance/incidents): task board UI — backend has
  `housekeepingTasks` rows but **no list/update functions yet** (R2 scope).
- Kitchen (R3), Admin overview module-cards restyle, global search overlay,
  notifications panel, role-switcher sheet, AI assistant panel.

## Backend gap list (prototype UI the backend doesn't support yet)
1. **Room photos / gallery** — no image field or storage for rooms (placeholders
   render gradients). Needs `rooms.imageStorageId(s)` + upload + signed serving.
2. **Ratings & reviews** — no reviews tables (`rating`, `reviews`, review list).
3. **QR check-in pass** — no QR generation; confirmation/portal show the BK-
   reference instead.
4. **Loyalty** — points, tiers (Bronze…Platinum), rewards catalog, redemption.
5. **Phone-OTP login + in-login registration** — auth is ByteAuth SSO (by
   architecture decision). Prototype login visuals can wrap `/signin` later;
   guest identity stays reference+phone (no guest accounts).
6. **AI assistant** — answers need aggregate queries (occupancy, revenue, etc.).
7. **Analytics aggregates** — occupancy %, revenue today/7d, peak hours, room
   mix, retention, staff performance (Epic 10 reporting scope).
8. **SMS/push/email template manager + notifications inbox** — templates CRUD,
   send log (Epic 5/10 own-SenderID engine consumes `outboundNotifications`).
9. **Housekeeping task list/update functions** — table exists (created on
   checkout); list/assign/complete are Epic 7 (R2).
10. **Auto-create cleaning task when a room is marked "cleaning" from the
    board** — prototype behavior; `rooms.setStatus` doesn't create tasks (only
    checkout does).
11. **Live activity feed** — closest source is `audit.list` (gated
    `Audit logs:read`); a desk-visible feed would need a friendlier event store.
12. **VIP flag on rooms/guests**, room "name" labels (e.g. "Savannah Suite") —
    schema has type+number only.
