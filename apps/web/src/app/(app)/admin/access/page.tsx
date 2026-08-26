"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@fammycomforts/backend/convex/_generated/api";
import { usePermissions } from "@/lib/use-permissions";
import { PERMISSION_AREAS, ACTIONS } from "@/lib/permissions";
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
} from "@/components/ui";
import { reportError } from "@/lib/report-error";

/**
 * Access administration (Stories 2.3–2.5): Roles grid, Staff, and Audit log —
 * each section gated by the signed-in user's permissions (`usePermissions`).
 * The server enforces the same checks; gating only hides affordances.
 */
type Tab = "roles" | "staff" | "audit";

export default function AccessAdminPage() {
  const { can, isLoading } = usePermissions();
  const [tab, setTab] = useState<Tab>("roles");

  if (isLoading) {
    return <p className="p-6 text-sm text-fg-muted">Loading…</p>;
  }

  const tabs = [
    { id: "roles" as const, label: "Roles", show: can("Roles", "read") || can("Roles", "manage") },
    { id: "staff" as const, label: "Staff", show: can("Employees", "read") },
    { id: "audit" as const, label: "Audit log", show: can("Audit logs", "read") },
  ].filter((t) => t.show);

  if (tabs.length === 0) {
    return (
      <div className="p-6">
        <EmptyState title="No access" description="You don't have permission to manage access." />
      </div>
    );
  }

  const active = tabs.some((t) => t.id === tab) ? tab : tabs[0].id;

  return (
    <div className="space-y-4 p-4 md:p-6">
      <h1 className="text-xl font-semibold">Access</h1>
      <div role="tablist" className="flex gap-2">
        {tabs.map((t) => (
          <Button
            key={t.id}
            role="tab"
            aria-selected={active === t.id}
            variant={active === t.id ? "primary" : "ghost"}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {active === "roles" && <RolesSection canManage={can("Roles", "manage")} />}
      {active === "staff" && <StaffSection canManage={can("Employees", "manage")} />}
      {active === "audit" && <AuditSection />}
    </div>
  );
}

function RolesSection({ canManage }: { canManage: boolean }) {
  const roles = useQuery(api.roles.list);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = roles?.find((r) => r._id === selectedId) ?? roles?.[0];
  const detail = useQuery(
    api.roles.getWithPermissions,
    selected ? { roleId: selected._id } : "skip",
  );
  const setPermission = useMutation(api.roles.setPermission);
  const grants = new Set(detail?.grants ?? []);

  if (roles === undefined) return <p className="text-sm text-fg-muted">Loading roles…</p>;

  return (
    <div className="grid gap-4 md:grid-cols-[16rem_1fr]">
      <Card>
        <CardContent className="p-2">
          <ul className="space-y-1">
            {roles.map((r) => (
              <li key={r._id}>
                <button
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                    selected?._id === r._id ? "bg-bg-subtle font-medium" : "hover:bg-bg-subtle"
                  }`}
                  onClick={() => setSelectedId(r._id)}
                >
                  {r.name}
                </button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          {selected ? (
            <Table>
              <THead>
                <TR>
                  <TH>Area</TH>
                  {ACTIONS.map((a) => (
                    <TH key={a}>{a}</TH>
                  ))}
                </TR>
              </THead>
              <TBody>
                {PERMISSION_AREAS.map((area) => (
                  <TR key={area}>
                    <TD>{area}</TD>
                    {ACTIONS.map((action) => {
                      const checked = grants.has(`${area}:${action}`);
                      return (
                        <TD key={action}>
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={!canManage || detail === undefined}
                            aria-label={`${area} ${action}`}
                            onChange={(e) =>
                              setPermission({
                                roleId: selected._id,
                                area,
                                action,
                                granted: e.target.checked,
                              })
                            }
                          />
                        </TD>
                      );
                    })}
                  </TR>
                ))}
              </TBody>
            </Table>
          ) : (
            <EmptyState title="No roles" description="No roles in this organization yet." />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

type StaffRow = FunctionReturnType<typeof api.staff.list>[number];

/** Edit a staff member's name / phone / email. */
function EditStaffModal({ staff, onClose }: { staff: StaffRow; onClose: () => void }) {
  const update = useMutation(api.staff.update);
  const [name, setName] = useState(staff.name);
  const [phone, setPhone] = useState(staff.phone ?? "");
  const [email, setEmail] = useState(staff.email ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setError(null);
    setSaving(true);
    try {
      await update({ userId: staff._id, name, phone, email: email.trim() || undefined });
      onClose();
    } catch (e) {
      setError(reportError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Edit ${staff.name}`}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      }
    >
      <div className="space-y-3 text-sm">
        <label className="block space-y-1">
          <span className="text-fg-muted">Full name</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block space-y-1">
          <span className="text-fg-muted">Phone</span>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+254 7XX XXX XXX" />
        </label>
        <label className="block space-y-1">
          <span className="text-fg-muted">Email (optional)</span>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
          />
        </label>
        {error && <p className="text-danger">{error}</p>}
      </div>
    </Modal>
  );
}

function StaffSection({ canManage }: { canManage: boolean }) {
  const staff = useQuery(api.staff.list);
  const setActive = useMutation(api.staff.setActive);
  const [editing, setEditing] = useState<StaffRow | null>(null);

  if (staff === undefined) return <p className="text-sm text-fg-muted">Loading staff…</p>;

  return (
    <div className="space-y-4">
      {canManage && <AddStaffForm />}
      {staff.length === 0 ? (
        <EmptyState title="No staff" description="No staff in this organization yet." />
      ) : (
    <Card>
      <CardContent>
        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Roles</TH>
              <TH>Status</TH>
              {canManage && <TH>Actions</TH>}
            </TR>
          </THead>
          <TBody>
            {staff.map((s) => (
              <TR key={s._id}>
                <TD>
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-fg-muted">{s.email ?? s.ssoRole}</div>
                </TD>
                <TD>{s.roles.map((r) => r.name).join(", ") || "—"}</TD>
                <TD>
                  <StatusChip status={s.isActive ? "success" : "danger"}>
                    {s.isActive ? "Active" : "Inactive"}
                  </StatusChip>
                </TD>
                {canManage && (
                  <TD>
                    <div className="flex gap-2">
                      <Button variant="ghost" onClick={() => setEditing(s)}>
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => setActive({ userId: s._id, isActive: !s.isActive })}
                      >
                        {s.isActive ? "Deactivate" : "Activate"}
                      </Button>
                    </div>
                  </TD>
                )}
              </TR>
            ))}
          </TBody>
        </Table>
      </CardContent>
    </Card>
      )}
      {editing && <EditStaffModal staff={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

/**
 * Provision a new staff member: name + phone (the login identity) + role. The
 * account starts with NO password — the user sets it on their first sign-in.
 */
function AddStaffForm() {
  const roles = useQuery(api.roles.list);
  const createStaff = useMutation(api.staff.create);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const reset = () => {
    setName(""); setPhone(""); setEmail(""); setRoleId(""); setError(null);
  };

  const submit = async () => {
    setError(null);
    setDone(null);
    setBusy(true);
    try {
      await createStaff({
        name,
        phone,
        email: email || undefined,
        roleId: roleId ? (roleId as Parameters<typeof createStaff>[0]["roleId"]) : undefined,
      });
      setDone(`${name.trim()} added — they set their password on first sign-in.`);
      reset();
      setOpen(false);
    } catch (e) {
      setError(reportError(e));
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <div className="flex items-center gap-3">
        <Button onClick={() => { setOpen(true); setDone(null); }}>+ Add staff</Button>
        {done && <p className="text-sm text-success">{done}</p>}
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-3">
        <h2 className="text-sm font-semibold">Add staff member</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-fg-muted">
            Full name
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Grace Achieng" />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-fg-muted">
            Phone number
            <Input inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+254 7XX XXX XXX" />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-fg-muted">
            Email <span className="font-normal opacity-60">(optional)</span>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-fg-muted">
            Role
            <select
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              className="h-10 rounded-ctrl border border-border bg-bg-input px-3 text-sm text-fg"
            >
              <option value="">No role yet</option>
              {(roles ?? []).map((r) => (
                <option key={r._id} value={r._id}>{r.name}</option>
              ))}
            </select>
          </label>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex gap-2">
          <Button disabled={busy} onClick={submit}>{busy ? "Adding…" : "Add staff"}</Button>
          <Button variant="ghost" onClick={() => { setOpen(false); reset(); }}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}

const MAX_CHANGES = 3;

/** `{ from: "203", to: "101" }` → `203 → 101`; a creation (no `from`) → just the value. */
function changeText(change: { from: string | null; to: string | null }): string {
  if (change.from === null) return change.to ?? "—";
  return `${change.from} → ${change.to ?? "cleared"}`;
}

/**
 * Audit log (Story 2.5), made readable.
 *
 * These columns used to print the stored row verbatim — `roomType.create`,
 * `roomType · n572z146…`, `ks7c4ac8` — which nobody can audit from: a dotted
 * action, a table name plus a truncated document id, and a truncated user id.
 *
 * `api.audit.list` now resolves those server-side to `actionLabel`
 * ("Room type created"), `entity` (`Room type "Closed Balcony"`) and `actor`
 * ("Grace Achieng"), and adds an already-formatted field diff. So this component
 * only lays strings out — no id mangling here, and nothing to keep in sync if a
 * new action or table is added. The machine `action` is still on every row, and
 * is what the record-type filter narrows against.
 *
 * Diffs are capped at MAX_CHANGES lines per row because a creation carries every
 * column of the new document; the remainder expands per row on request.
 */
function AuditSection() {
  const [entityType, setEntityType] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const types = useQuery(api.audit.entityTypes, {});
  const rows = useQuery(api.audit.list, {
    limit: 100,
    ...(entityType ? { entityType } : {}),
  });

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (rows === undefined) return <p className="text-sm text-fg-muted">Loading audit log…</p>;

  return (
    <Card>
      <CardContent className="space-y-3">
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-fg-muted sm:max-w-xs">
          Filter by record type
          <select
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            className="h-10 rounded-ctrl border border-border bg-bg-input px-3 text-sm text-fg"
          >
            <option value="">All record types</option>
            {(types ?? []).map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </label>

        {rows.length === 0 ? (
          <EmptyState
            title="No audit entries"
            description={
              entityType
                ? "Nothing recorded for this record type yet."
                : "No sensitive actions recorded yet."
            }
          />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>When</TH>
                <TH>Action</TH>
                <TH>Record</TH>
                <TH>Who</TH>
                <TH>What changed</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((r) => {
                const open = expanded.has(r._id);
                const shown = open ? r.changes : r.changes.slice(0, MAX_CHANGES);
                const hidden = r.changes.length - shown.length;
                return (
                  <TR key={r._id}>
                    <TD className="whitespace-nowrap text-xs text-fg-muted">
                      {new Date(r._creationTime).toLocaleString("en-KE", {
                        month: "short",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TD>
                    <TD className="font-medium">{r.actionLabel}</TD>
                    <TD>{r.entity}</TD>
                    <TD className="text-fg-muted">{r.actor}</TD>
                    <TD className="text-xs">
                      {r.changes.length === 0 ? (
                        <span className="text-fg-muted">—</span>
                      ) : (
                        <>
                          <ul className="space-y-0.5">
                            {shown.map((c) => (
                              <li key={c.field}>
                                <span className="text-fg-muted">{c.field}:</span>{" "}
                                {changeText(c)}
                              </li>
                            ))}
                          </ul>
                          {(hidden > 0 || open) && (
                            <button
                              type="button"
                              onClick={() => toggle(r._id)}
                              className="mt-1 font-semibold text-primary underline"
                            >
                              {open ? "Show less" : `+${hidden} more`}
                            </button>
                          )}
                        </>
                      )}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
