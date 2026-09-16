// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  humanizeToken,
  humanizeAction,
  ENTITY_TABLES,
  documentLabel,
  shortId,
  entityPhrase,
  describeChanges,
} from "./auditFormat";

/**
 * These helpers exist because the admin audit table printed raw rows:
 *
 *     roomType.create    roomType · n572z146…    ks7c4ac8
 *
 * Nobody can audit anything from that. The tests below pin the readable output,
 * and — more importantly — pin the edge cases that would put a crash or a blank
 * cell in front of an admin: a deleted subject, a 1000-character guest request, a
 * `bigint` money column, a field that is legitimately `0`.
 */

describe("humanizeToken", () => {
  it("splits camelCase and underscores into one sentence-cased phrase", () => {
    expect(humanizeToken("roomType")).toBe("Room type");
    expect(humanizeToken("check_in")).toBe("Check in");
    expect(humanizeToken("paymentMethodSetting")).toBe("Payment method setting");
    expect(humanizeToken("room")).toBe("Room");
  });

  it("treats hyphens like underscores and collapses runs of separators", () => {
    expect(humanizeToken("front-desk")).toBe("Front desk");
    expect(humanizeToken("front__desk")).toBe("Front desk");
    expect(humanizeToken("  room   type  ")).toBe("Room type");
  });

  it("keeps digit boundaries readable without splitting the digits", () => {
    // The regex breaks on lower/digit → upper, so "room101" stays whole while
    // "room101Type" gains a space before the capital.
    expect(humanizeToken("room101")).toBe("Room101");
    expect(humanizeToken("room101Type")).toBe("Room101 type");
  });

  it("returns an empty string rather than throwing on empty-ish input", () => {
    // Callers use `humanizeToken(x) || x` precisely because of this branch.
    expect(humanizeToken("")).toBe("");
    expect(humanizeToken("_")).toBe("");
    expect(humanizeToken("   ")).toBe("");
  });
});

describe("humanizeAction", () => {
  it("renders the exact actions from the reported bug", () => {
    expect(humanizeAction("roomType.create")).toBe("Room type created");
    expect(humanizeAction("amenity.create")).toBe("Amenity created");
    expect(humanizeAction("rooms.update")).toBe("Rooms updated");
  });

  it("conjugates the multi-word verbs from VERB_PHRASES", () => {
    expect(humanizeAction("booking.check_in")).toBe("Booking checked in");
    expect(humanizeAction("booking.no_show")).toBe("Booking marked as a no-show");
    expect(humanizeAction("user.assign_role")).toBe("User role assigned");
    expect(humanizeAction("payment.stk_initiated")).toBe("Payment M-Pesa prompt sent");
    expect(humanizeAction("backupRun.prune")).toBe("Backup run pruned");
  });

  it("degrades to a readable phrase for a verb nobody mapped yet", () => {
    // The point of the fallback: a new action added in six months reads oddly
    // but never breaks the page, and never leaks the dotted machine string.
    expect(humanizeAction("invoice.void")).toBe("Invoice void");
    expect(humanizeAction("room.set_price")).toBe("Room set price");
    expect(humanizeAction("guest.merge_duplicate")).toBe("Guest merge duplicate");
  });

  it("handles actions with no verb and no dot", () => {
    expect(humanizeAction("login")).toBe("Login");
    expect(humanizeAction("room.")).toBe("Room");
    expect(humanizeAction("")).toBe("");
  });

  it("splits on the FIRST dot, so a dotted verb survives intact", () => {
    // `action.slice(dot + 1)` keeps the remainder whole; it is not a lookup key
    // in VERB_PHRASES so it falls through to humanizeToken.
    expect(humanizeAction("mpesa.callback.unmatched")).toBe("Mpesa callback.unmatched");
  });
});

describe("ENTITY_TABLES", () => {
  it("maps the irregular plurals English would get wrong", () => {
    // A naive `${entityType}s` would produce "amenitys", "propertys",
    // "branchs" — three tables that do not exist, so three missing labels.
    expect(ENTITY_TABLES.amenity).toBe("amenities");
    expect(ENTITY_TABLES.property).toBe("properties");
    expect(ENTITY_TABLES.branch).toBe("branches");
  });

  it("keeps camelCase table names camelCase", () => {
    expect(ENTITY_TABLES.roomType).toBe("roomTypes");
    expect(ENTITY_TABLES.purchaseOrder).toBe("purchaseOrders");
    expect(ENTITY_TABLES.notificationTemplate).toBe("notificationTemplates");
  });

  it("resolves an unmapped type to undefined, not to a bogus table", () => {
    // audit.ts branches on this: undefined means "no label", which the UI
    // renders as the deleted/short-id fallback rather than throwing.
    expect(ENTITY_TABLES.somethingNew).toBeUndefined();
  });

  it("is injective — no two entity types point at one table", () => {
    const values = Object.values(ENTITY_TABLES);
    expect(new Set(values).size).toBe(values.length);
  });

  it("holds no empty or whitespace-only table name", () => {
    for (const [key, table] of Object.entries(ENTITY_TABLES)) {
      expect(table.trim()).toBe(table);
      expect(table.length > 0).toBe(true);
      // Every mapping in this repo is the singular plus a suffix.
      expect(table.startsWith(key.slice(0, 3))).toBe(true);
    }
  });
});

