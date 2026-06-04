# Product Requirements Document: Modern Accommodation Operations PWA

## 1. Purpose

Build a modern, mobile-first accommodation management platform inspired by the Kemet Accommodation System demo at `https://room.kemettech.co.ke/book`, but redesigned as a production-ready Progressive Web App (PWA) for guests, administrators, operations managers, reception staff, caretakers, housekeeping, restaurant/kitchen staff, and business owners.

The product should support guest self-booking, front desk operations, room and asset management, housekeeping workflows, inventory, restaurant/room-service orders, payments, staff permissions, notifications, and business reporting.

## 2. Demo Review Summary

### Public booking website

Observed guest features:

- Public room catalog with available and booked room cards.
- Room detail pages with images, room type, capacity, floor, room number, size, location, amenities, price, and availability.
- Date-based check-in and check-out search.
- No-account booking flow.
- Guest details capture: full name, email, phone, date of birth, nationality, ID type, ID/passport number.
- Optional ID front/back image upload.
- Split payment capture with cash, M-Pesa, and card options.
- Booking notes and special requests.
- Footer policies including check-in/check-out time, cancellation notice, and ID requirement.

### Staff/admin portal

Observed admin modules:

- Dashboard with occupancy, revenue, restaurant revenue, outstanding balances, check-ins/check-outs, damages, room status, housekeeping, restaurant, inventory, guest analytics, revenue trends, and recent bookings.
- Bookings list with filters, totals, payment status, booking reference, guest, room, stay period, balance, status, view and edit actions.
- New booking form for selecting guest, room, stay dates, one or more payments, status, and notes.
- Calendar/availability view showing each room, room status, rate, capacity, and actions.
- Guests list with ID number, phone, email, booking count, total spent, and status.
- Rooms, room types, and amenities management.
- Asset checks for room asset verification during checkout.
- Housekeeping task management with room, task type, status, priority, assigned staff, and notes.
- Inventory product catalog, purchase tracking, stock movement audit, stocktake, and product categories.
- Reports for revenue, occupancy, profit and loss, inventory, restaurant, guests, tax/VAT, and assets.
- Employees, custom roles, role permissions, notifications, and system settings.
- Restaurant orders and kitchen display route.

### Notable demo issues and improvement opportunities

- The kitchen display route returned a `500 - Server Error` during review.
- Some text/icon rendering appears broken in places, likely due to icon font or encoding issues.
- Some data calculations look rough for production use, for example fractional night display and inconsistent room availability language.
- The current UI is functional but should be modernized for mobile use, offline-tolerant operations, real-time status updates, and clearer role-based workflows.
- The app should separate guest-facing, admin, and operations/caretaker experiences more clearly.

## 3. Product Goals

- Let guests browse, book, pay, and receive confirmation from any device.
- Let staff manage bookings, check-ins, check-outs, payments, housekeeping, inventory, assets, and restaurant orders from a mobile-first PWA.
- Give operations managers a live view of room readiness, guest arrivals/departures, cleaning tasks, damages, inventory needs, and staff activity.
- Give owners/admins reliable financial and operational reports.
- Support role-based access so each staff member only sees the tools they need.
- Work well on low-bandwidth mobile networks and remain usable for selected operations when temporarily offline.

## 4. Target Users

- Guest/client: searches rooms, books, uploads ID, pays, receives confirmation, requests support.
- Admin/owner: manages the property setup, staff, reports, pricing, payments, tax, and settings.
- Operations manager: monitors daily operations, arrivals, departures, housekeeping, maintenance, inventory, assets, and escalations.
- Reception/front desk: creates bookings, checks guests in/out, records payments, manages guest profiles.
- Caretaker/assistant: updates room readiness, reports damages, confirms asset checks, supports guest requests.
- Housekeeping staff: receives tasks, updates cleaning progress, uploads proof/photos where needed.
- Restaurant/kitchen staff: handles room-service, dine-in, bar, and kitchen order workflows.
- Accountant/finance staff: reviews revenue, expenses, balances, payment methods, VAT/tax, and exports.

## 5. Core Scope

### Guest PWA

- Public property landing and room catalog.
- Room detail page with gallery, amenities, rules, pricing, availability, and booking CTA.
- Date availability search.
- Booking form with guest profile, identity details, optional document upload, payment choice, special requests, and consent checkboxes.
- Booking confirmation page with reference number.
- Guest booking lookup by phone/email and reference.
- Optional guest portal for viewing booking status, invoices, receipts, and requests.
- Installable PWA with app icon, splash screen, offline fallback, and push notification support.

### Admin Portal

- Admin dashboard with key metrics and daily action queue.
- Property, branch, room, room type, rate, amenity, policy, tax, and notification settings.
- Staff management, custom roles, and granular permissions.
- Payment method configuration including cash, card/POS, manual M-Pesa, and future STK push integration.
- Booking source management: website, direct, walk-in, OTA, agent, phone, WhatsApp.
- Audit logs for sensitive actions.

### Front Desk

- Booking creation and editing.
- Guest creation and profile management.
- Calendar and room availability view.
- Check-in workflow with ID verification.
- Check-out workflow with balance check, damage/asset checks, receipt, and housekeeping trigger.
- Extend stay, change room, cancel booking, no-show, and refund workflow.
- Partial and split payment recording.

### Operations Manager / Caretaker

