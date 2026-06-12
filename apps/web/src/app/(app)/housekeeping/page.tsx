"use client";

import { useRef, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@fammycomforts/backend/convex/_generated/api";
import { usePermissions } from "@/lib/use-permissions";
import { Button, EmptyState, Input, StatusChip } from "@/components/ui";
import {
  Play,
  Check,
  Undo2,
  TriangleAlert,
  Brush,
  Pause,
  Flag,
  Camera,
  Plus,
  Wrench,
} from "lucide-react";

/**
 * Housekeeping workspace (prototype V.tasks + Epic 7 R2): shift meter, urgent
 * banner, All/Mine filter, expandable tasks with room-type checklists (7.4),
 * photo proof (7.5), pause/flag transitions, manager task creation +
 * assignment (7.3), and maintenance/damage reporting (7.6).
 */
const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
const PRIORITIES = ["low", "normal", "high", "urgent"] as const;

export default function HousekeepingPage() {
  const { can, isLoading } = usePermissions();
  const [mine, setMine] = useState(false);
  const tasks = useQuery(api.housekeeping.list, { mine });
  const setStatus = useMutation(api.housekeeping.setStatus);
  const [expanded, setExpanded] = useState<string | null>(null);

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
  const canManage = can("Housekeeping", "manage");
  const open = tasks
    .filter((t) => t.status !== "completed")
    .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9));
  const done = tasks.filter((t) => t.status === "completed");
  const pct = tasks.length ? Math.round((done.length / tasks.length) * 100) : 0;
  const urgent = open.find((t) => t.priority === "urgent" || t.priority === "high");

  return (
    <section className="fade-in space-y-5 p-4 md:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow mb-1">My work</p>
          <h1 className="hero-title font-display text-headline-lg">Housekeeping</h1>
          <p className="mt-1 text-body-lg text-text-muted">
            {open.length} open · {done.length} completed
          </p>
        </div>
        <div className="seg" role="tablist" aria-label="Task filter">
          <button
            role="tab"
            aria-selected={!mine}
            className={`seg-btn ${!mine ? "active" : ""}`}
            onClick={() => setMine(false)}
          >
            All tasks
          </button>
          <button
            role="tab"
            aria-selected={mine}
            className={`seg-btn ${mine ? "active" : ""}`}
            onClick={() => setMine(true)}
          >
            Mine
          </button>
        </div>
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

      {canManage && <CreateTaskPanel />}

      <div>
        <h2 className="mb-2 font-display text-headline-sm text-text">To do</h2>
        <div className="card divide-rows !p-2">
          {open.length === 0 ? (
            <p className="px-3 py-5 text-center text-body-md text-text-muted">
              All caught up — great work!
            </p>
          ) : (
            open.map((t) => (
              <TaskRow
                key={t.taskId}
                task={t}
                canWrite={canWrite}
                canManage={canManage}
                expanded={expanded === t.taskId}
                onToggle={() => setExpanded(expanded === t.taskId ? null : t.taskId)}
              />
            ))
          )}
        </div>
      </div>

      {done.length > 0 && (
        <div>
          <h2 className="mb-2 font-display text-headline-sm text-text">Completed</h2>
          <div className="card divide-rows !p-2">
            {done.map((t) => (
              <TaskRow
                key={t.taskId}
                task={t}
                canWrite={canWrite}
                canManage={canManage}
                expanded={expanded === t.taskId}
                onToggle={() => setExpanded(expanded === t.taskId ? null : t.taskId)}
              />
            ))}
          </div>
        </div>
      )}

      {can("Maintenance", "write") && <ReportIssuePanel />}
    </section>
  );
}

type Task = FunctionReturnType<typeof api.housekeeping.list>[number];

