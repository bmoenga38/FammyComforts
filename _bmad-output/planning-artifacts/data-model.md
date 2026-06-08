# Data Model — SommyComfort

**Date:** 2026-06-04
**Source:** `PRD.md` §8 (Key Data Entities) + `architecture.md` conventions. Owner: this is the field-level schema referenced by AR4 and Epic 1 Story 1.8; tables are created **per-story when first needed** (the schema here is the target, not a "create everything up front" instruction).

> **⚠️ Engine changed → Convex (2026-06-08).** The Prisma/PostgreSQL schema below is **superseded** by Convex (see the Backend Platform Addendum in `architecture.md`). The **entities, fields, relationships, enums, and invariants here remain the target** — re-express them in `convex/schema.ts` (`defineTable` + `v.*` validators). Mapping rules:
> - `model X { ... @@map("xs") }` → `xs: defineTable({ ... })` in `defineSchema`.
> - PK `id String @id @default(uuidv7())` → Convex's built-in `_id: Id<"xs">` + `_creationTime` (drop the manual `id`/`createdAt` where the built-ins suffice; keep explicit `createdAt` only when it must differ from insert time).
> - FK `xId String @db.Uuid` → `xId: v.id("xs")`; add `.index("by_x", ["xId"])` for lookups (Convex has no implicit FK indexes).
> - `amountCents BigInt` → `v.int64()` (or a number of cents); `Decimal` (tax rates) → `v.number()` with documented precision; money invariants unchanged (integer minor units, never floats).
> - Postgres enums → `v.union(v.literal("..."), ...)` (or a shared TS union in `packages/shared`).
> - `Json?` → `v.optional(v.any())` or a precise `v.object({...})`; soft-delete `deletedAt` → `v.optional(v.number())`.
> - Relations are resolved in queries via indexes (no joins); audit (`auditLogs`) is written from mutations (AR9 unchanged).
> The Prisma blocks below are kept for the field-level reference; treat them as the source-of-truth for *shape*, not for the *engine*.

## Conventions (from architecture)

- **Engine:** PostgreSQL 18 + Prisma 7. Place at `packages/db/prisma/schema.prisma`.
- **IDs:** UUID v7 primary keys named `id` (`@db.Uuid`, `@default(dbgenerated("uuidv7()"))` or app-generated v7). FKs `<entity>Id` in TS → `<entity>_id` in DB.
- **Naming:** Prisma models `PascalCase` singular; tables `snake_case` plural via `@@map`; columns `snake_case` via `@map`.
- **Money:** integer minor units — `amountCents BigInt` + `currency String @default("KES")`. Never `Float`/`Decimal` for currency display amounts. (Tax rates are `Decimal`.)
- **Timestamps:** `createdAt`, `updatedAt`; soft delete via nullable `deletedAt` where retention matters.
- **Enums:** Postgres enums for fixed status sets.
- **Audit:** mutations to money/sensitive tables also write an `AuditLog` row (app-level, AR9).
- **Releases:** R1 (MVP) = Identity, Property/Rooms/Rates, Guests, Bookings, Payments/Ledger/Invoices, Audit. R2 = Housekeeping/Maintenance/Assets. R2/R3 = Inventory, Restaurant. Deferred models are included here for completeness and marked.

## Enums

```prisma
enum RoomStatus { available occupied dirty cleaning maintenance blocked }
enum BookingStatus { pending confirmed checked_in checked_out cancelled no_show }
enum BookingSource { website direct walk_in ota agent phone whatsapp }
enum PaymentProvider { mpesa_stk mpesa_manual cash card }
enum PaymentStatus { pending confirmed failed reversed }
enum LedgerEntryType { charge payment refund adjustment }
enum TaskStatus { pending in_progress paused completed flagged }     // R2
enum TaskPriority { low normal high urgent }                          // R2
enum IssueStatus { open in_progress resolved cancelled }              // R2
enum AssetCheckResult { present missing damaged }                     // R2
enum StockMovementReason { purchase usage adjustment stocktake }      // R2/R3
enum OrderChannel { room_service dine_in takeaway bar }               // R3
enum OrderStatus { pending preparing ready served paid cancelled }    // R3
```

## R1 — Identity & Access

