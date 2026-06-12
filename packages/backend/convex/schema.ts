import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

/**
 * Fammy Comforts Convex schema (AR4′ — see architecture.md Backend Platform Addendum).
 *
 * Tables are added **per-story when first needed** (the data-model.md entities are
 * the target, re-expressed as Convex tables). This scaffold defines only
 * `auditLogs` — the cross-cutting audit table (AR9) — to prove the wiring +
 * conventions. Identity / property / booking / payment tables land with their
 * owning stories (Epic 2+).
 *
 * Conventions:
 * - Built-in `_id: Id<"table">` + `_creationTime` replace the Prisma `id`/`createdAt`.
 * - Foreign keys are `v.id("otherTable")` + an `.index(...)` (no implicit FK indexes).
 * - Money: integer minor units via `v.int64()`; never floats.
 * - Enums: `v.union(v.literal(...), ...)` or a shared TS union in `packages/shared`.
 *
 * ⛔ MULTI-TENANCY NON-NEGOTIABLE (Epic 2 integration spec §2, from Story 2.1 on):
 *   Every tenant-scoped table carries `orgId: v.id("organizations")` and a
 *   `by_org*` index, and EVERY query/mutation filters by the SSO-resolved
 *   `orgId` (see `lib/auth.ts` → `requireOrgUser`). The only table exempt is
 *   `organizations` itself (it *is* the tenant root). Cross-cutting infra tables
 *   that are not per-tenant (`backupRuns`) are also exempt; `auditLogs` will gain
 *   `orgId` when auth wiring lands (kept optional now for the Story-1 scaffold).
 *   No new tenant table ships without `orgId` — backfilling it later is painful.
 */
