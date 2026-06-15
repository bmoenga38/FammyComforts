"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Reusable popup, matching the prototype's modal system
 * (ui-samples/fammycomfort_pwa: `modal()` / `.overlay.center` / `.modal-card`):
 * a blurred scrim over a centered card that fades + slides in. Closes on
 * Escape, scrim click, or the header ✕. Locks body scroll while open and
 * renders through a portal so it sits above the app shell (z-80, like the
 * prototype's overlay). Reuses the existing `.fade-in` keyframe and `.icon-btn`.
 */
type ModalSize = "sm" | "md" | "lg";

const SIZES: Record<ModalSize, string> = {
  sm: "max-w-[400px]",
  md: "max-w-[460px]",
  lg: "max-w-[620px]",
};

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  /** Optional header title; when set, a header row with a close button renders. */
  title?: React.ReactNode;
  /** Optional sticky footer (e.g. action buttons). */
  footer?: React.ReactNode;
  size?: ModalSize;
  /** Hide the default header close button (e.g. when the body has its own ✕). */
  hideClose?: boolean;
  className?: string;
  children: React.ReactNode;
};

export function Modal({
  open,
  onClose,
  title,
  footer,
  size = "md",
  hideClose = false,
  className,
  children,
}: ModalProps) {
  const [shown, setShown] = React.useState(false);
  const panelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    // Trigger the scrim fade on the next frame (mount at opacity-0 → 100).
    const raf = requestAnimationFrame(() => {
      setShown(true);
      panelRef.current?.focus();
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      setShown(false);
    };
  }, [open, onClose]);

  // `open` starts false and only flips after a client interaction, so the modal
  // never renders during SSR; the document guard keeps createPortal safe.
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={typeof title === "string" ? title : "Dialog"}
      // mousedown (not click) so a drag that starts inside the card never closes it
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={cn(
        "fixed inset-0 z-[80] flex items-center justify-center p-4",
        "bg-[rgba(8,9,13,0.6)] backdrop-blur-[4px] transition-opacity duration-300",
        shown ? "opacity-100" : "opacity-0",
      )}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          "fade-in flex max-h-[88vh] w-full flex-col overflow-hidden rounded-[18px]",
          "border border-[var(--hairline)] bg-bg-card shadow-[0_24px_60px_rgba(0,0,0,0.4)] outline-none",
          SIZES[size],
          className,
        )}
      >
        {title != null && (
          <div className="flex items-center gap-3 border-b border-[var(--hairline)] px-5 py-4">
            <h2 className="flex-1 text-base font-semibold text-text">{title}</h2>
            {!hideClose && (
              <button type="button" aria-label="Close" className="icon-btn" onClick={onClose}>
                <X className="size-5" aria-hidden="true" />
              </button>
            )}
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
        {footer != null && (
          <div className="border-t border-[var(--hairline)] bg-bg-card px-5 py-4">{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  );
}