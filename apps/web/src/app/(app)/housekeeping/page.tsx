"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@fammycomforts/backend/convex/_generated/api";
import { usePermissions } from "@/lib/use-permissions";
import { Button, EmptyState, StatusChip } from "@/components/ui";
import { Play, Check, Undo2, TriangleAlert, Brush } from "lucide-react";

/**
 * Housekeeping workspace (prototype V.tasks): shift-progress meter, pinned
 * urgent banner with "Start now", explicit Start / Done / Reopen buttons per
 * task (never tap-row-to-cycle), priority-sorted open list + completed group +
 * the all-caught-up empty state. Completing a clean frees the room
 * (housekeeping.setStatus).
 */
const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

export default function HousekeepingPage() {
  const { can, isLoading } = usePermissions();
  const tasks = useQuery(api.housekeeping.list);
  const setStatus = useMutation(api.housekeeping.setStatus);

  if (isLoading) return <p className="p-6 text-sm text-text-muted">Loading…</p>;
  if (!can("Housekeeping", "read")) {
    return (
      <div className="p-6">
        <EmptyState title="No access" description="You don't have housekeeping permissions." />
      </div>
    );
  }
  if (tasks === undefined) return <p className="p-6 text-sm text-text-muted">Loading tasks…</p>;

  const canWrite = can("Housekeeping", "write");
  const open = tasks
    .filter((t) => t.status !== "completed")
    .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9));
  const done = tasks.filter((t) => t.status === "completed");
  const pct = tasks.length ? Math.round((done.length / tasks.length) * 100) : 0;
  const urgent = open.find((t) => t.priority === "urgent" || t.priority === "high");

  const actionFor = (t: (typeof tasks)[number]) => {
    if (!canWrite) return null;
    if (t.status === "pending")
      return (
        <Button size="sm" variant="ghost" onClick={() => setStatus({ taskId: t.taskId, status: "in_progress" })}>
          <Play className="size-3.5" aria-hidden="true" /> Start
        </Button>
      );
    if (t.status === "in_progress")
      return (
        <Button size="sm" onClick={() => setStatus({ taskId: t.taskId, status: "completed" })}>
          <Check className="size-3.5" aria-hidden="true" /> Done
        </Button>
      );
    return (
      <Button size="sm" variant="ghost" onClick={() => setStatus({ taskId: t.taskId, status: "pending" })}>
        <Undo2 className="size-3.5" aria-hidden="true" /> Reopen
      </Button>
    );
  };

  const row = (t: (typeof tasks)[number]) => (
    <div key={t.taskId} className="list-row !px-2">
      <span
        className={`grid size-10 shrink-0 place-items-center rounded-full ${
          t.status === "completed" ? "bg-badge-success text-badge-success-fg" : "bg-bg-input text-text-muted"
        }`}
      >
        <Brush className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className={`font-semibold text-text ${t.status === "completed" ? "opacity-65" : ""}`}>
          Cleaning · <span className="font-mono">Rm {t.roomNumber}</span>
        </p>
        <p className="truncate text-body-md text-text-muted">{t.notes ?? "Standard turnover"}</p>
      </div>
      <div className="flex items-center gap-2">
        {t.status !== "completed" && (
          <StatusChip status={t.priority === "urgent" || t.priority === "high" ? "danger" : "warning"}>
            {t.priority}
          </StatusChip>
        )}
        {actionFor(t)}
      </div>
    </div>
  );

  return (
    <section className="fade-in space-y-5 p-4 md:p-6">
      <header>
        <p className="eyebrow mb-1">My work</p>
        <h1 className="hero-title font-display text-headline-lg">Assigned tasks</h1>
        <p className="mt-1 text-body-lg text-text-muted">
          {open.length} open · {done.length} completed
        </p>
      </header>

      {/* Shift progress (prototype meter) */}
      <div className="card">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-label-caps uppercase text-text-muted">Shift progress</span>
          <span className="font-mono text-text">
            {done.length}/{tasks.length} · {pct}%
          </span>
        </div>
        <div className="meter">
          <span style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Pinned urgent banner */}
      {urgent && (
        <div className="card flex flex-wrap items-center gap-3 !border-[rgba(244,63,94,.35)] !bg-[rgba(244,63,94,.07)]">
          <span className="grid size-10 place-items-center rounded-full bg-badge-danger text-badge-danger-fg">
            <TriangleAlert className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-text">
              {urgent.priority === "urgent" ? "Urgent" : "High priority"} · Cleaning ·{" "}
              <span className="font-mono">Rm {urgent.roomNumber}</span>
            </p>
            <p className="truncate text-body-md text-text-muted">{urgent.notes}</p>
          </div>
          {canWrite && urgent.status === "pending" && (
            <Button onClick={() => setStatus({ taskId: urgent.taskId, status: "in_progress" })}>
              <Play className="size-4" aria-hidden="true" /> Start now
            </Button>
          )}
        </div>
      )}

      <div>
        <h2 className="mb-2 font-display text-headline-sm text-text">To do</h2>
        <div className="card divide-rows !p-2">
          {open.length === 0 ? (
            <p className="px-3 py-5 text-center text-body-md text-text-muted">
              All caught up — great work!
            </p>
          ) : (
            open.map(row)
          )}
        </div>
      </div>

      {done.length > 0 && (
        <div>
          <h2 className="mb-2 font-display text-headline-sm text-text">Completed</h2>
          <div className="card divide-rows !p-2">{done.map(row)}</div>
        </div>
      )}
    </section>
  );
}