```prisma
model User {
  id            String   @id @default(dbgenerated("uuidv7()")) @db.Uuid
  email         String   @unique
  passwordHash  String   @map("password_hash")
  fullName      String   @map("full_name")
  phone         String?
  isActive      Boolean  @default(true) @map("is_active")
  roles         UserRole[]
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")
  deletedAt     DateTime? @map("deleted_at")
  @@map("users")
}

model Role {
  id          String   @id @default(dbgenerated("uuidv7()")) @db.Uuid
  name        String   @unique
  description String?
  permissions RolePermission[]
  users       UserRole[]
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
  @@map("roles")
}

model Permission {
  id    String @id @default(dbgenerated("uuidv7()")) @db.Uuid
  area  String   // one of the 18 permission areas
  action String  // read | write | manage
  roles RolePermission[]
  @@unique([area, action])
  @@map("permissions")
}

model RolePermission {
  roleId       String @map("role_id") @db.Uuid
  permissionId String @map("permission_id") @db.Uuid
  role         Role       @relation(fields: [roleId], references: [id])
  permission   Permission @relation(fields: [permissionId], references: [id])
  @@id([roleId, permissionId])
  @@map("role_permissions")
}

model UserRole {
  userId String @map("user_id") @db.Uuid
  roleId String @map("role_id") @db.Uuid
  user   User @relation(fields: [userId], references: [id])
  role   Role @relation(fields: [roleId], references: [id])
  @@id([userId, roleId])
  @@map("user_roles")
}

model RefreshToken {
  id         String   @id @default(dbgenerated("uuidv7()")) @db.Uuid
  userId     String   @map("user_id") @db.Uuid
  tokenHash  String   @map("token_hash")
  expiresAt  DateTime @map("expires_at")
  revokedAt  DateTime? @map("revoked_at")
  createdAt  DateTime @default(now()) @map("created_at")
  user       User @relation(fields: [userId], references: [id])
  @@map("refresh_tokens")
}

model AuditLog {
  id         String   @id @default(dbgenerated("uuidv7()")) @db.Uuid
  actorId    String?  @map("actor_id") @db.Uuid
  action     String
  entityType String   @map("entity_type")
  entityId   String?  @map("entity_id")
  before     Json?
  after      Json?
  ip         String?
  createdAt  DateTime @default(now()) @map("created_at")
  @@index([entityType, entityId])
  @@index([actorId, createdAt])
  @@map("audit_logs")
}
```
> Note: `User.roles` ↔ `Role.users` via `UserRole`; `Role` ↔ `Permission` via `RolePermission`. Relation back-references on `User`/`Role` omitted above for brevity must be added for Prisma to compile.

## R1 — Property, Rooms, Rates

```prisma
model Property {
  id              String  @id @default(dbgenerated("uuidv7()")) @db.Uuid
  name            String
  checkInTime     String  @map("check_in_time")   // "14:00"
  checkOutTime    String  @map("check_out_time")  // "10:00"
  cancellationNote String? @map("cancellation_note")
  idRequired      Boolean @default(true) @map("id_required")
  branches        Branch[]
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")
  @@map("properties")
}

model Branch {
  id         String @id @default(dbgenerated("uuidv7()")) @db.Uuid
  propertyId String @map("property_id") @db.Uuid
  name       String
  location   String?
  rooms      Room[]
  property   Property @relation(fields: [propertyId], references: [id])
  @@map("branches")
}

model Amenity {
  id        String @id @default(dbgenerated("uuidv7()")) @db.Uuid
  name      String @unique
  roomTypes RoomTypeAmenity[]
  @@map("amenities")
}

model RoomType {
  id        String @id @default(dbgenerated("uuidv7()")) @db.Uuid
  name      String
  capacity  Int
  sizeSqm   Int?   @map("size_sqm")
  amenities RoomTypeAmenity[]
  rooms     Room[]
  ratePlans RatePlan[]
  @@map("room_types")
}

model RoomTypeAmenity {
  roomTypeId String @map("room_type_id") @db.Uuid
  amenityId  String @map("amenity_id") @db.Uuid
  roomType   RoomType @relation(fields: [roomTypeId], references: [id])
  amenity    Amenity  @relation(fields: [amenityId], references: [id])
  @@id([roomTypeId, amenityId])
  @@map("room_type_amenities")
}

model Room {
  id         String   @id @default(dbgenerated("uuidv7()")) @db.Uuid
  branchId   String   @map("branch_id") @db.Uuid
  roomTypeId String   @map("room_type_id") @db.Uuid
  number     String
  floor      String?
  status     RoomStatus @default(available)
  bookings   Booking[]
  branch     Branch   @relation(fields: [branchId], references: [id])
  roomType   RoomType @relation(fields: [roomTypeId], references: [id])
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")
  @@unique([branchId, number])
  @@map("rooms")
}

model RatePlan {
  id          String  @id @default(dbgenerated("uuidv7()")) @db.Uuid
  roomTypeId  String  @map("room_type_id") @db.Uuid
  name        String
  nightlyCents BigInt @map("nightly_cents")
  currency    String  @default("KES")
  active      Boolean @default(true)
  roomType    RoomType @relation(fields: [roomTypeId], references: [id])
  @@map("rate_plans")
}

model TaxRule {
  id      String  @id @default(dbgenerated("uuidv7()")) @db.Uuid
  name    String
  rate    Decimal @db.Decimal(5,4)   // e.g. 0.1600 = 16% VAT
  active  Boolean @default(true)
  @@map("tax_rules")
}
```

