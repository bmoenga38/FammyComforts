"use client";

import * as React from "react";
import { Modal } from "./modal";
import { Button } from "./button";

/**
 * A small confirm/cancel popup built on {@link Modal}, for destructive or
 * consequential actions (cancel booking, refund, check-out with balance, …).
 * Mirrors the prototype's confirm popups: a titled card with a short message
 * and two actions. Set `danger` for a red confirm button.
 */
export type ConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: React.ReactNode;
  /** Short explanation of what will happen. */
  message?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button for destructive actions. */
  danger?: boolean;
  /** Disable the buttons and show a pending label while the action runs. */
  busy?: boolean;
  /** Extra content above the buttons (e.g. a reason picker or amount). */
  children?: React.ReactNode;
};

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  busy = false,
  children,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </Button>
          {danger ? (
            <button
              type="button"
              onClick={onConfirm}
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 rounded-ctrl px-4 py-2.5 text-sm font-semibold text-white transition-all duration-300 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-55"
              style={{ background: "var(--red)" }}
            >
              {busy ? "Working…" : confirmLabel}
            </button>
          ) : (
            <Button onClick={onConfirm} disabled={busy}>
              {busy ? "Working…" : confirmLabel}
            </Button>
          )}
        </div>
      }
    >
      {message != null && <p className="text-sm text-text-muted">{message}</p>}
      {children}
    </Modal>
  );
}