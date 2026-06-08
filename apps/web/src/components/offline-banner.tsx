"use client";

import { useOnlineStatus } from "@/lib/use-online-status";

/** A fixed, announced banner shown only while the browser is offline. */
export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-badge-warning px-4 py-1.5 text-center text-xs font-medium text-badge-warning-fg"
    >
      <span aria-hidden="true">●</span>
      You&rsquo;re offline — changes will sync when you reconnect.
    </div>
  );
}