## R1 — Guests & Bookings

```prisma
model Guest {
  id          String  @id @default(dbgenerated("uuidv7()")) @db.Uuid
  fullName    String  @map("full_name")
  email       String?
  phone       String?
  dob         DateTime?
  nationality String?
  idType      String? @map("id_type")
  idNumber    String? @map("id_number")   // encrypted at rest (app/column-level)
  documents   GuestDocument[]
  bookings    Booking[]
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
  @@index([phone])
  @@index([email])
  @@map("guests")
}

model GuestDocument {
  id        String @id @default(dbgenerated("uuidv7()")) @db.Uuid
  guestId   String @map("guest_id") @db.Uuid
  kind      String // id_front | id_back
  objectKey String @map("object_key")   // S3 key; served via signed URL only
  guest     Guest  @relation(fields: [guestId], references: [id])
  createdAt DateTime @default(now()) @map("created_at")
  @@map("guest_documents")
}

model Booking {
  id            String   @id @default(dbgenerated("uuidv7()")) @db.Uuid
  reference     String   @unique           // BK-XXXX
  guestId       String   @map("guest_id") @db.Uuid
  roomId        String   @map("room_id") @db.Uuid
  ratePlanId    String?  @map("rate_plan_id") @db.Uuid
  checkInDate   DateTime @map("check_in_date") @db.Date
  checkOutDate  DateTime @map("check_out_date") @db.Date
  status        BookingStatus @default(pending)
  source        BookingSource @default(website)
  notes         String?
  expectedTotalCents BigInt @map("expected_total_cents")
  currency      String   @default("KES")
  guest         Guest @relation(fields: [guestId], references: [id])
  room          Room  @relation(fields: [roomId], references: [id])
  payments      Payment[]
  ledgerEntries LedgerEntry[]
  invoices      Invoice[]
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")
  @@index([status])
  @@index([checkInDate, checkOutDate])
  @@map("bookings")
}
```

## R1 — Payments, Ledger, Invoices

