import { internalMutation } from "./_generated/server";
import { ensureOrgRoles } from "./rbac";

/**
 * Demo/showcase seed — creates a complete "demo" tenant (org, property, branch,
 * room types, rooms, rates, VAT, notification setting) so the guest catalog and
 * desk flows have real data to render. Idempotent by org slug; internal-only
 * (never client-callable). Run with:
 *   npx convex run devSeed:seedDemo            (dev)
 *   npx convex run devSeed:seedDemo --prod     (prod showcase)
 */
export const seedDemo = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", "demo"))
      .unique();
    if (existing) return { seeded: false, orgId: existing._id, slug: "demo" };

    const orgId = await ctx.db.insert("organizations", {
      bytebazaarOrgId: "demo-showcase",
      name: "Fammy Comforts Nairobi",
      slug: "demo",
    });
    await ensureOrgRoles(ctx, orgId);

    const propertyId = await ctx.db.insert("properties", {
      orgId,
      name: "Fammy Comforts Nairobi",
      checkInTime: "14:00",
      checkOutTime: "11:00",
      cancellationNote: "Free cancellation up to 24 hrs before check-in.",
      idRequired: true,
    });
    const branchId = await ctx.db.insert("branches", {
      orgId,
      propertyId,
      name: "Westlands",
      location: "Nairobi · Sarit Centre",
    });

    const amenityIds: Record<string, Awaited<ReturnType<typeof ctx.db.insert<"amenities">>>> = {};
    for (const name of ["Wi-Fi", "AC", "Smart TV", "Mini Bar", "Balcony", "Workspace"]) {
      amenityIds[name] = await ctx.db.insert("amenities", { orgId, name });
    }

    const types: {
      name: string;
      capacity: number;
      sizeSqm: number;
      nightly: bigint;
      amenities: string[];
      rooms: string[];
    }[] = [
      { name: "Standard", capacity: 2, sizeSqm: 18, nightly: 380000n, amenities: ["Wi-Fi", "AC"], rooms: ["102", "103", "202"] },
      { name: "Deluxe", capacity: 3, sizeSqm: 24, nightly: 630000n, amenities: ["Wi-Fi", "AC", "Smart TV", "Balcony"], rooms: ["104", "203"] },
      { name: "Executive", capacity: 2, sizeSqm: 32, nightly: 850000n, amenities: ["Wi-Fi", "AC", "Smart TV", "Mini Bar", "Workspace"], rooms: ["101", "301"] },
      { name: "Penthouse", capacity: 4, sizeSqm: 60, nightly: 1450000n, amenities: ["Wi-Fi", "AC", "Smart TV", "Mini Bar", "Balcony", "Workspace"], rooms: ["401"] },
    ];

    for (const t of types) {
      const roomTypeId = await ctx.db.insert("roomTypes", {
        orgId,
        name: t.name,
        capacity: t.capacity,
        sizeSqm: t.sizeSqm,
      });
      for (const a of t.amenities) {
        await ctx.db.insert("roomTypeAmenities", {
          orgId,
          roomTypeId,
          amenityId: amenityIds[a],
        });
      }
      await ctx.db.insert("ratePlans", {
        orgId,
        roomTypeId,
        name: "Nightly",
        nightlyCents: t.nightly,
        currency: "KES",
        active: true,
      });
      for (const number of t.rooms) {
        await ctx.db.insert("rooms", {
          orgId,
          branchId,
          roomTypeId,
          number,
          floor: number.slice(0, 1),
          status: "available",
        });
      }
    }

    await ctx.db.insert("taxRules", { orgId, name: "VAT", rate: 0.16, active: true });
    await ctx.db.insert("notificationSettings", {
      orgId,
      type: "booking_confirmation",
      channel: "sms",
      enabled: true,
    });
    await ctx.db.insert("auditLogs", {
      orgId,
      action: "demo.seed",
      entityType: "organization",
      entityId: orgId,
    });
    return { seeded: true, orgId, slug: "demo" };
  },
});
