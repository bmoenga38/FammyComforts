"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@fammycomforts/backend/convex/_generated/api";
import type { Id } from "@fammycomforts/backend/convex/_generated/dataModel";
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
  Modal,
  ConfirmDialog,
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
type Tab = "property" | "roomTypes" | "rooms" | "rates" | "notifications" | "assets";

const TABS: { id: Tab; label: string }[] = [
  { id: "property", label: "Property & Branches" },
  { id: "roomTypes", label: "Room types" },
  { id: "rooms", label: "Rooms" },
  { id: "rates", label: "Rates & Tax" },
  { id: "notifications", label: "Notifications" },
  { id: "assets", label: "Assets & Checklists" },
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
      {tab === "assets" && (
        <AssetsSection
          canManageAssets={can("Assets", "manage")}
          canManageChecklists={can("Housekeeping", "manage")}
        />
      )}
    </div>
  );
}

// ---------- Epic 7 (7.4 + 7.7): room assets & cleaning checklist templates ----------
function AssetsSection({
  canManageAssets,
  canManageChecklists,
}: {
  canManageAssets: boolean;
  canManageChecklists: boolean;
}) {
  const rooms = useQuery(api.rooms.list, {});
  const roomTypes = useQuery(api.roomTypes.list);
  const templates = useQuery(api.housekeeping.getTemplates);
  const addAsset = useMutation(api.assets.add);
  const removeAsset = useMutation(api.assets.remove);
  const setTemplate = useMutation(api.housekeeping.setTemplate);

  const [roomId, setRoomId] = useState("");
  const [assetName, setAssetName] = useState("");
  const assets = useQuery(
    api.assets.listByRoom,
    roomId ? { roomId: roomId as Parameters<typeof addAsset>[0]["roomId"] } : "skip",
  );
  const [tplRoomType, setTplRoomType] = useState("");
  const [tplItems, setTplItems] = useState("");

  const currentTpl = templates?.find((t) => (t.roomTypeId ?? "") === tplRoomType);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardContent className="space-y-3">
          <h2 className="font-semibold">Room assets (verified at checkout)</h2>
          <select
            aria-label="Room"
            className="rounded-ctrl border border-border bg-bg-input px-2 py-2"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
          >
            <option value="">Select a room…</option>
            {rooms?.map((r) => (
              <option key={r._id} value={r._id}>
                Rm {r.number}
              </option>
            ))}
          </select>
          {roomId && (
            <>
              <ul className="space-y-1.5">
                {assets?.length === 0 && (
                  <li className="text-sm text-fg-muted">No assets registered for this room.</li>
                )}
                {assets?.map((a) => (
                  <li key={a.assetId} className="flex items-center justify-between gap-2">
                    <span>{a.name}</span>
                    {canManageAssets && (
                      <Button size="sm" variant="ghost" onClick={() => removeAsset({ assetId: a.assetId })}>
                        Remove
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
              {canManageAssets && (
                <form
                  className="flex gap-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!assetName.trim()) return;
                    await addAsset({
                      roomId: roomId as Parameters<typeof addAsset>[0]["roomId"],
                      name: assetName,
                    });
                    setAssetName("");
                  }}
                >
                  <Input
                    aria-label="Asset name"
                    placeholder="e.g. Smart TV, Kettle, Iron box"
                    value={assetName}
                    onChange={(e) => setAssetName(e.target.value)}
                  />
                  <Button type="submit" disabled={!assetName.trim()}>
                    Add
                  </Button>
                </form>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3">
          <h2 className="font-semibold">Cleaning checklist templates</h2>
          <p className="text-sm text-fg-muted">
            Snapshotted onto a task when work starts. One template per room type, plus a default.
          </p>
          <select
            aria-label="Template room type"
            className="rounded-ctrl border border-border bg-bg-input px-2 py-2"
            value={tplRoomType}
            onChange={(e) => setTplRoomType(e.target.value)}
          >
            <option value="">All room types (default)</option>
            {roomTypes?.map((rt) => (
              <option key={rt._id} value={rt._id}>
                {rt.name}
              </option>
            ))}
          </select>
          {currentTpl && (
            <ul className="list-inside list-disc text-sm">
              {currentTpl.items.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          )}
          {canManageChecklists && (
            <form
              className="space-y-2"
              onSubmit={async (e) => {
                e.preventDefault();
                await setTemplate({
                  roomTypeId: (tplRoomType || undefined) as Parameters<
                    typeof setTemplate
                  >[0]["roomTypeId"],
                  items: tplItems.split("\n").map((s) => s.trim()).filter(Boolean),
                });
                setTplItems("");
              }}
            >
              <textarea
                aria-label="Checklist items, one per line"
                placeholder={"One item per line, e.g.\nStrip & remake bed\nClean bathroom\nRestock amenities"}
                className="min-h-24 w-full rounded-ctrl border border-border bg-bg-input p-2 text-sm"
                value={tplItems}
                onChange={(e) => setTplItems(e.target.value)}
              />
              <Button type="submit" disabled={!tplItems.trim()}>
                Save template
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
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

type RoomRow = FunctionReturnType<typeof api.rooms.list>[number];
type RoomTypeRow = FunctionReturnType<typeof api.roomTypes.list>[number];

/** Edit/Update a room — specs, status, cover image, and description. */
function EditRoomModal({
  room,
  types,
  onClose,
}: {
  room: RoomRow;
  types: RoomTypeRow[];
  onClose: () => void;
}) {
  const update = useMutation(api.rooms.update);
  const remove = useMutation(api.rooms.remove);
  const genUploadUrl = useMutation(api.rooms.generateUploadUrl);
  const [number, setNumber] = useState(room.number);
  const [floor, setFloor] = useState(room.floor ?? "");
  const [roomTypeId, setRoomTypeId] = useState<string>(room.roomTypeId);
  const [status, setStatus] = useState<RoomStatus>(room.status as RoomStatus);
  const [imageUrl, setImageUrl] = useState(room.imageUrl ?? "");
  const [description, setDescription] = useState(room.description ?? "");
  // Gallery: {storageId, url}. First = cover shown to guests. Seeded from the
  // room's saved gallery (ids + resolved urls, zipped by position).
  const [gallery, setGallery] = useState<{ storageId: string; url: string }[]>(
    (room.imageStorageIds ?? []).map((sid, i) => ({
      storageId: sid as string,
      url: room.images?.[i] ?? "",
    })),
  );
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    setError(null);
    try {
      const added: { storageId: string; url: string }[] = [];
      for (const file of Array.from(files)) {
        const uploadUrl = await genUploadUrl({});
        const res = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!res.ok) throw new Error("Upload failed — please retry.");
        const { storageId } = (await res.json()) as { storageId: string };
        added.push({ storageId, url: URL.createObjectURL(file) });
      }
      setGallery((g) => [...g, ...added]);
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setError(null);
    setSaving(true);
    try {
      await update({
        roomId: room._id,
        number,
        floor: floor.trim() || undefined,
        roomTypeId: roomTypeId as RoomTypeRow["_id"],
        status,
        imageUrl: imageUrl.trim() || undefined,
        description: description.trim() || undefined,
        imageStorageIds: gallery.map((g) => g.storageId) as Id<"_storage">[],
      });
      onClose();
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Edit room ${room.number}`}
      footer={
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            onClick={() => setConfirmDelete(true)}
            className="!text-danger hover:!border-danger"
          >
            Delete room
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-3 text-sm">
        {/* Photo gallery — upload multiple; the first is the cover guests see. */}
        <div className="space-y-2">
          <span className="text-text-muted">
            Photos <span className="opacity-70">(first is the cover shown to guests)</span>
          </span>
          {gallery.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {gallery.map((img, i) => (
                <div
                  key={img.storageId}
                  className="group relative aspect-video overflow-hidden rounded-lg border border-border"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt="" className="h-full w-full object-cover" />
                  {i === 0 && (
                    <span className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold text-on-primary">
                      Cover
                    </span>
                  )}
                  <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-black/55 px-1.5 py-1 opacity-0 transition group-hover:opacity-100">
                    {i !== 0 && (
                      <button
                        type="button"
                        className="text-[10px] font-medium text-white hover:underline"
                        onClick={() =>
                          setGallery((g) => [img, ...g.filter((x) => x.storageId !== img.storageId)])
                        }
                      >
                        Make cover
                      </button>
                    )}
                    <button
                      type="button"
                      className="ml-auto text-[10px] font-medium text-white hover:underline"
                      onClick={() =>
                        setGallery((g) => g.filter((x) => x.storageId !== img.storageId))
                      }
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border py-3 text-text-muted transition-colors hover:border-primary hover:text-primary">
            {uploading ? "Uploading…" : "＋ Upload photos"}
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              disabled={uploading}
              onChange={(e) => onFiles(e.target.files)}
            />
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-text-muted">Room number</span>
            <Input value={number} onChange={(e) => setNumber(e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="text-text-muted">Floor</span>
            <Input value={floor} onChange={(e) => setFloor(e.target.value)} placeholder="e.g. 2" />
          </label>
          <label className="space-y-1">
            <span className="text-text-muted">Room type</span>
            <select
              className="w-full rounded-lg border border-border bg-bg-input px-2 py-2"
              value={roomTypeId}
              onChange={(e) => setRoomTypeId(e.target.value)}
            >
              {types.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-text-muted">Status</span>
            <select
              className="w-full rounded-lg border border-border bg-bg-input px-2 py-2"
              value={status}
              onChange={(e) => setStatus(e.target.value as RoomStatus)}
            >
              {ROOM_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block space-y-1">
          <span className="text-text-muted">Image URL</span>
          <Input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://…"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-text-muted">Description</span>
          <textarea
            className="w-full rounded-lg border border-border bg-bg-input px-3 py-2"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Room highlights, view, amenities…"
          />
        </label>
        {error && <p className="text-danger">{error}</p>}
      </div>
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          remove({ roomId: room._id })
            .then(onClose)
            .catch((e) => setError(String((e as Error).message ?? e)));
          setConfirmDelete(false);
        }}
        title={`Delete room ${room.number}?`}
        message="This removes the room so it can no longer be booked. Past booking history is kept."
        confirmLabel="Delete room"
        danger
      />
    </Modal>
  );
}

function RoomsSection({ canManage }: { canManage: boolean }) {
  const rooms = useQuery(api.rooms.list, {});
  const branches = useQuery(api.branches.list, {});
  const types = useQuery(api.roomTypes.list);
  const createRoom = useMutation(api.rooms.create);
  const [editing, setEditing] = useState<RoomRow | null>(null);

  const [number, setNumber] = useState("");
  const [branchId, setBranchId] = useState("");
  const [roomTypeId, setRoomTypeId] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (rooms === undefined || branches === undefined || types === undefined) {
    return <p className="text-sm text-fg-muted">Loading…</p>;
  }

  return (
    <>
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
                      <Button variant="ghost" onClick={() => setEditing(r)}>
                        Edit
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
              className="w-full sm:w-32"
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
      {editing && (
        <EditRoomModal room={editing} types={types} onClose={() => setEditing(null)} />
      )}
    </>
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
                className="w-full sm:w-40"
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
                className="w-full sm:w-32"
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
                className="w-full sm:w-32"
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
