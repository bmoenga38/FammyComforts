import * as React from "react";
import { cn } from "@/lib/cn";

export type Status = "success" | "info" | "warning" | "danger" | "premium";

const statusStyles: Record<Status, string> = {
  success: "bg-badge-success text-badge-success-fg",
  info: "bg-badge-info text-badge-info-fg",
  warning: "bg-badge-warning text-badge-warning-fg",
  danger: "bg-badge-danger text-badge-danger-fg",
  premium: "bg-badge-premium text-badge-premium-fg",
};

export interface StatusChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: Status;
  /** Optional decorative leading icon (e.g. a lucide-react icon). */
  icon?: React.ReactNode;
}

export function StatusChip({ status, icon, className, children, ...props }: StatusChipProps) {
  // Fall back to a neutral style if a non-union status reaches us from a JS/JSON
  // caller, so a chip is never rendered invisibly (no bg/text color).
  const style = statusStyles[status] ?? statusStyles.info;
  const hasText = children != null && children !== "";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        style,
        className,
      )}
      {...props}
    >
      {icon ? (
        <span aria-hidden="true" className="inline-flex [&_svg]:size-3.5">
          {icon}
        </span>
      ) : null}
      {/* Never communicate status by color alone: if no visible label is given,
          expose the status name to assistive tech. */}
      {hasText ? children : <span className="sr-only">{status}</span>}
    </span>
  );
}
