import * as React from "react";
import { cn } from "@/lib/cn";

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
}

/** Centered empty/placeholder state with an optional icon, description, and action. */
export function EmptyState({ icon, title, description, action, className, ...props }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-6 text-center",
        className,
      )}
      {...props}
    >
      {icon ? (
        <span aria-hidden="true" className="text-text-dim [&_svg]:size-6">
          {icon}
        </span>
      ) : null}
      <p className="text-sm font-medium text-text">{title}</p>
      {description ? <p className="text-sm text-text-muted">{description}</p> : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