```prisma
model Payment {
  id            String  @id @default(dbgenerated("uuidv7()")) @db.Uuid
  bookingId     String? @map("booking_id") @db.Uuid   // null = standalone (e.g. restaurant)
  provider      PaymentProvider
  status        PaymentStatus @default(pending)
  amountCents   BigInt  @map("amount_cents")
  currency      String  @default("KES")
  providerCheckoutRequestId String? @map("provider_checkout_request_id")
  providerMerchantRequestId String? @map("provider_merchant_request_id")
  providerReceiptNumber     String? @map("provider_receipt_number")
  paidPhone     String? @map("paid_phone")
  paidAt        DateTime? @map("paid_at")
  reconciled    Boolean @default(false)
  booking       Booking? @relation(fields: [bookingId], references: [id])
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")
  @@unique([provider, providerReceiptNumber])   // dedupe confirmed M-Pesa receipts
  @@index([status])
  @@map("payments")
}

model LedgerEntry {
  id          String @id @default(dbgenerated("uuidv7()")) @db.Uuid
  bookingId   String @map("booking_id") @db.Uuid
  type        LedgerEntryType
  amountCents BigInt @map("amount_cents")   // +charge / -payment-refund per sign convention
  currency    String @default("KES")
  memo        String?
  paymentId   String? @map("payment_id") @db.Uuid
  booking     Booking @relation(fields: [bookingId], references: [id])
  createdAt   DateTime @default(now()) @map("created_at")
  @@index([bookingId])
  @@map("ledger_entries")
}

model Invoice {
  id          String @id @default(dbgenerated("uuidv7()")) @db.Uuid
  bookingId   String @map("booking_id") @db.Uuid
  number      String @unique
  isReceipt   Boolean @default(false) @map("is_receipt")
  totalCents  BigInt @map("total_cents")
  currency    String @default("KES")
  pdfObjectKey String? @map("pdf_object_key")
  booking     Booking @relation(fields: [bookingId], references: [id])
  createdAt   DateTime @default(now()) @map("created_at")
  @@map("invoices")
}
```

## R2 — Housekeeping, Maintenance, Assets (deferred)

```prisma
model HousekeepingTask {
  id          String @id @default(dbgenerated("uuidv7()")) @db.Uuid
  roomId      String @map("room_id") @db.Uuid
  bookingId   String? @map("booking_id") @db.Uuid
  assigneeId  String? @map("assignee_id") @db.Uuid
  status      TaskStatus @default(pending)
  priority    TaskPriority @default(normal)
  checklist   Json?      // [{label, done}] templated by room type
  notes       String?
  photos      TaskPhoto[]
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
  @@index([assigneeId, status])
  @@map("housekeeping_tasks")
}

model TaskPhoto {
  id        String @id @default(dbgenerated("uuidv7()")) @db.Uuid
  taskId    String @map("task_id") @db.Uuid
  objectKey String @map("object_key")
  task      HousekeepingTask @relation(fields: [taskId], references: [id])
  createdAt DateTime @default(now()) @map("created_at")
  @@map("task_photos")
}

model MaintenanceIssue {
  id        String @id @default(dbgenerated("uuidv7()")) @db.Uuid
  roomId    String? @map("room_id") @db.Uuid
  status    IssueStatus @default(open)
  title     String
  notes     String?
  damageChargeCents BigInt? @map("damage_charge_cents")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  @@map("maintenance_issues")
}

model RoomAsset {
  id      String @id @default(dbgenerated("uuidv7()")) @db.Uuid
  roomId  String @map("room_id") @db.Uuid
  name    String
  checks  AssetCheck[]
  @@map("room_assets")
}

model AssetCheck {
  id        String @id @default(dbgenerated("uuidv7()")) @db.Uuid
  assetId   String @map("asset_id") @db.Uuid
  bookingId String? @map("booking_id") @db.Uuid
  result    AssetCheckResult
  chargeCents BigInt? @map("charge_cents")
  asset     RoomAsset @relation(fields: [assetId], references: [id])
  createdAt DateTime @default(now()) @map("created_at")
  @@map("asset_checks")
}
```

## R2/R3 — Inventory & Restaurant (deferred)