describe("documentLabel", () => {
  it("prefers the earlier field in LABEL_FIELDS", () => {
    // `name` beats `description` so a supplier reads as its name, not its
    // address; `title` beats `status` so a task reads as what it is.
    expect(documentLabel({ name: "Closed Balcony", description: "Upper floor" })).toBe(
      "Closed Balcony",
    );
    expect(documentLabel({ title: "Deep clean", status: "pending" })).toBe("Deep clean");
    expect(documentLabel({ status: "pending" })).toBe("pending");
  });

  it("skips blank strings instead of returning an empty label", () => {
    // An empty label would make entityPhrase render `Room ""`.
    expect(documentLabel({ name: "   ", title: "Deep clean" })).toBe("Deep clean");
    expect(documentLabel({ name: "" })).toBe(null);
  });

  it("accepts a numeric field, which room numbers actually are", () => {
    expect(documentLabel({ number: 101 })).toBe("101");
    expect(documentLabel({ number: 0 })).toBe("0");
  });

  it("skips non-finite numbers", () => {
    expect(documentLabel({ number: NaN, title: "Deep clean" })).toBe("Deep clean");
    expect(documentLabel({ number: Infinity })).toBe(null);
  });

  it("collapses whitespace and clamps at 48 characters", () => {
    expect(documentLabel({ name: "Closed\n  Balcony   Suite" })).toBe("Closed Balcony Suite");

    const long = documentLabel({ message: "x".repeat(200) });
    expect(long).toHaveLength(48);
    expect(long).toMatch(/…$/);

    // Exactly at the limit is left alone — the clamp is `>`, not `>=`.
    expect(documentLabel({ name: "y".repeat(48) })).toHaveLength(48);
    expect(documentLabel({ name: "y".repeat(48) })).not.toContain("…");
  });

  it("returns null for a document that is missing or has nothing to name it", () => {
    // The missing case is a deleted subject; audit.ts passes the lookup result
    // straight through.
    expect(documentLabel(null)).toBe(null);
    expect(documentLabel({})).toBe(null);
    expect(documentLabel({ orgId: "o1", capacity: true })).toBe(null);
  });
});

describe("shortId", () => {
  it("truncates a Convex id to eight characters plus an ellipsis", () => {
    expect(shortId("n572z146abcdefgh")).toBe("n572z146…");
  });

  it("leaves anything ten characters or shorter alone", () => {
    expect(shortId("1234567890")).toBe("1234567890");
    expect(shortId("12345678901")).toBe("12345678…");
    expect(shortId("")).toBe("");
  });
});

describe("entityPhrase", () => {
  it("renders the readable phrase the audit table now shows", () => {
    expect(entityPhrase("roomType", "Closed Balcony", "n572z146abcdef")).toBe(
      'Room type "Closed Balcony"',
    );
    expect(entityPhrase("room", "101", "n572z146abcdef")).toBe('Room "101"');
  });

  it("still identifies a subject that has since been deleted", () => {
    // This is why the raw id stays in audit.list's return: without it this cell
    // goes blank and the row becomes unauditable.
    expect(entityPhrase("room", null, "n97drrth7q2xyz")).toBe("Room (deleted · n97drrth…)");
  });

  it("falls back to the bare noun when there is no label and no id", () => {
    expect(entityPhrase("room", null, undefined)).toBe("Room");
  });

  it("falls back to the raw entityType when it humanizes to nothing", () => {
    // `humanizeToken("_")` is "", and an empty noun would render `"Closed"` with
    // a leading space. The `|| entityType` guard covers it.
    expect(entityPhrase("_", null, undefined)).toBe("_");
    expect(entityPhrase("_", "Closed Balcony", undefined)).toBe('_ "Closed Balcony"');
  });
});

