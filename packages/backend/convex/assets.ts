import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requirePermission } from "./lib/auth";
import { postLedgerEntry } from "./lib/ledger";
import { raiseEscalation } from "./lib/escalate";

/**
 * Per-room asset registry + checkout verification (Story 7.7, FR29/FR54).
 * Admins maintain each room's asset list; at checkout the caretaker verifies
 * every asset present/missing/damaged. Discrepancies create damage issues
 * (Story 7.6 records), raise escalations, and can post a damage charge to the
 * booking ledger in one step.
 */

export const listByRoom = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    const { orgId } = await requirePermission(ctx, "Assets", "read");
    const room = await ctx.db.get(roomId);
    if (!room || room.orgId !== orgId) return [];
    const assets = await ctx.db
      .query("roomAssets")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();
    return assets.map((a) => ({ assetId: a._id, name: a.name }));
  },
});

export const add = mutation({
  args: { roomId: v.id("rooms"), name: v.string() },
  handler: async (ctx, { roomId, name }) => {
    const { user, orgId } = await requirePermission(ctx, "Assets", "manage");
    const room = await ctx.db.get(roomId);
    if (!room || room.orgId !== orgId) throw new Error("Room not found.");
    if (!name.trim()) throw new Error("Asset name is required.");
    const assetId = await ctx.db.insert("roomAssets", {
      orgId,
      roomId,
      name: name.trim(),
    });
    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: user._id,
      action: "assets.add",
      entityType: "roomAsset",
      entityId: assetId,
      after: { roomId, name: name.trim() },
    });
    return { assetId };
  },
});

export const remove = mutation({
  args: { assetId: v.id("roomAssets") },
  handler: async (ctx, { assetId }) => {
    const { user, orgId } = await requirePermission(ctx, "Assets", "manage");
    const asset = await ctx.db.get(assetId);
    if (!asset || asset.orgId !== orgId) throw new Error("Asset not found.");
    await ctx.db.delete(assetId);
    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: user._id,
      action: "assets.remove",
      entityType: "roomAsset",
      entityId: assetId,
      before: { roomId: asset.roomId, name: asset.name },
    });
    return { ok: true };
  },
});

/**
 * Checkout asset verification: one result per asset. Missing/damaged assets
 * create a damage maintenanceIssue + escalation; an optional chargeCents per
 * discrepancy posts to the booking ledger (must run BEFORE checkout so the
 * charge lands in the balance gate).
 */
export const verifyCheckout = mutation({
  args: {
    bookingId: v.id("bookings"),
    results: v.array(
      v.object({
        assetId: v.id("roomAssets"),
        condition: v.union(
          v.literal("present"),
          v.literal("missing"),
          v.literal("damaged"),
        ),
        chargeCents: v.optional(v.int64()),
        notes: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, { bookingId, results }) => {
    const { user, orgId } = await requirePermission(ctx, "Assets", "write");
    const booking = await ctx.db.get(bookingId);
    if (!booking || booking.orgId !== orgId) throw new Error("Booking not found.");

    let discrepancies = 0;
    let chargedCents = 0n;
    for (const r of results) {
      const asset = await ctx.db.get(r.assetId);
      if (!asset || asset.orgId !== orgId || asset.roomId !== booking.roomId) {
        throw new Error("Asset does not belong to this booking's room.");
      }
      if (r.condition === "present") continue;
      discrepancies++;
      const description =
        `${asset.name} ${r.condition} at checkout (${booking.reference})` +
        (r.notes ? ` — ${r.notes}` : "");
      const issueId = await ctx.db.insert("maintenanceIssues", {
        orgId,
        roomId: booking.roomId,
        bookingId,
        kind: "damage",
        description,
        status: "open",
        chargeCents: r.chargeCents,
        reportedBy: user._id,
      });
      await raiseEscalation(ctx, {
        orgId,
        trigger: r.condition === "missing" ? "missing_asset" : "damaged_asset",
        message: description,
        entityType: "maintenanceIssue",
        entityId: issueId,
      });
      if (r.chargeCents) {
        if (r.chargeCents <= 0n) throw new Error("Asset charge must be positive.");
        await postLedgerEntry(ctx, {
          orgId,
          bookingId,
          type: "adjustment",
          amountCents: r.chargeCents,
          currency: booking.currency,
          memo: `Asset ${r.condition}: ${asset.name}`,
        });
        chargedCents += r.chargeCents;
      }
    }
    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: user._id,
      action: "assets.verify_checkout",
      entityType: "booking",
      entityId: bookingId,
      after: { verified: results.length, discrepancies, chargedCents },
    });
    return { verified: results.length, discrepancies, chargedCents };
  },
});