function TaskRow({
  task: t,
  canWrite,
  canManage,
  expanded,
  onToggle,
}: {
  task: Task;
  canWrite: boolean;
  canManage: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const setStatus = useMutation(api.housekeeping.setStatus);
  const toggleItem = useMutation(api.housekeeping.toggleChecklistItem);
  const assign = useMutation(api.housekeeping.assign);
  const generateUploadUrl = useMutation(api.housekeeping.generateUploadUrl);
  const attachPhoto = useMutation(api.housekeeping.attachPhoto);
  const assignees = useQuery(api.housekeeping.assignees, canManage ? {} : "skip");
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const uploadPhoto = async (file: File) => {
    setUploading(true);
    try {
      const url = await generateUploadUrl();
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const { storageId } = (await res.json()) as { storageId: string };
      await attachPhoto({
        taskId: t.taskId,
        storageId: storageId as Parameters<typeof attachPhoto>[0]["storageId"],
      });
    } finally {
      setUploading(false);
    }
  };

  const ticked = t.checklist?.filter((c) => c.done).length ?? 0;

  return (
    <div className="!px-2">
      <button className="list-row w-full text-left !px-0" onClick={onToggle}>
        <span
          className={`grid size-10 shrink-0 place-items-center rounded-full ${
            t.status === "completed"
              ? "bg-badge-success text-badge-success-fg"
              : "bg-bg-input text-text-muted"
          }`}
        >
          <Brush className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className={`font-semibold text-text ${t.status === "completed" ? "opacity-65" : ""}`}>
            Cleaning · <span className="font-mono">Rm {t.roomNumber}</span>
            {t.assigneeName && (
              <span className="ml-2 text-body-md font-normal text-text-muted">
                → {t.assigneeName}
              </span>
            )}
          </p>
          <p className="truncate text-body-md text-text-muted">
            {t.notes ?? "Standard turnover"}
            {t.checklist && t.checklist.length > 0 && (
              <span className="ml-2 font-mono">
                {ticked}/{t.checklist.length} ✓
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {t.status !== "completed" && (
            <StatusChip
              status={t.priority === "urgent" || t.priority === "high" ? "danger" : "warning"}
            >
              {t.priority}
            </StatusChip>
          )}
          {t.status === "paused" && <StatusChip status="info">paused</StatusChip>}
          {t.status === "flagged" && <StatusChip status="danger">flagged</StatusChip>}
        </div>
      </button>

      {expanded && (
        <div className="mb-2 space-y-3 rounded-card bg-bg-input/50 p-3">
          {/* Checklist (snapshotted from the room-type template on start) */}
          {t.checklist && t.checklist.length > 0 && (
            <div className="space-y-1.5">
              {t.checklist.map((item, i) => (
                <label key={i} className="flex cursor-pointer items-center gap-2 text-body-md text-text">
                  <input
                    type="checkbox"
                    checked={item.done}
                    disabled={!canWrite || t.status === "completed"}
                    onChange={() => toggleItem({ taskId: t.taskId, index: i })}
                  />
                  <span className={item.done ? "line-through opacity-60" : ""}>{item.label}</span>
                </label>
              ))}
            </div>
          )}
          {!t.checklist && t.status === "pending" && (
            <p className="text-body-md text-text-muted">
              The room-type checklist loads when you start the task.
            </p>
          )}

          {t.photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={t.photoUrl} alt="Task proof" className="max-h-44 rounded-card object-cover" />
          )}

          {canWrite && (
            <div className="flex flex-wrap items-center gap-2">
              {t.status === "pending" && (
                <Button size="sm" onClick={() => setStatus({ taskId: t.taskId, status: "in_progress" })}>
                  <Play className="size-3.5" aria-hidden="true" /> Start
                </Button>
              )}
              {(t.status === "in_progress" || t.status === "paused" || t.status === "flagged") && (
                <Button size="sm" onClick={() => setStatus({ taskId: t.taskId, status: "completed" })}>
                  <Check className="size-3.5" aria-hidden="true" /> Done
                </Button>
              )}
              {t.status === "in_progress" && (
                <Button size="sm" variant="ghost" onClick={() => setStatus({ taskId: t.taskId, status: "paused" })}>
                  <Pause className="size-3.5" aria-hidden="true" /> Pause
                </Button>
              )}
              {t.status === "paused" && (
                <Button size="sm" variant="ghost" onClick={() => setStatus({ taskId: t.taskId, status: "in_progress" })}>
                  <Play className="size-3.5" aria-hidden="true" /> Resume
                </Button>
              )}
              {t.status !== "completed" && t.status !== "flagged" && (
                <Button size="sm" variant="ghost" onClick={() => setStatus({ taskId: t.taskId, status: "flagged" })}>
                  <Flag className="size-3.5" aria-hidden="true" /> Flag
                </Button>
              )}
              {t.status === "completed" && (
                <Button size="sm" variant="ghost" onClick={() => setStatus({ taskId: t.taskId, status: "pending" })}>
                  <Undo2 className="size-3.5" aria-hidden="true" /> Reopen
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                <Camera className="size-3.5" aria-hidden="true" />{" "}
                {uploading ? "Uploading…" : t.photoUrl ? "Replace photo" : "Add photo"}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])}
              />
            </div>
          )}

          {/* Assignment (ops manager) */}
          {canManage && assignees && (
            <label className="flex items-center gap-2 text-body-md text-text-muted">
              Assign to
              <select
                className="ctrl"
                value={t.assigneeId ?? ""}
                onChange={(e) =>
                  assign({
                    taskId: t.taskId,
                    assigneeId: (e.target.value || undefined) as Parameters<
                      typeof assign
                    >[0]["assigneeId"],
                  })
                }
              >
                <option value="">Unassigned</option>
                {assignees.map((a) => (
                  <option key={a.userId} value={a.userId}>
                    {a.name} ({a.role})
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}
    </div>
  );
}

/** 7.3 — manager panel: create a task with room, priority, assignee. */
function CreateTaskPanel() {
  const rooms = useQuery(api.rooms.list, {});
  const assignees = useQuery(api.housekeeping.assignees, {});
  const create = useMutation(api.housekeeping.create);
  const [roomId, setRoomId] = useState("");
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]>("normal");
  const [assigneeId, setAssigneeId] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!roomId) return;
    setBusy(true);
    try {
      await create({
        roomId: roomId as Parameters<typeof create>[0]["roomId"],
        priority,
        notes: notes || undefined,
        assigneeId: (assigneeId || undefined) as Parameters<typeof create>[0]["assigneeId"],
      });
      setNotes("");
      setAssigneeId("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card space-y-3">
      <h2 className="font-display text-headline-sm text-text">New task</h2>
      <div className="flex flex-wrap items-center gap-2">
        <select className="ctrl" value={roomId} onChange={(e) => setRoomId(e.target.value)}>
          <option value="">Room…</option>
          {rooms?.map((r) => (
            <option key={r._id} value={r._id}>
              Rm {r.number} ({r.status})
            </option>
          ))}
        </select>
        <select
          className="ctrl"
          value={priority}
          onChange={(e) => setPriority(e.target.value as (typeof PRIORITIES)[number])}
        >
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select className="ctrl" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
          <option value="">Unassigned</option>
          {assignees?.map((a) => (
            <option key={a.userId} value={a.userId}>
              {a.name}
            </option>
          ))}
        </select>
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional)"
          className="min-w-44 flex-1"
        />
        <Button disabled={!roomId || busy} onClick={submit}>
          <Plus className="size-4" aria-hidden="true" /> Create
        </Button>
      </div>
    </div>
  );
}

/** 7.6 — report maintenance/damage from the floor. */
function ReportIssuePanel() {
  const rooms = useQuery(api.rooms.list, {});
  const report = useMutation(api.maintenance.report);
  const [kind, setKind] = useState<"maintenance" | "damage">("maintenance");
  const [roomId, setRoomId] = useState("");
  const [description, setDescription] = useState("");
  const [blockRoom, setBlockRoom] = useState(false);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!description.trim()) return;
    setBusy(true);
    try {
      await report({
        kind,
        description,
        roomId: (roomId || undefined) as Parameters<typeof report>[0]["roomId"],
        blockRoom: blockRoom || undefined,
      });
      setDescription("");
      setBlockRoom(false);
      setSent(true);
      setTimeout(() => setSent(false), 2500);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card space-y-3">
      <h2 className="flex items-center gap-2 font-display text-headline-sm text-text">
        <Wrench className="size-4" aria-hidden="true" /> Report an issue
      </h2>
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="ctrl"
          value={kind}
          onChange={(e) => setKind(e.target.value as "maintenance" | "damage")}
        >
          <option value="maintenance">Maintenance</option>
          <option value="damage">Damage</option>
        </select>
        <select className="ctrl" value={roomId} onChange={(e) => setRoomId(e.target.value)}>
          <option value="">No room</option>
          {rooms?.map((r) => (
            <option key={r._id} value={r._id}>
              Rm {r.number}
            </option>
          ))}
        </select>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the issue…"
          className="min-w-52 flex-1"
        />
        {kind === "maintenance" && roomId && (
          <label className="flex items-center gap-1.5 text-body-md text-text-muted">
            <input
              type="checkbox"
              checked={blockRoom}
              onChange={(e) => setBlockRoom(e.target.checked)}
            />
            Take room offline
          </label>
        )}
        <Button disabled={!description.trim() || busy} onClick={submit}>
          {sent ? "Reported ✓" : "Report"}
        </Button>
      </div>
    </div>
  );
}
