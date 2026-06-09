"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@fammycomforts/backend/convex/_generated/api";
import { usePermissions } from "@/lib/use-permissions";
import { PERMISSION_AREAS, ACTIONS } from "@/lib/permissions";
import {
  Button,
  Card,
  CardContent,
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

function StaffSection({ canManage }: { canManage: boolean }) {
  const staff = useQuery(api.staff.list);
  const setActive = useMutation(api.staff.setActive);

  if (staff === undefined) return <p className="text-sm text-fg-muted">Loading staff…</p>;
  if (staff.length === 0)
    return <EmptyState title="No staff" description="No staff in this organization yet." />;

  return (
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
                    <Button
                      variant="ghost"
                      onClick={() => setActive({ userId: s._id, isActive: !s.isActive })}
                    >
                      {s.isActive ? "Deactivate" : "Activate"}
                    </Button>
                  </TD>
                )}
              </TR>
            ))}
          </TBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function AuditSection() {
  const rows = useQuery(api.audit.list, { limit: 100 });
  if (rows === undefined) return <p className="text-sm text-fg-muted">Loading audit log…</p>;
  if (rows.length === 0)
    return <EmptyState title="No audit entries" description="No sensitive actions recorded yet." />;

  return (
    <Card>
      <CardContent>
        <Table>
          <THead>
            <TR>
              <TH>Action</TH>
              <TH>Entity</TH>
              <TH>Actor</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((r) => (
              <TR key={r._id}>
                <TD>{r.action}</TD>
                <TD>
                  {r.entityType}
                  {r.entityId ? ` · ${r.entityId.slice(0, 8)}…` : ""}
                </TD>
                <TD className="text-xs text-fg-muted">{r.actorId?.slice(0, 8) ?? "system"}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </CardContent>
    </Card>
  );
}