describe("describeChanges", () => {
  it("lists only the fields that actually differ", () => {
    expect(
      describeChanges(
        { number: "203", capacity: 2, name: "Deluxe" },
        { number: "101", capacity: 2, name: "Deluxe" },
      ),
    ).toEqual([{ field: "Number", from: "203", to: "101" }]);
  });

  it("drops ids and timestamps, which are scoping rather than decisions", () => {
    expect(
      describeChanges(
        { orgId: "o1", actorId: "u1", _id: "r1", _creationTime: 1, updatedAt: 1, createdAt: 1 },
        { orgId: "o2", actorId: "u2", _id: "r2", _creationTime: 2, updatedAt: 2, createdAt: 2 },
      ),
    ).toEqual([]);
  });

  it("returns fields in a stable alphabetical order", () => {
    // Object key order depends on insertion, so without the sort the same edit
    // renders differently between a create and a patch.
    const changes = describeChanges({}, { name: "n", capacity: 1, branchId: "b" });
    expect(changes.map((c) => c.field)).toEqual(["Branch id", "Capacity", "Name"]);
  });

  it("formats a …Cents field as money and strips the suffix from the label", () => {
    expect(describeChanges({ priceCents: 350000n }, { priceCents: 400050n })).toEqual([
      { field: "Price", from: "KES 3,500", to: "KES 4,000.50" },
    ]);
    expect(describeChanges({}, { amountPaidCents: 99n })).toEqual([
      { field: "Amount paid", from: null, to: "KES 0.99" },
    ]);
  });

  it("stringifies a non-money bigint instead of letting it reach the browser", () => {
    // A raw bigint in a query result is legal Convex but JSON.stringify throws
    // on it, which would blank the whole audit page rather than one cell.
    const changes = describeChanges({ capacity: 2n }, { capacity: 4n });
    expect(changes).toEqual([{ field: "Capacity", from: "2", to: "4" }]);
    expect(typeof changes[0]?.to).toBe("string");
  });

  it("accepts a float in a …Cents field by rounding to whole cents", () => {
    expect(describeChanges({}, { totalCents: 350050.4 })).toEqual([
      { field: "Total", from: null, to: "KES 3,500.50" },
    ]);
  });

  it("renders booleans as yes/no and arrays as a count", () => {
    expect(describeChanges({ isActive: true }, { isActive: false })).toEqual([
      { field: "Is active", from: "yes", to: "no" },
    ]);
    expect(describeChanges({ amenityIds: ["a"] }, { amenityIds: ["a", "b"] })).toEqual([
      { field: "Amenity ids", from: "1 item", to: "2 items" },
    ]);
    expect(describeChanges({ amenityIds: ["a"] }, { amenityIds: [] })).toEqual([
      { field: "Amenity ids", from: "1 item", to: "0 items" },
    ]);
  });

  it("summarises a nested object as clamped JSON", () => {
    expect(describeChanges({}, { meta: { source: "web" } })).toEqual([
      { field: "Meta", from: null, to: '{"source":"web"}' },
    ]);
  });

  it("clamps long strings at 80 characters, not the 48 used for labels", () => {
    const to = describeChanges({}, { notes: "x".repeat(200) })[0]?.to;
    expect(to).toHaveLength(80);
    expect(to).toMatch(/…$/);
  });

  it("shows a creation as null → value", () => {
    expect(describeChanges(undefined, { name: "Deluxe" })).toEqual([
      { field: "Name", from: null, to: "Deluxe" },
    ]);
  });

  it("shows a cleared field as value → null", () => {
    expect(describeChanges({ notes: "Broken lock" }, {})).toEqual([
      { field: "Notes", from: "Broken lock", to: null },
    ]);
    expect(describeChanges({ notes: "Broken lock" }, { notes: undefined })).toEqual([
      { field: "Notes", from: "Broken lock", to: null },
    ]);
  });

  it("distinguishes a field set to 0 or false from a field that is absent", () => {
    // `if (!value) return null` would be the easy bug here: capacity 0 and
    // isActive false are real, auditable decisions.
    expect(describeChanges({ capacity: 2 }, { capacity: 0 })).toEqual([
      { field: "Capacity", from: "2", to: "0" },
    ]);
    expect(describeChanges({ capacity: 0 }, { capacity: null })).toEqual([
      { field: "Capacity", from: "0", to: null },
    ]);
    expect(describeChanges({ isActive: false }, { isActive: null })).toEqual([
      { field: "Is active", from: "no", to: null },
    ]);
  });

  it("returns [] for payloads that are not plain objects", () => {
    // `before`/`after` are v.optional(v.any()) in the schema, so a row written
    // by an older build can hold anything at all.
    expect(describeChanges(undefined, undefined)).toEqual([]);
    expect(describeChanges(null, null)).toEqual([]);
    expect(describeChanges("was a string", 42)).toEqual([]);
    expect(describeChanges([1, 2], [3])).toEqual([]);
  });
});
