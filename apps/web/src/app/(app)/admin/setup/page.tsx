"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@fammycomforts/backend/convex/_generated/api";
import { usePermissions } from "@/lib/use-permissions";
import { kesToCents, formatKes } from "@/lib/money";
import {
  Button,
  Card,
  CardContent,
  Input,
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
  StatusChip,
  EmptyState,
} from "@/components/ui";

/**
 * Property setup (Epic 3 web batch — Stories 3.1–3.5): Property & Branches,
 * Room types & Amenities, Rooms, Rates & Tax, Notification settings.
 *
 * Reads are open to any authenticated org member (see the read-gating policy in
 * packages/backend/convex/lib/auth.ts), so every tab renders; edit affordances
 * are gated by the caller's `:manage` permission per area — the server enforces
 * the same checks authoritatively.
 */
type Tab = "property" | "roomTypes" | "rooms" | "rates" | "notifications";

const TABS: { id: Tab; label: string }[] = [
  { id: "property", label: "Property & Branches" },
  { id: "roomTypes", label: "Room types" },
  { id: "rooms", label: "Rooms" },
  { id: "rates", label: "Rates & Tax" },
  { id: "notifications", label: "Notifications" },
];

export default function SetupAdminPage() {
  const { can, isLoading } = usePermissions();
  const [tab, setTab] = useState<Tab>("property");

  if (isLoading) return <p className="p-6 text-sm text-fg-muted">Loading…</p>;

  return (
    <div className="space-y-4 p-4 md:p-6">
      <h1 className="text-xl font-semibold">Property setup</h1>
      <div role="tablist" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            variant={tab === t.id ? "primary" : "ghost"}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {tab === "property" && <PropertySection canManage={can("Settings", "manage")} />}
      {tab === "roomTypes" && <RoomTypesSection canManage={can("Rooms", "manage")} />}
      {tab === "rooms" && <RoomsSection canManage={can("Rooms", "manage")} />}
      {tab === "rates" && <RatesSection canManage={can("Settings", "manage")} />}
      {tab === "notifications" && (
        <NotificationsSection canManage={can("Notifications", "manage")} />
      )}
    </div>
  );
}

