# Demo Review Report: Kemet Accommodation System

Review date: 2026-05-29

Demo URLs:

- Public booking site: `https://room.kemettech.co.ke/book`
- Staff login: `https://room.kemettech.co.ke/login`

## Executive Summary

The demo is a compact accommodation operations platform with a public booking website and a broad staff portal. It already covers more than simple room booking: bookings, guests, rooms, room types, amenities, housekeeping, inventory, restaurant orders, staff roles, notifications, settings, and reports are present.

For a client-ready modern version, the main opportunity is to rebuild the experience as a polished PWA with clearer role-based interfaces, mobile-first operations workflows, better realtime updates, offline-tolerant caretaker/housekeeping actions, stronger financial accuracy, and production-grade payment/notification integrations.

## Public Booking Findings

Observed:

- Room catalog with 5 rooms.
- Availability labels: booked and available.
- Room cards include type, room name, floor/location, capacity, size, room number, amenities, and price.
- Room detail page includes photos, room metadata, amenities, about section, price, and booking CTA.
- Booking form captures stay dates, personal details, ID details, optional ID photos, payment method, split payments, and special requests.
- Public content promises instant confirmation, secure booking, no hidden fees, and 24/7 support.

Recommended improvements:

- Cleaner mobile-first room browsing.
- Stronger availability search with clear unavailable reasons.
- Better image handling, galleries, and fallback images.
- Guest booking lookup page.
- M-Pesa STK push and payment status feedback.
- Explicit privacy consent for ID uploads.
- Automated confirmation receipt via SMS, email, WhatsApp, and PWA push where applicable.

## Admin and Staff Portal Findings

Observed modules:

- Dashboard: occupancy, room revenue, restaurant revenue, outstanding balances, check-ins/check-outs, damages, payment breakdown, room status, housekeeping, restaurant, inventory, guests, revenue trend, recent bookings.
- Bookings: filters, booking references, guest, room, dates, total, balance, status, payment method, view/edit actions.
- New booking: guest, room, check-in/out, payments, booking status, notes.
- Calendar: room availability and status overview.
- Guests: guest records, IDs, phones, emails, bookings, total spend, active/blacklisted states.
- Rooms: room list with statuses and actions.
- Room types: capacity, base price, rate type, active status.
- Amenities: amenity list and active status.
- Asset checks: history created during checkout.
- Housekeeping: tasks, status, priority, assigned staff, notes.
- Inventory: products, purchases, stock movements, stocktake, categories.
- Reports: overview, revenue, occupancy, profit and loss, inventory, restaurant, guests, tax, assets.
- Staff: employees, custom roles, granular permission defaults.
- Notifications: SMS/email logs with channel, trigger, recipient, booking, message, and status.
- Settings: business info, currency, timezone, tax, payment methods, M-Pesa modes, receipt, website, modules, notifications.
- Restaurant: orders list and kitchen display link.

## Important Defects or Risks Seen in Demo

- `https://room.kemettech.co.ke/restaurant/kitchen` returned a `500 - Server Error`.
- Some icon/text glyphs render incorrectly in several areas.
- Some operational wording is inconsistent, for example rooms marked booked while calendar text also says available now.
- Fractional night values appear in bookings, which may confuse staff and guests.
- Demo calculations and reports need stricter financial validation before production use.
- Sensitive ID upload workflow needs clear privacy handling, retention rules, and access control.

## Recommended Product Direction

Build a role-based PWA with these separate experiences:

- Guest app: browse, book, pay, receive confirmations, and view booking status.
- Admin app: configuration, staff, roles, financial reports, settings, audit logs.
- Front desk app: bookings, calendar, guests, check-in, check-out, payments.
- Operations manager app: daily room readiness, arrivals/departures, housekeeping, assets, damages, maintenance, escalations.
- Caretaker/housekeeping app: assigned tasks, checklist completion, photos, issue reporting, offline sync.
- Restaurant/kitchen app: room-service orders, kitchen status board, stock-linked products.

## MVP Recommendation

Build MVP in this order:

1. Authentication, roles, permissions, property setup.
2. Room, room type, amenity, rate, and availability management.
3. Public booking PWA.
4. Booking admin, guests, calendar, check-in/check-out, payments.
5. Operations manager and housekeeping mobile workflows.
6. Receipts, invoices, notifications, and basic reports.

Inventory, restaurant, asset reports, advanced tax exports, and multi-property features should follow after the booking and operations core is stable.