```prisma
model ProductCategory {
  id       String @id @default(dbgenerated("uuidv7()")) @db.Uuid
  name     String @unique
  products Product[]
  @@map("product_categories")
}

model Product {
  id            String @id @default(dbgenerated("uuidv7()")) @db.Uuid
  categoryId    String? @map("category_id") @db.Uuid
  name          String
  unit          String
  costCents     BigInt @map("cost_cents")
  sellingCents  BigInt @map("selling_cents")
  stockQty      Decimal @db.Decimal(12,3) @map("stock_qty")
  reorderLevel  Decimal @db.Decimal(12,3) @map("reorder_level")
  active        Boolean @default(true)
  category      ProductCategory? @relation(fields: [categoryId], references: [id])
  movements     StockMovement[]
  @@map("products")
}

model Supplier {
  id     String @id @default(dbgenerated("uuidv7()")) @db.Uuid
  name   String
  phone  String?
  email  String?
  purchaseOrders PurchaseOrder[]
  @@map("suppliers")
}

model PurchaseOrder {
  id         String @id @default(dbgenerated("uuidv7()")) @db.Uuid
  supplierId String @map("supplier_id") @db.Uuid
  status     String @default("draft")  // draft | ordered | received | cancelled
  totalCents BigInt @map("total_cents")
  supplier   Supplier @relation(fields: [supplierId], references: [id])
  createdAt  DateTime @default(now()) @map("created_at")
  @@map("purchase_orders")
}

model StockMovement {
  id        String @id @default(dbgenerated("uuidv7()")) @db.Uuid
  productId String @map("product_id") @db.Uuid
  reason    StockMovementReason
  qtyDelta  Decimal @db.Decimal(12,3) @map("qty_delta")
  actorId   String? @map("actor_id") @db.Uuid
  product   Product @relation(fields: [productId], references: [id])
  createdAt DateTime @default(now()) @map("created_at")
  @@index([productId, createdAt])
  @@map("stock_movements")
}

model Stocktake {
  id         String @id @default(dbgenerated("uuidv7()")) @db.Uuid
  finalizedAt DateTime? @map("finalized_at")
  createdAt  DateTime @default(now()) @map("created_at")
  @@map("stocktakes")
}

model MenuItem {
  id         String @id @default(dbgenerated("uuidv7()")) @db.Uuid
  productId  String? @map("product_id") @db.Uuid   // link to inventory
  name       String
  priceCents BigInt @map("price_cents")
  active     Boolean @default(true)
  orderItems OrderItem[]
  @@map("menu_items")
}

model RestaurantOrder {
  id         String @id @default(dbgenerated("uuidv7()")) @db.Uuid
  channel    OrderChannel
  status     OrderStatus @default(pending)
  bookingId  String? @map("booking_id") @db.Uuid   // charge-to-room
  totalCents BigInt @map("total_cents")
  items      OrderItem[]
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")
  @@index([status])
  @@map("restaurant_orders")
}

model OrderItem {
  id         String @id @default(dbgenerated("uuidv7()")) @db.Uuid
  orderId    String @map("order_id") @db.Uuid
  menuItemId String @map("menu_item_id") @db.Uuid
  qty        Int
  priceCents BigInt @map("price_cents")
  order      RestaurantOrder @relation(fields: [orderId], references: [id])
  menuItem   MenuItem @relation(fields: [menuItemId], references: [id])
  @@map("order_items")
}
```

## Cross-cutting

```prisma
model NotificationLog {
  id         String @id @default(dbgenerated("uuidv7()")) @db.Uuid
  channel    String // email | sms | whatsapp | push
  recipient  String
  template   String
  status     String @default("queued")  // queued | sent | failed
  error      String?
  createdAt  DateTime @default(now()) @map("created_at")
  @@map("notification_logs")
}
```

## PRD §8 entity coverage

Property ✓, Branch ✓, User/Staff ✓ (`User`), Role & Permission ✓, Guest ✓, Guest Document ✓, Room ✓, Room Type ✓, Amenity ✓, Rate Plan ✓, Booking ✓, Booking Payment ✓ (`Payment` + `LedgerEntry`), Invoice/Receipt ✓ (`Invoice.isReceipt`), Housekeeping Task ✓, Maintenance Issue ✓, Room Asset ✓, Asset Check ✓, Damage Charge ✓ (fields on `MaintenanceIssue`/`AssetCheck`), Product ✓, Product Category ✓, Supplier ✓, Purchase Order ✓, Stock Movement ✓, Stocktake ✓, Restaurant Order ✓ (+ `OrderItem`), Notification Log ✓, Audit Log ✓. **All 28 PRD entities mapped.**

## Open items

- Confirm `uuidv7()` generation strategy (Postgres 18 extension vs app-side `uuidv7` lib). If unavailable, use app-generated UUID v7 strings.
- ID-number encryption mechanism (pgcrypto column vs app-level envelope encryption) — decide before Guest stories.
- `RatePlan` is currently flat nightly; seasonal/day-of-week pricing is out of MVP scope (PRD §12 dynamic pricing deferred).
- Relation back-references must be completed for Prisma to compile (noted inline); this doc is the field/intent spec, not the final compilable file.
