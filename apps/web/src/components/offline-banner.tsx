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
      aria-label="Connection status"
      // Opaque surface (not the translucent badge tint) so contrast is
      // deterministic over any content; text-badge-warning-fg on bg-card is the
      // AA-verified pairing from Story 1.3, with a warning accent border.
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 border-b-2 border-badge-warning-fg bg-bg-card px-4 py-1.5 text-center text-xs font-medium text-badge-warning-fg"
    >
      <span aria-hidden="true">●</span>
      You&rsquo;re offline — changes will sync when you reconnect.
    </div>
  );
}
