import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { internal, api } from "./_generated/api";

/**
 * Room types + amenities (3.2) and rooms (3.3): org-scoped, "Rooms"-gated,
 * audited; unique room number per branch; cross-org and validation guards.
 */
async function adminOrg(t: ReturnType<typeof convexTest>, bb: string) {
  const ids = await t.mutation(internal.identity.upsertFromHandoff, {
    org: { bytebazaarOrgId: `bb_org_${bb}`, name: `Org ${bb}`, slug: bb },
    user: { bytebazaarUserId: `bb_admin_${bb}`, name: "Owner", role: "org_admin" },
  });
  await t.mutation(internal.rbac.bootstrapForUser, {
    orgId: ids.orgId,
    userId: ids.userId,
    ssoRole: "org_admin",
  });
  return { ids, as: t.withIdentity({ subject: ids.userId }) };
}

describe("room types & rooms (3.2 / 3.3)", () => {
  it("creates a room type with amenities and lists them resolved", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const { as } = await adminOrg(t, "A");

    const wifi = await as.mutation(api.amenities.create, { name: "Wi-Fi" });
    const ac = await as.mutation(api.amenities.create, { name: "AC" });
    await as.mutation(api.roomTypes.create, {
      name: "Deluxe",
      capacity: 2,
      sizeSqm: 24,
      amenityIds: [wifi, ac],
    });

    const types = await as.query(api.roomTypes.list, {});
    expect(types).toHaveLength(1);
    expect(types[0].amenities).toEqual(["AC", "Wi-Fi"]);
    expect(types[0].capacity).toBe(2);

    // Duplicate amenity name rejected; capacity floor enforced.
    await expect(as.mutation(api.amenities.create, { name: "Wi-Fi" })).rejects.toThrow(
      /already exists/,
    );
    await expect(
      as.mutation(api.roomTypes.create, { name: "Bad", capacity: 0 }),
    ).rejects.toThrow(/Capacity/);
  });

  it("creates rooms with a unique number per branch and tracks status", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const { as } = await adminOrg(t, "A");

    const propertyId = await as.mutation(api.property.create, {
      name: "P",
      checkInTime: "14:00",
      checkOutTime: "10:00",
      idRequired: true,
    });
    const branchId = await as.mutation(api.branches.create, {
      propertyId,
      name: "Main",
    });
    const roomTypeId = await as.mutation(api.roomTypes.create, {
      name: "Standard",
      capacity: 2,
    });

    const roomId = await as.mutation(api.rooms.create, {
      branchId,
      roomTypeId,
      number: "101",
    });
    const rooms = await as.query(api.rooms.list, {});
    expect(rooms).toHaveLength(1);
    expect(rooms[0].status).toBe("available");
    expect(rooms[0].roomTypeName).toBe("Standard");

    // Unique number per branch.
    await expect(
      as.mutation(api.rooms.create, { branchId, roomTypeId, number: "101" }),
    ).rejects.toThrow(/already exists in this branch/);

    // Status transition is audited.
    await as.mutation(api.rooms.setStatus, { roomId, status: "maintenance" });
    expect((await as.query(api.rooms.list, {}))[0].status).toBe("maintenance");

    // Can't delete a room type still in use.
    await expect(
      as.mutation(api.roomTypes.remove, { roomTypeId }),
    ).rejects.toThrow(/rooms still use/);
  });

  it("blocks cross-org references and gates writes", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const a = await adminOrg(t, "A");
    const b = await adminOrg(t, "B");

    const propertyId = await a.as.mutation(api.property.create, {
      name: "P",
      checkInTime: "14:00",
      checkOutTime: "10:00",
      idRequired: true,
    });
    const branchA = await a.as.mutation(api.branches.create, {
      propertyId,
      name: "Main",
    });
    const typeA = await a.as.mutation(api.roomTypes.create, {
      name: "Std",
      capacity: 2,
    });

    // Org B cannot create a room in org A's branch/type.
    await expect(
      b.as.mutation(api.rooms.create, {
        branchId: branchA,
        roomTypeId: typeA,
        number: "1",
      }),
    ).rejects.toThrow(/not found in this organization/);

    // A Receptionist (no Rooms:manage) is denied.
    const staffer = await t.mutation(internal.identity.upsertFromHandoff, {
      org: { bytebazaarOrgId: "bb_org_A", name: "Org A", slug: "A" },
      user: { bytebazaarUserId: "bb_staff", name: "Sam", role: "driver" },
    });
    await expect(
      t.withIdentity({ subject: staffer.userId }).mutation(api.amenities.create, {
        name: "X",
      }),
    ).rejects.toThrow(/Rooms:manage|FORBIDDEN/);
  });
});
