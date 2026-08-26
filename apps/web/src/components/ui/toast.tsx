"use client";

import * as React from "react";
import { X, CircleAlert, CircleCheck } from "lucide-react";

/** Visual/semantic weight of a toast. `error` is announced assertively and sticks. */
export type ToastVariant = "info" | "success" | "error";

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastOptions {
  /**
   * Auto-dismiss delay in ms. Defaults to 5000 for `info`/`success` and to 0
   * (stay until dismissed) for `error`, because an error the user never got to
   * read is the same as no error message at all. Pass an explicit value to
   * override either default.
   */
  durationMs?: number;
  variant?: ToastVariant;
}

interface ToastContextValue {
  toast: (message: string, opts?: ToastOptions) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

/**
 * Module-level bridge to the mounted provider.
 *
 * `useToast` is the right API inside components. But error reporting has to work
 * from places that are not components — `.catch()` callbacks, helper modules,
 * `lib/report-error.ts` — and threading a hook through all of them is how error
 * handling ends up being skipped. Exactly one `<ToastProvider>` is mounted (in
 * `app/layout.tsx`), so a single module slot is unambiguous. This is the same
 * pattern react-hot-toast and sonner use.
 *
 * No-ops (rather than throwing) when nothing is mounted — during SSR, or in a
 * unit test that renders a component without the provider. Losing a toast must
 * never be what breaks a page.
 */
let emit: ((message: string, opts?: ToastOptions) => void) | null = null;

export function notify(message: string, opts?: ToastOptions): void {
  emit?.(message, opts);
}

const VARIANT_STYLES: Record<ToastVariant, { border: string; icon: string }> = {
  info: { border: "border-border", icon: "text-text-dim" },
  success: { border: "border-success", icon: "text-success" },
  error: { border: "border-danger", icon: "text-danger" },
};

function VariantIcon({ variant }: { variant: ToastVariant }) {
  const cls = `size-4 shrink-0 ${VARIANT_STYLES[variant].icon}`;
  if (variant === "error") return <CircleAlert className={cls} aria-hidden="true" />;
  if (variant === "success") return <CircleCheck className={cls} aria-hidden="true" />;
  return null;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);
  const idRef = React.useRef(0);
  const timers = React.useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = React.useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = React.useCallback(
    (message: string, opts?: ToastOptions) => {
      const variant = opts?.variant ?? "info";
      const id = (idRef.current += 1);
      setToasts((prev) => {
        // Repeating the same message (a double-clicked save that fails twice)
        // should refresh the existing toast, not stack duplicates.
        const deduped = prev.filter((t) => t.message !== message);
        return [...deduped, { id, message, variant }];
      });
      const duration = opts?.durationMs ?? (variant === "error" ? 0 : 5000);
      if (duration > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), duration),
        );
      }
    },
    [dismiss],
  );

  // Publish/retract the module-level bridge for the provider's lifetime.
  React.useEffect(() => {
    emit = toast;
    return () => {
      if (emit === toast) emit = null;
    };
  }, [toast]);

  // Clear any pending timers if the provider unmounts.
  React.useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((t) => clearTimeout(t));
      map.clear();
    };
  }, []);

  const value = React.useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Positioning container — NOT itself a live region; each toast announces itself. */}
      <div
        role="region"
        aria-label="Notifications"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.variant === "error" ? "alert" : "status"}
            aria-live={t.variant === "error" ? "assertive" : "polite"}
            className={`pointer-events-auto flex max-w-md items-start gap-3 rounded-lg border bg-bg-card px-4 py-2.5 text-sm text-text shadow-lg ${VARIANT_STYLES[t.variant].border}`}
          >
            <VariantIcon variant={t.variant} />
            <span className="min-w-0 flex-1">{t.message}</span>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => dismiss(t.id)}
              className="shrink-0 text-text-dim transition-colors hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
