import * as React from "react";
import { cn } from "@/lib/cn";

export type SlotState = "available" | "booked" | "cleaning" | "occupied" | "checkout";

const slotStyles: Record<SlotState, string> = {
  available: "bg-badge-success text-badge-success-fg",
  booked: "bg-badge-info text-badge-info-fg",
  cleaning: "bg-badge-warning text-badge-warning-fg",
  occupied: "bg-badge-info text-badge-info-fg",
  checkout: "bg-badge-danger text-badge-danger-fg",
};

const slotLabels: Record<SlotState, string> = {
  available: "Available",
  booked: "Booked",
  cleaning: "Cleaning",
  occupied: "Occupied",
  checkout: "Checkout",
};

export interface CalendarSlotProps extends React.HTMLAttributes<HTMLDivElement> {
  state: SlotState;
}

/**
 * A room-availability cell — status color plus the state label. When custom
 * content is passed, the state name is still exposed to assistive tech and as a
 * tooltip, so the slot is never communicated by color alone.
 */
export function CalendarSlot({ state, className, children, title, ...props }: CalendarSlotProps) {
  const label = slotLabels[state];
  return (
    <div
      title={title ?? label}
      className={cn("rounded-md px-2 py-1 text-center text-xs font-medium", slotStyles[state], className)}
      {...props}
    >
      {children == null ? (
        label
      ) : (
        <>
          <span className="sr-only">{label}: </span>
          {children}
        </>
      )}
    </div>
  );
}
