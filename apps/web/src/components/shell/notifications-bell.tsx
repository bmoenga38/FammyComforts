"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@fammycomforts/backend/convex/_generated/api";
import { Bell, CalendarPlus, MessageSquare, Brush, Send } from "lucide-react";

/**
 * The live notification bell (replaces the old static dot): real badge count
 * from the org-scoped, permission-aware `notificationsFeed.feed` query, with a
 * glass dropdown listing each item. Stateless live counts — items disappear as
 * they're actioned (booking confirmed, request resolved, task done, SMS sent).
 */
const KIND_META: Record<string, { icon: React.ReactNode; cls: string }> = {
  booking_pending: { icon: <CalendarPlus className="size-4" />, cls: "bg-badge-warning text-badge-warning-fg" },
  guest_request: { icon: <MessageSquare className="size-4" />, cls: "bg-badge-info text-badge-info-fg" },
  housekeeping: { icon: <Brush className="size-4" />, cls: "bg-badge-warning text-badge-warning-fg" },
  sms_queued: { icon: <Send className="size-4" />, cls: "bg-badge-success text-badge-success-fg" },
};

function timeAgo(at: number): string {
  const s = Math.max(0, Math.floor((Date.now() - at) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function NotificationsBell() {
  const feed = useQuery(api.notificationsFeed.feed);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const count = feed?.count ?? 0;

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Notifications"
        aria-expanded={open}
        className="icon-btn relative"
        onClick={() => setOpen(!open)}
      >
        <Bell className="size-5" aria-hidden="true" />
        {count > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white"
          >
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close notifications"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            role="region"
            aria-label="Notification list"
            className="glass-panel absolute right-0 top-12 z-50 max-h-[70vh] w-[340px] overflow-y-auto rounded-card p-2 sm:w-[380px]"
          >
            <p className="text-label-caps px-3 pb-1 pt-2 uppercase text-text-muted">
              Notifications
            </p>
            {feed === undefined ? (
              <p className="px-3 py-4 text-body-md text-text-muted">Loading…</p>
            ) : feed.items.length === 0 ? (
              <p className="px-3 py-4 text-body-md text-text-muted">All caught up.</p>
            ) : (
              <div className="divide-rows">
                {feed.items.map((item, i) => {
                  const meta = KIND_META[item.kind] ?? KIND_META.guest_request;
                  return (
                    <div key={`${item.kind}-${i}`} className="list-row !px-3 !py-2.5">
                      <span className={`grid size-8 shrink-0 place-items-center rounded-full ${meta.cls}`}>
                        {meta.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-text">{item.title}</p>
                        <p className="truncate text-body-md text-text-muted">{item.detail}</p>
                      </div>
                      <span className="shrink-0 font-mono text-[11px] text-text-dim">
                        {timeAgo(item.at)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