- Mobile daily operations dashboard.
- Arrivals, departures, current stays, pending balances, and late checkouts.
- Room readiness board: available, occupied, dirty, cleaning, maintenance, blocked.
- Housekeeping assignment and status updates.
- Maintenance and damage reporting with photos.
- Asset checklist per room and checkout verification.
- Escalations for unpaid balances, failed payments, dirty rooms, missing assets, and low stock.

### Housekeeping

- Task queue by priority and assigned room.
- Start, pause, complete, and flag issue actions.
- Cleaning checklist templates by room type.
- Photo upload for proof or damage.
- Offline queue for task updates when network is poor.

### Inventory

- Product catalog with unit, category, cost, selling price, stock quantity, reorder level, and active status.
- Suppliers and purchase orders.
- Stock movements audit trail.
- Stocktake workflow.
- Low stock alerts.
- Usage tracking from restaurant orders and room consumables.

### Restaurant / Room Service

- Menu products linked to inventory.
- Order creation for room service, dine-in, takeaway, and bar.
- Kitchen display with status lanes: pending, preparing, ready, served, paid, cancelled.
- Order charges posted to guest room or paid separately.
- Restaurant revenue reports and top-selling items.

### Reporting

- Revenue by date, room, room type, source, and payment method.
- Occupancy and average length of stay.
- Outstanding balances and collections.
- Profit and loss with expenses and purchases.
- Inventory value, purchases, low-stock, stock movements, and top-selling items.
- Restaurant sales and order performance.
- Guest analytics, returning guests, nationality, top spenders.
- Tax/VAT report with export.
- Asset report and damage/missing-item charges.

## 6. PWA Requirements

- Installable on Android, iOS, desktop, and tablets.
- Service worker with offline shell, cache strategy, and fallback screen.
- Offline-capable task updates for housekeeping, maintenance, asset checks, and notes.
- Background sync for queued actions where supported.
- Push notifications for booking confirmations, task assignments, payment updates, check-in reminders, checkout reminders, and escalations.
- Responsive layouts optimized for phones used by caretakers and operations managers.
- Fast startup on mid-range Android phones.
- Clear offline/online indicators.

## 7. Roles and Permissions

Minimum roles:

- Super Admin
- Property Admin
- Operations Manager
- Receptionist
- Housekeeping
- Caretaker / Assistant
- Maintenance
- Restaurant Manager
- Waiter
- Chef / Kitchen
- Accountant
- Security

Permission areas:

- Dashboard
- Bookings
- Guests
- Rooms
- Calendar
- Housekeeping
- Maintenance
- Assets
- Inventory
- Purchases
- Restaurant
- Payments
- Reports
- Employees
- Roles
- Settings
- Notifications
- Audit logs

## 8. Key Data Entities

- Property
- Branch or location
- User/staff member
- Role and permission
- Guest
- Guest document
- Room
- Room type
- Amenity
- Rate plan
- Booking
- Booking payment
- Invoice and receipt
- Housekeeping task
- Maintenance issue
- Room asset
- Asset check
- Damage charge
- Product
- Product category
- Supplier
- Purchase order
- Stock movement
- Stocktake
- Restaurant order
- Restaurant order item
- Notification log
- Audit log

## 9. Non-Functional Requirements

- Mobile-first responsive UI.
- Strong authentication and role-based authorization.
- Secure upload storage for guest ID documents.
- Encryption in transit and secure handling of sensitive identity data.
- Audit logs for bookings, payments, check-ins, check-outs, staff changes, and settings.
- PDF export for invoices, receipts, reports, and tax summaries.
- CSV/Excel export for accounting and operations.
- Daily backup strategy.
- Search and filters on operational tables.
- Real-time or near-real-time updates for housekeeping, kitchen, calendar, and dashboard.
- Accessibility support for keyboard navigation, contrast, and form labels.

## 10. Suggested Technology Direction

- Frontend: Next.js or React with a PWA setup, TypeScript, Tailwind CSS, and a component library.
- Backend: Laravel, NestJS, or Django REST API, depending on team preference.
- Database: PostgreSQL or MySQL.
- Realtime: WebSockets, Laravel Reverb, Pusher, or Socket.IO.
- Queue jobs: Redis-backed queues for notifications, reports, sync jobs, and payment callbacks.
- Storage: S3-compatible object storage for room images, guest IDs, receipts, and damage photos.
- Payments: M-Pesa Daraja STK push, manual M-Pesa reference capture, cash, card/POS, and later PayHero if required.
- Notifications: Email, SMS, WhatsApp integration, and PWA push.

## 11. Success Metrics

- Guest can complete booking in under 3 minutes.
- Reception can create a booking in under 2 minutes.
- Check-in/check-out workflows take under 90 seconds when documents and payments are complete.
- Housekeeping task update works on mobile and syncs after offline use.
- Dashboard reflects operational changes within 5 seconds for realtime modules.
- Admin can export accurate revenue, occupancy, tax, and inventory reports.
- PWA scores at least 90 for installability and best practices in Lighthouse.

## 12. Out of Scope for MVP

- Multi-property enterprise hierarchy beyond one property with optional branches.
- OTA/channel manager integrations.
- Loyalty program.
- Advanced yield management and dynamic pricing.
- Full accounting system replacement.
- Biometric ID verification.
- Native mobile apps outside the PWA.