// ---------- 3.1 Property & Branches ----------
function PropertySection({ canManage }: { canManage: boolean }) {
  const properties = useQuery(api.property.list);
  const branches = useQuery(api.branches.list, {});
  const createProperty = useMutation(api.property.create);
  const updateProperty = useMutation(api.property.update);
  const createBranch = useMutation(api.branches.create);
  const removeBranch = useMutation(api.branches.remove);

  const [name, setName] = useState("");
  const [checkInTime, setCheckInTime] = useState("14:00");
  const [checkOutTime, setCheckOutTime] = useState("10:00");
  const [idRequired, setIdRequired] = useState(true);
  const [branchName, setBranchName] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (properties === undefined || branches === undefined) {
    return <p className="text-sm text-fg-muted">Loading…</p>;
  }
  const property = properties[0]; // first property is primary for now

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardContent className="space-y-3">
          <h2 className="font-medium">Property</h2>
          {property ? (
            <div className="space-y-2 text-sm">
              <div className="font-medium">{property.name}</div>
              <div className="text-fg-muted">
                Check-in {property.checkInTime} · Check-out {property.checkOutTime} ·{" "}
                ID {property.idRequired ? "required" : "optional"}
              </div>
              {canManage && (
                <div className="flex gap-2">
                  <Input
                    aria-label="Check-in time"
                    value={checkInTime}
                    onChange={(e) => setCheckInTime(e.target.value)}
                    className="w-24"
                  />
                  <Input
                    aria-label="Check-out time"
                    value={checkOutTime}
                    onChange={(e) => setCheckOutTime(e.target.value)}
                    className="w-24"
                  />
                  <Button
                    onClick={() =>
                      updateProperty({
                        propertyId: property._id,
                        checkInTime,
                        checkOutTime,
                      }).catch((e) => setError(String(e.message ?? e)))
                    }
                  >
                    Save times
                  </Button>
                </div>
              )}
            </div>
          ) : canManage ? (
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                setError(null);
                createProperty({ name, checkInTime, checkOutTime, idRequired }).catch(
                  (e) => setError(String(e.message ?? e)),
                );
              }}
            >
              <Input
                aria-label="Property name"
                placeholder="Property name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <div className="flex gap-2">
                <Input
                  aria-label="Check-in time"
                  value={checkInTime}
                  onChange={(e) => setCheckInTime(e.target.value)}
                  className="w-24"
                />
                <Input
                  aria-label="Check-out time"
                  value={checkOutTime}
                  onChange={(e) => setCheckOutTime(e.target.value)}
                  className="w-24"
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={idRequired}
                  onChange={(e) => setIdRequired(e.target.checked)}
                />
                Guest ID required
              </label>
              <Button type="submit">Create property</Button>
            </form>
          ) : (
            <EmptyState title="No property" description="An admin sets this up." />
          )}
          {error && <p className="text-sm text-danger">{error}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3">
          <h2 className="font-medium">Branches</h2>
          {branches.length === 0 ? (
            <p className="text-sm text-fg-muted">No branches yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {branches.map((b) => (
                <li key={b._id} className="flex items-center justify-between">
                  <span>
                    {b.name}
                    {b.location ? ` · ${b.location}` : ""}
                  </span>
                  {canManage && (
                    <Button variant="ghost" onClick={() => removeBranch({ branchId: b._id })}>
                      Remove
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {canManage && property && (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!branchName) return;
                createBranch({ propertyId: property._id, name: branchName });
                setBranchName("");
              }}
            >
              <Input
                aria-label="Branch name"
                placeholder="New branch name"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
              />
              <Button type="submit">Add</Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------- 3.2 Room types & Amenities ----------
function RoomTypesSection({ canManage }: { canManage: boolean }) {
  const types = useQuery(api.roomTypes.list);
  const amenities = useQuery(api.amenities.list);
  const createType = useMutation(api.roomTypes.create);
  const removeType = useMutation(api.roomTypes.remove);
  const createAmenity = useMutation(api.amenities.create);
  const removeAmenity = useMutation(api.amenities.remove);

  const [typeName, setTypeName] = useState("");
  const [capacity, setCapacity] = useState("2");
  const [amenityName, setAmenityName] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (types === undefined || amenities === undefined) {
    return <p className="text-sm text-fg-muted">Loading…</p>;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardContent className="space-y-3">
          <h2 className="font-medium">Room types</h2>
          {types.length === 0 ? (
            <p className="text-sm text-fg-muted">No room types yet.</p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Name</TH>
                  <TH>Capacity</TH>
                  <TH>Amenities</TH>
                  {canManage && <TH>Actions</TH>}
                </TR>
              </THead>
              <TBody>
                {types.map((t) => (
                  <TR key={t._id}>
                    <TD>{t.name}</TD>
                    <TD>{t.capacity}</TD>
                    <TD className="text-xs text-fg-muted">{t.amenities.join(", ") || "—"}</TD>
                    {canManage && (
                      <TD>
                        <Button
                          variant="ghost"
                          onClick={() =>
                            removeType({ roomTypeId: t._id }).catch((e) =>
                              setError(String(e.message ?? e)),
                            )
                          }
                        >
                          Remove
                        </Button>
                      </TD>
                    )}
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
          {canManage && (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                setError(null);
                createType({ name: typeName, capacity: Number(capacity) }).catch((e) =>
                  setError(String(e.message ?? e)),
                );
                setTypeName("");
              }}
            >
              <Input
                aria-label="Room type name"
                placeholder="e.g. Deluxe"
                value={typeName}
                onChange={(e) => setTypeName(e.target.value)}
                required
              />
              <Input
                aria-label="Capacity"
                type="number"
                min={1}
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                className="w-20"
              />
              <Button type="submit">Add type</Button>
            </form>
          )}
          {error && <p className="text-sm text-danger">{error}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3">
          <h2 className="font-medium">Amenities</h2>
          <div className="flex flex-wrap gap-2">
            {amenities.map((a) => (
              <span
                key={a._id}
                className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-sm"
              >
                {a.name}
                {canManage && (
                  <button
                    aria-label={`Remove ${a.name}`}
                    className="text-fg-muted hover:text-fg"
                    onClick={() => removeAmenity({ amenityId: a._id })}
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
            {amenities.length === 0 && (
              <p className="text-sm text-fg-muted">No amenities yet.</p>
            )}
          </div>
          {canManage && (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!amenityName) return;
                createAmenity({ name: amenityName }).catch((e) =>
                  setError(String(e.message ?? e)),
                );
                setAmenityName("");
              }}
            >
              <Input
                aria-label="Amenity name"
                placeholder="e.g. Wi-Fi"
                value={amenityName}
                onChange={(e) => setAmenityName(e.target.value)}
              />
              <Button type="submit">Add</Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------- 3.3 Rooms ----------
const ROOM_STATUSES = [
  "available",
  "occupied",
  "dirty",
  "cleaning",
  "maintenance",
  "blocked",
] as const;
type RoomStatus = (typeof ROOM_STATUSES)[number];

const STATUS_CHIP: Record<RoomStatus, "success" | "info" | "warning" | "danger"> = {
  available: "success",
  occupied: "info",
  dirty: "warning",
  cleaning: "info",
  maintenance: "warning",
  blocked: "danger",
};

function RoomsSection({ canManage }: { canManage: boolean }) {
  const rooms = useQuery(api.rooms.list, {});
  const branches = useQuery(api.branches.list, {});
  const types = useQuery(api.roomTypes.list);
  const createRoom = useMutation(api.rooms.create);
  const setStatus = useMutation(api.rooms.setStatus);
  const removeRoom = useMutation(api.rooms.remove);

  const [number, setNumber] = useState("");
  const [branchId, setBranchId] = useState("");
  const [roomTypeId, setRoomTypeId] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (rooms === undefined || branches === undefined || types === undefined) {
    return <p className="text-sm text-fg-muted">Loading…</p>;
  }

  return (
    <Card>
      <CardContent className="space-y-3">
        {rooms.length === 0 ? (
          <EmptyState
            title="No rooms"
            description="Add rooms once a branch and room type exist."
          />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Room</TH>
                <TH>Branch</TH>
                <TH>Type</TH>
                <TH>Status</TH>
                {canManage && <TH>Actions</TH>}
              </TR>
            </THead>
            <TBody>
              {rooms.map((r) => (
                <TR key={r._id}>
                  <TD className="font-medium">{r.number}</TD>
                  <TD>{r.branchName ?? "—"}</TD>
                  <TD>{r.roomTypeName ?? "—"}</TD>
                  <TD>
                    <StatusChip status={STATUS_CHIP[r.status as RoomStatus]}>
                      {r.status}
                    </StatusChip>
                  </TD>
                  {canManage && (
                    <TD>
                      <div className="flex items-center gap-2">
                        <select
                          aria-label={`Status of room ${r.number}`}
                          className="rounded-lg border border-border bg-bg-input px-2 py-1 text-sm"
                          value={r.status}
                          onChange={(e) =>
                            setStatus({
                              roomId: r._id,
                              status: e.target.value as RoomStatus,
                            })
                          }
                        >
                          {ROOM_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                        <Button variant="ghost" onClick={() => removeRoom({ roomId: r._id })}>
                          Remove
                        </Button>
                      </div>
                    </TD>
                  )}
                </TR>
              ))}
            </TBody>
          </Table>
        )}

        {canManage && (
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              if (!branchId || !roomTypeId || !number) return;
              createRoom({
                branchId: branchId as never,
                roomTypeId: roomTypeId as never,
                number,
              }).catch((err) => setError(String(err.message ?? err)));
              setNumber("");
            }}
          >
            <Input
              aria-label="Room number"
              placeholder="Room number"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              className="w-32"
            />
            <select
              aria-label="Branch"
              className="rounded-lg border border-border bg-bg-input px-2 py-2 text-sm"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
            >
              <option value="">Branch…</option>
              {branches.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Room type"
              className="rounded-lg border border-border bg-bg-input px-2 py-2 text-sm"
              value={roomTypeId}
              onChange={(e) => setRoomTypeId(e.target.value)}
            >
              <option value="">Type…</option>
              {types.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name}
                </option>
              ))}
            </select>
            <Button type="submit">Add room</Button>
          </form>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
      </CardContent>
    </Card>
  );
}

// ---------- 3.4 Rates & Tax ----------
function RatesSection({ canManage }: { canManage: boolean }) {
  const plans = useQuery(api.rates.listRatePlans, {});
  const taxes = useQuery(api.rates.listTaxRules);
  const types = useQuery(api.roomTypes.list);
  const createPlan = useMutation(api.rates.createRatePlan);
  const updatePlan = useMutation(api.rates.updateRatePlan);
  const createTax = useMutation(api.rates.createTaxRule);

  const [planName, setPlanName] = useState("");
  const [nightly, setNightly] = useState("");
  const [planTypeId, setPlanTypeId] = useState("");
  const [taxName, setTaxName] = useState("VAT");
  const [taxPct, setTaxPct] = useState("16");
  const [error, setError] = useState<string | null>(null);

  if (plans === undefined || taxes === undefined || types === undefined) {
    return <p className="text-sm text-fg-muted">Loading…</p>;
  }
  const typeName = (id: string) => types.find((t) => t._id === id)?.name ?? "—";

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardContent className="space-y-3">
          <h2 className="font-medium">Rate plans</h2>
          {plans.length === 0 ? (
            <p className="text-sm text-fg-muted">No rate plans yet.</p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Plan</TH>
                  <TH>Room type</TH>
                  <TH>Nightly</TH>
                  <TH>Active</TH>
                </TR>
              </THead>
              <TBody>
                {plans.map((p) => (
                  <TR key={p._id}>
                    <TD>{p.name}</TD>
                    <TD>{typeName(p.roomTypeId)}</TD>
                    <TD>{formatKes(p.nightlyCents)}/night</TD>
                    <TD>
                      {canManage ? (
                        <input
                          type="checkbox"
                          aria-label={`${p.name} active`}
                          checked={p.active}
                          onChange={(e) =>
                            updatePlan({ ratePlanId: p._id, active: e.target.checked })
                          }
                        />
                      ) : p.active ? (
                        "Yes"
                      ) : (
                        "No"
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
          {canManage && (
            <form
              className="flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                setError(null);
                try {
                  if (!planTypeId) throw new Error("Pick a room type.");
                  createPlan({
                    roomTypeId: planTypeId as never,
                    name: planName,
                    nightlyCents: kesToCents(nightly),
                  }).catch((err) => setError(String(err.message ?? err)));
                  setPlanName("");
                  setNightly("");
                } catch (err) {
                  setError(String((err as Error).message ?? err));
                }
              }}
            >
              <Input
                aria-label="Plan name"
                placeholder="Plan name"
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
                required
                className="w-40"
              />
              <select
                aria-label="Plan room type"
                className="rounded-lg border border-border bg-bg-input px-2 py-2 text-sm"
                value={planTypeId}
                onChange={(e) => setPlanTypeId(e.target.value)}
              >
                <option value="">Type…</option>
                {types.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <Input
                aria-label="Nightly rate (KES)"
                placeholder="KES / night"
                value={nightly}
                onChange={(e) => setNightly(e.target.value)}
                className="w-32"
              />
              <Button type="submit">Add plan</Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3">
          <h2 className="font-medium">Tax rules</h2>
          {taxes.length === 0 ? (
            <p className="text-sm text-fg-muted">No tax rules yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {taxes.map((t) => (
                <li key={t._id}>
                  {t.name}: {(t.rate * 100).toFixed(2).replace(/\.00$/, "")}%{" "}
                  {t.active ? "" : "(inactive)"}
                </li>
              ))}
            </ul>
          )}
          {canManage && (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                setError(null);
                createTax({ name: taxName, rate: Number(taxPct) / 100 }).catch((err) =>
                  setError(String(err.message ?? err)),
                );
              }}
            >
              <Input
                aria-label="Tax name"
                value={taxName}
                onChange={(e) => setTaxName(e.target.value)}
                className="w-32"
              />
              <Input
                aria-label="Tax percent"
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={taxPct}
                onChange={(e) => setTaxPct(e.target.value)}
                className="w-24"
              />
              <Button type="submit">Add tax</Button>
            </form>
          )}
          {error && <p className="text-sm text-danger">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------- 3.5 Notifications ----------
const NOTIFICATION_TYPES = [
  "booking_confirmation",
  "check_in_reminder",
  "check_out_reminder",
  "payment_receipt",
  "staff_alert",
] as const;
const CHANNELS = ["email", "sms", "whatsapp", "push"] as const;

function NotificationsSection({ canManage }: { canManage: boolean }) {
  const settings = useQuery(api.notifications.list);
  const setEnabled = useMutation(api.notifications.setEnabled);

  if (settings === undefined) {
    return <p className="text-sm text-fg-muted">Loading…</p>;
  }
  const isOn = (type: string, channel: string) =>
    settings.find((s) => s.type === type && s.channel === channel)?.enabled ?? false;

  return (
    <Card>
      <CardContent>
        <Table>
          <THead>
            <TR>
              <TH>Notification</TH>
              {CHANNELS.map((c) => (
                <TH key={c}>{c}</TH>
              ))}
            </TR>
          </THead>
          <TBody>
            {NOTIFICATION_TYPES.map((type) => (
              <TR key={type}>
                <TD>{type.replaceAll("_", " ")}</TD>
                {CHANNELS.map((channel) => (
                  <TD key={channel}>
                    <input
                      type="checkbox"
                      aria-label={`${type} via ${channel}`}
                      checked={isOn(type, channel)}
                      disabled={!canManage}
                      onChange={(e) =>
                        setEnabled({ type, channel, enabled: e.target.checked })
                      }
                    />
                  </TD>
                ))}
              </TR>
            ))}
          </TBody>
        </Table>
      </CardContent>
    </Card>
  );
}