export default defineSchema({
  // Convex Auth managed tables (`authSessions`, `authAccounts`,
  // `authRefreshTokens`, `authVerificationCodes`, `authVerifiers`,
  // `authRateLimits`, and a default `users`). Our `users` definition below
  // overrides the auth default to carry the app + tenancy fields. Session
  // minting (the `sso-handoff` provider in `auth.ts`) reads/writes these.
  ...authTables,

  // ===== Identity & Access (Epic 2, Story 2.1) — SSO identity cache =====
  // FammyComfort does NOT own credentials; staff authenticate via the
  // Bytebazaar (ByteAuth) SSO handoff. These two tables are a local cache of
  // the org + user resolved from `verifyHandoff`, populated on first SSO and
  // refreshed on each subsequent one. `organizations` is the tenant root.

  organizations: defineTable({
    // The Bytebazaar org `_id` (string form) — the stable cross-platform key
    // we upsert against. Unique per org.
    bytebazaarOrgId: v.string(),
    name: v.string(),
    // Bytebazaar slugs are unique platform-wide; `by_slug` is the PUBLIC
    // tenant-resolution key for guest-facing routes (`/book/[orgSlug]`, Epic 4).
    slug: v.string(),
  })
    .index("by_bytebazaar_org", ["bytebazaarOrgId"])
    .index("by_slug", ["slug"]),

  users: defineTable({
    // Tenant scope (the non-negotiable). Every user belongs to exactly one org.
    orgId: v.id("organizations"),
    // The Bytebazaar user `_id` (string form) — the SSO upsert key, unique.
    bytebazaarUserId: v.string(),
    name: v.string(),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    // Raw role string from the SSO payload. Granular RBAC (the tables below +
    // `requirePermission`) is Story 2.3 — this is the seed it refines.
    role: v.string(),
    // Server-authoritative active gate (Story 2.4 deactivate builds on this).
    isActive: v.boolean(),
  })
    .index("by_org", ["orgId"])
    .index("by_bytebazaar_user", ["bytebazaarUserId"]),

  // ===== RBAC (Story 2.3) — 12 roles × 18 areas × {read|write|manage} =====
  // `permissions` is a GLOBAL catalog (the area:action definitions are the same
  // for every tenant). `roles`/`rolePermissions`/`userRoles` are PER-ORG (each
  // org gets its own seeded copy of the base roles + can customise), so they
  // carry `orgId` + a `by_org*` index per the non-negotiable. Enforcement is the
  // in-function `requirePermission(ctx, area, action)` helper (AR6′) — no FKs,
  // uniqueness enforced by index-read inside the mutation.

  permissions: defineTable({
    area: v.string(),
    action: v.union(
      v.literal("read"),
      v.literal("write"),
      v.literal("manage"),
    ),
  }).index("by_area_action", ["area", "action"]),

  roles: defineTable({
    orgId: v.id("organizations"),
    name: v.string(),
    description: v.optional(v.string()),
    // System (seeded base) roles vs admin-created custom roles.
    isSystem: v.boolean(),
  })
    .index("by_org", ["orgId"])
    .index("by_org_name", ["orgId", "name"]),

  rolePermissions: defineTable({
    orgId: v.id("organizations"),
    roleId: v.id("roles"),
    permissionId: v.id("permissions"),
  })
    .index("by_org", ["orgId"])
    .index("by_role", ["roleId"]),

  userRoles: defineTable({
    orgId: v.id("organizations"),
    userId: v.id("users"),
    roleId: v.id("roles"),
  })
    .index("by_org", ["orgId"])
    .index("by_user", ["userId"])
    .index("by_role", ["roleId"]),

  // ===== Property & inventory (Epic 3) — per-org, gated by the "Settings" area =====
  // Story 3.1: property/branch settings. Room types, rooms, rates land with their
  // own stories (3.2–3.4) per the per-story-tables principle.
  properties: defineTable({
    orgId: v.id("organizations"),
    name: v.string(),
    checkInTime: v.string(), // "HH:MM" (24h)
    checkOutTime: v.string(), // "HH:MM" (24h)
    cancellationNote: v.optional(v.string()),
    idRequired: v.boolean(),
  }).index("by_org", ["orgId"]),

  branches: defineTable({
    orgId: v.id("organizations"),
    propertyId: v.id("properties"),
    name: v.string(),
    location: v.optional(v.string()),
  })
    .index("by_org", ["orgId"])
    .index("by_property", ["propertyId"]),

  // Room types + amenities (Story 3.2) — "Rooms" permission area.
  amenities: defineTable({
    orgId: v.id("organizations"),
    name: v.string(),
  })
    .index("by_org", ["orgId"])
    .index("by_org_name", ["orgId", "name"]),

  roomTypes: defineTable({
    orgId: v.id("organizations"),
    name: v.string(),
    capacity: v.number(),
    sizeSqm: v.optional(v.number()),
  }).index("by_org", ["orgId"]),

  roomTypeAmenities: defineTable({
    orgId: v.id("organizations"),
    roomTypeId: v.id("roomTypes"),
    amenityId: v.id("amenities"),
  })
    .index("by_org", ["orgId"])
    .index("by_roomType", ["roomTypeId"]),

  // Rooms (Story 3.3) — real bookable units. `status` mirrors the RoomStatus
  // domain enum (data-model.md). `by_branch_number` enforces unique numbers
  // per branch via an in-mutation index read (no Convex unique constraint).
  rooms: defineTable({
    orgId: v.id("organizations"),
    branchId: v.id("branches"),
    roomTypeId: v.id("roomTypes"),
    number: v.string(),
    floor: v.optional(v.string()),
    status: v.union(
      v.literal("available"),
      v.literal("occupied"),
      v.literal("dirty"),
      v.literal("cleaning"),
      v.literal("maintenance"),
      v.literal("blocked"),
    ),
  })
    .index("by_org", ["orgId"])
    .index("by_branch", ["branchId"])
    .index("by_roomType", ["roomTypeId"])
    .index("by_branch_number", ["branchId", "number"]),

  // Rate plans + tax (Story 3.4) — "Settings" area. Money is integer minor units
  // via int64 (never floats); tax rate is a fraction (0.16 = 16% VAT).
  ratePlans: defineTable({
    orgId: v.id("organizations"),
    roomTypeId: v.id("roomTypes"),
    name: v.string(),
    nightlyCents: v.int64(),
    currency: v.string(), // "KES"
    active: v.boolean(),
  })
    .index("by_org", ["orgId"])
    .index("by_roomType", ["roomTypeId"]),

  taxRules: defineTable({
    orgId: v.id("organizations"),
    name: v.string(),
    rate: v.number(), // fraction, e.g. 0.16
    active: v.boolean(),
  }).index("by_org", ["orgId"]),

  // ===== Guests & Bookings (Epic 4) — guest-facing, PUBLIC entry points =====
  // Public functions resolve the tenant via `organizations.by_slug` (no session)
  // and then filter by that orgId — tenant isolation is preserved (spec §2).
  // Payment PROCESSING is Epic 5; bookings here record method/split INTENT only.

  guests: defineTable({
    orgId: v.id("organizations"),
    fullName: v.string(),
    // Phone is required — it is the lookup credential (reference + phone/email).
    phone: v.string(),
    email: v.optional(v.string()),
    dob: v.optional(v.string()), // "YYYY-MM-DD"
    nationality: v.optional(v.string()),
    idType: v.optional(v.string()),
    // Sensitive (NFR13): never returned by public queries, never audited.
    // Convex encrypts at rest; column-level crypto revisited with Epic 6 check-in.
    idNumber: v.optional(v.string()),
    consentAt: v.number(), // ms epoch — consent is required to create
  }).index("by_org", ["orgId"]),

  guestDocuments: defineTable({
    orgId: v.id("organizations"),
    guestId: v.id("guests"),
    bookingId: v.id("bookings"),
    kind: v.union(v.literal("id_front"), v.literal("id_back")),
    storageId: v.id("_storage"), // served via signed URLs only (Epic 6 check-in)
  })
    .index("by_org", ["orgId"])
    .index("by_booking", ["bookingId"]),

  bookings: defineTable({
    orgId: v.id("organizations"),
    reference: v.string(), // BK-XXXXXX, globally unique
    guestId: v.id("guests"),
    roomId: v.id("rooms"),
    ratePlanId: v.optional(v.id("ratePlans")),
    checkInDate: v.string(), // "YYYY-MM-DD"; [checkIn, checkOut) half-open
    checkOutDate: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("confirmed"),
      v.literal("checked_in"),
      v.literal("checked_out"),
      v.literal("cancelled"),
      v.literal("no_show"),
    ),
    source: v.union(
      v.literal("website"),
      v.literal("direct"),
      v.literal("walk_in"),
      v.literal("ota"),
      v.literal("agent"),
      v.literal("phone"),
      v.literal("whatsapp"),
    ),
    notes: v.optional(v.string()),
    expectedTotalCents: v.int64(),
    currency: v.string(),
    // Payment INTENT (Story 4.6) — processing lands in Epic 5.
    paymentMethod: v.union(
      v.literal("mpesa_stk"),
      v.literal("mpesa_manual"),
      v.literal("cash"),
      v.literal("card"),
    ),
    paymentSplits: v.optional(
      v.array(
        v.object({
          method: v.union(
            v.literal("mpesa_stk"),
            v.literal("mpesa_manual"),
            v.literal("cash"),
            v.literal("card"),
          ),
          amountCents: v.int64(),
        }),
      ),
    ),
  })
    .index("by_org", ["orgId"])
    .index("by_reference", ["reference"])
    .index("by_room", ["roomId"])
    .index("by_guest", ["guestId"]),

  // ===== Payments, Ledger, Invoices (Epic 5) =====
  // Money invariant (NFR14/AR5): every amount is integer minor units (int64
  // cents) + currency; the booking balance is DERIVED from ledgerEntries (sum),
  // never hand-edited. Sign convention: charge/adjustment positive, payment/
  // refund negative.

  // 5.1 — per-org payment-method toggles. Missing row = ENABLED by default;
  // an explicit row turns a method off (or back on). Guest + desk flows offer
  // only enabled methods.
  paymentMethodSettings: defineTable({
    orgId: v.id("organizations"),
    method: v.union(
      v.literal("mpesa_stk"),
      v.literal("mpesa_manual"),
      v.literal("cash"),
      v.literal("card"),
    ),
    enabled: v.boolean(),
  })
    .index("by_org", ["orgId"])
    .index("by_org_method", ["orgId", "method"]),

  // 5.3/5.4 — per-org Daraja credentials (each property runs its OWN paybill —
  // two-layer model). Admin-entered (Payments:manage); secrets never audited or
  // returned to clients; Convex encrypts at rest. The OAuth token is cached on
  // the row (no Redis in this stack).
  mpesaConfigs: defineTable({
    orgId: v.id("organizations"),
    env: v.union(v.literal("sandbox"), v.literal("production")),
    shortcode: v.string(),
    passkey: v.string(),
    consumerKey: v.string(),
    consumerSecret: v.string(),
    transactionType: v.union(
      v.literal("CustomerPayBillOnline"),
      v.literal("CustomerBuyGoodsOnline"),
    ),
    // Shared secret embedded in the callback path; rejected if mismatched.
    callbackToken: v.string(),
    cachedAccessToken: v.optional(v.string()),
    cachedTokenExpiresAt: v.optional(v.number()),
  }).index("by_org", ["orgId"]),

  payments: defineTable({
    orgId: v.id("organizations"),
    bookingId: v.optional(v.id("bookings")), // null = standalone (restaurant, R3)
    provider: v.union(
      v.literal("mpesa_stk"),
      v.literal("mpesa_manual"),
      v.literal("cash"),
      v.literal("card"),
    ),
    status: v.union(
      v.literal("pending"),
      v.literal("confirmed"),
      v.literal("failed"),
      v.literal("reversed"),
    ),
    amountCents: v.int64(),
    currency: v.string(),
    providerCheckoutRequestId: v.optional(v.string()),
    providerMerchantRequestId: v.optional(v.string()),
    providerReceiptNumber: v.optional(v.string()),
    paidPhone: v.optional(v.string()),
    paidAt: v.optional(v.number()),
    resultDesc: v.optional(v.string()),
    reconciled: v.boolean(),
    // Set when the callback amount differed from the requested amount (5.8).
    amountMismatch: v.optional(v.boolean()),
  })
    .index("by_org", ["orgId"])
    .index("by_booking", ["bookingId"])
    .index("by_checkout_request", ["providerCheckoutRequestId"])
    .index("by_receipt", ["providerReceiptNumber"])
    .index("by_org_reconciled", ["orgId", "reconciled"]),

  ledgerEntries: defineTable({
    orgId: v.id("organizations"),
    bookingId: v.id("bookings"),
    type: v.union(
      v.literal("charge"),
      v.literal("payment"),
      v.literal("refund"),
      v.literal("adjustment"),
    ),
    amountCents: v.int64(), // signed: charge + / payment −
    currency: v.string(),
    memo: v.optional(v.string()),
    paymentId: v.optional(v.id("payments")),
  })
    .index("by_org", ["orgId"])
    .index("by_booking", ["bookingId"]),

  // 5.6 — invoices & receipts. Line items are snapshotted from the ledger at
  // generation time so the document never drifts from what it billed.
  invoices: defineTable({
    orgId: v.id("organizations"),
    bookingId: v.id("bookings"),
    number: v.string(), // INV-/RCT- + booking reference + sequence
    isReceipt: v.boolean(),
    totalCents: v.int64(),
    currency: v.string(),
    lines: v.array(
      v.object({
        description: v.string(),
        amountCents: v.int64(),
      }),
    ),
  })
    .index("by_org", ["orgId"])
    .index("by_booking", ["bookingId"])
    .index("by_number", ["number"]),

  // 5.7 — guest requests from the portal; surfaced to staff (full ops = R2).
  guestRequests: defineTable({
    orgId: v.id("organizations"),
    bookingId: v.id("bookings"),
    message: v.string(),
    status: v.union(v.literal("open"), v.literal("resolved")),
  })
    .index("by_org", ["orgId"])
    .index("by_org_status", ["orgId", "status"])
    .index("by_booking", ["bookingId"]),

  // Queued outbound notifications (Story 4.7 "confirmation queued"). The send
  // engine (own SenderID SMS — Epic 5/10) consumes rows with status "queued",
  // honoring notificationSettings.
  outboundNotifications: defineTable({
    orgId: v.id("organizations"),
    type: v.string(), // e.g. "booking_confirmation"
    channel: v.union(
      v.literal("email"),
      v.literal("sms"),
      v.literal("whatsapp"),
      v.literal("push"),
    ),
    bookingId: v.optional(v.id("bookings")),
    status: v.union(v.literal("queued"), v.literal("sent"), v.literal("failed")),
  })
    .index("by_org", ["orgId"])
    .index("by_status", ["status"]),

  // Notification settings (Story 3.5) — "Notifications" area. One row per
  // (type, channel); the notification engine respects `enabled`.
  notificationSettings: defineTable({
    orgId: v.id("organizations"),
    type: v.string(), // e.g. "booking_confirmation", "check_in_reminder"
    channel: v.union(
      v.literal("email"),
      v.literal("sms"),
      v.literal("whatsapp"),
      v.literal("push"),
    ),
    enabled: v.boolean(),
  })
    .index("by_org", ["orgId"])
    .index("by_org_type_channel", ["orgId", "type", "channel"]),

  auditLogs: defineTable({
    // Tenant scope (Story 2.3). Optional: Story-1 infra rows (backups) have no org.
    orgId: v.optional(v.id("organizations")),
    // actorId is the `users._id` string where known (kept as string so infra
    // rows without an actor stay valid; resolved from `ctx.auth`, never client).
    actorId: v.optional(v.string()),
    action: v.string(),
    entityType: v.string(),
    entityId: v.optional(v.string()),
    before: v.optional(v.any()),
    after: v.optional(v.any()),
    ip: v.optional(v.string()),
  })
    .index("by_entity", ["entityType", "entityId"])
    .index("by_actor", ["actorId"])
    .index("by_org", ["orgId"]),

  // Backup/DR run ledger (Story 1.10, NFR12). A row is written from a mutation
  // for each scheduled `convex export`; the artifact blob lives in `_storage`
  // and `prune` deletes both the row and the blob beyond the retention window.
  backupRuns: defineTable({
    status: v.union(
      v.literal("started"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    storageId: v.optional(v.id("_storage")),
    sizeBytes: v.optional(v.int64()),
    error: v.optional(v.string()),
    trigger: v.union(v.literal("cron"), v.literal("manual")),
  })
    .index("by_status", ["status"])
    .index("by_started", ["startedAt"]),
});
