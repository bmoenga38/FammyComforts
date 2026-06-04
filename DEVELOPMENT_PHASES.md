# Development Phases: Accommodation Operations PWA

## Phase 0: Discovery and Product Alignment

Goals:

- Confirm client business model, property types, staff structure, payment methods, and reporting needs.
- Review the demo application and decide which features are required for MVP, v1, and later releases.
- Define roles for guest, admin, operations manager, caretaker, receptionist, housekeeping, restaurant, and accountant.

Deliverables:

- Approved PRD.
- User journey maps.
- Role and permission matrix.
- Data model draft.
- MVP scope and release roadmap.

Exit criteria:

- Client signs off on MVP features, user roles, and business rules.

## Phase 1: UX, UI, and System Architecture

Goals:

- Design a modern mobile-first PWA experience.
- Separate guest-facing, front desk, operations, and admin workflows.
- Establish technical architecture.

Deliverables:

- Wireframes for guest booking, admin dashboard, front desk, operations manager, housekeeping, and restaurant/kitchen.
- Visual design system with colors, typography, icons, layout rules, forms, tables, and mobile patterns.
- Database schema.
- API contract.
- PWA architecture plan.
- Security and permissions design.

Exit criteria:

- Design and architecture are approved before engineering starts.

## Phase 2: Project Foundation

Goals:

- Set up the codebase, infrastructure, authentication, and base UI.

Deliverables:

- Frontend app with routing, layouts, auth screens, and PWA manifest.
- Backend app with authentication, users, roles, permissions, and audit logs.
- Database migrations and seed data.
- CI checks for linting, type checks, and tests.
- Base dashboard shell.

Exit criteria:

- Staff can log in, permissions work, and protected routes are enforced.

## Phase 3: Guest Booking MVP

Goals:

- Launch the guest-facing booking experience.

Deliverables:

- Public room catalog.
- Room detail pages with gallery, amenities, rate, and availability.
- Date search and booking form.
- Guest profile and identity fields.
- Optional document upload.
- Booking confirmation page and reference number.
- Email/SMS notification hooks.
- Admin visibility of web bookings.

Exit criteria:

- A guest can book a room from mobile or desktop, and staff can see the booking in admin.

## Phase 4: Front Desk and Booking Operations

Goals:

- Enable reception and admin teams to manage bookings day to day.

Deliverables:

- Bookings list, filters, status management, view, edit, cancel, and no-show.
- Manual booking creation.
- Guest management.
- Room calendar and availability board.
- Check-in and check-out workflows.
- Split and partial payments.
- Receipts and invoices.
- Room change and stay extension.

Exit criteria:

- Reception can handle direct, walk-in, and website bookings from creation through checkout.

## Phase 5: Operations Manager, Caretaker, and Housekeeping

Goals:

- Build the mobile workflow for daily property operations.

Deliverables:

- Operations dashboard for arrivals, departures, occupied rooms, dirty rooms, maintenance, unpaid balances, and urgent tasks.
- Housekeeping task queue.
- Task assignment and status updates.
- Room readiness board.
- Maintenance/damage reporting with photos.
- Asset checklist templates.
- Checkout asset verification.
- Offline queue for task updates.

Exit criteria:

- Caretakers and housekeeping staff can update room status from mobile, and managers can track readiness in real time.

## Phase 6: Payments and Notifications

Goals:

- Make payments and guest/staff communication production-ready.

Deliverables:

- Cash, card/POS, manual M-Pesa, and split-payment recording.
- M-Pesa STK push integration if approved.
- Payment callback handling and reconciliation.
- Notification logs.
- Booking confirmation, payment receipt, check-in reminder, checkout reminder, staff assignment, and escalation notifications.
- PWA push notification setup.

Exit criteria:

- Payment records are auditable, balances are accurate, and notifications are traceable.

## Phase 7: Inventory, Purchases, and Restaurant

Goals:

- Support stock management and restaurant/room-service operations.

Deliverables:

- Product and category management.
- Supplier management.
- Purchase orders and received stock.
- Stock movement audit.
- Stocktake workflow.
- Low stock alerts.
- Restaurant/menu products.
- Order creation for room service, dine-in, takeaway, and bar.
- Kitchen display board.
- Posting room-service charges to guest bookings.

Exit criteria:

- Staff can sell menu items, update stock, track purchases, and reconcile restaurant revenue.

## Phase 8: Reports and Exports

Goals:

- Give owners and managers reliable financial and operational visibility.

Deliverables:

- Revenue report.
- Occupancy report.
- Profit and loss report.
- Inventory report.
- Restaurant report.
- Guest analytics.
- Tax/VAT report.
- Asset and damage report.
- PDF, CSV, and Excel exports.

Exit criteria:

- Reports match source transactions and are exportable for management/accounting use.

## Phase 9: PWA Hardening, QA, and Launch

Goals:

- Prepare the product for production use.

Deliverables:

- Offline behavior tests.
- Mobile browser QA on Android and iOS.
- Lighthouse PWA audit.
- Security review.
- Performance optimization.
- Backup and restore process.
- User acceptance testing.
- Staff training guide.
- Launch checklist.

Exit criteria:

- Client approves UAT, production environment is ready, and launch checklist is complete.

## Phase 10: Post-Launch Improvements

Goals:

- Improve based on real usage and business priorities.

Potential enhancements:

- Multi-property support.
- OTA/channel manager integrations.
- WhatsApp booking assistant.
- Advanced pricing and seasonal rates.
- Owner mobile dashboard.
- Guest portal.
- Loyalty and promo codes.
- Accounting integrations.
- Advanced analytics.

