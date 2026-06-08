import * as React from "react";
import { cn } from "@/lib/cn";

/** Horizontally-scrollable board of columns (keyboard-scrollable). */
export function Kanban({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      tabIndex={0}
      role="group"
      aria-label="Board — scroll horizontally"
      className={cn(
        "flex gap-3 overflow-x-auto pb-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus",
        className,
      )}
      {...props}
    />
  );
}

export interface KanbanColumnProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  count?: number;
}

/** A titled column; render cards as children, or an <EmptyState> when empty. */
export function KanbanColumn({ title, count, className, children, ...props }: KanbanColumnProps) {
  return (
    <div
      className={cn("flex w-64 shrink-0 flex-col gap-2 rounded-lg border border-border bg-bg-alt p-3", className)}
      {...props}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text">{title}</h3>
        {typeof count === "number" ? <span className="font-mono text-xs text-text-dim">{count}</span> : null}
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}
