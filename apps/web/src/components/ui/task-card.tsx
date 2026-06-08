import * as React from "react";
import { Card, CardContent } from "./card";
import { StatusChip, type Status } from "./status-chip";

export interface TaskChecklistItem {
  label: string;
  done?: boolean;
}

export interface TaskCardProps extends React.HTMLAttributes<HTMLDivElement> {
  status: Status;
  statusLabel: string;
  title: string;
  description?: React.ReactNode;
  checklist?: TaskChecklistItem[];
  /** When provided, the checklist is controlled (caller persists `done`); otherwise it is uncontrolled (display/demo). */
  onItemToggle?: (index: number, done: boolean) => void;
  action?: React.ReactNode;
}

/** Operational task card — status chip, title, optional checklist + action. */
export function TaskCard({
  status,
  statusLabel,
  title,
  description,
  checklist,
  onItemToggle,
  action,
  className,
  ...props
}: TaskCardProps) {
  const reactId = React.useId();
  return (
    <Card className={className} {...props}>
      <CardContent className="flex flex-col gap-3">
        <StatusChip status={status} className="self-start">
          {statusLabel}
        </StatusChip>
        <div className="flex flex-col gap-1">
          <h3 className="font-semibold text-text">{title}</h3>
          {description ? <p className="text-sm text-text-muted">{description}</p> : null}
        </div>
        {checklist && checklist.length > 0 ? (
          <ul className="flex flex-col gap-1.5">
            {checklist.map((item, i) => {
              const cid = `${reactId}-${i}`;
              return (
                <li key={cid} className="flex items-center gap-2 text-sm text-text">
                  {onItemToggle ? (
                    <input
                      id={cid}
                      type="checkbox"
                      checked={!!item.done}
                      onChange={(e) => onItemToggle(i, e.target.checked)}
                      className="size-4 rounded border-border accent-[var(--primary)]"
                    />
                  ) : (
                    <input
                      id={cid}
                      type="checkbox"
                      defaultChecked={item.done}
                      className="size-4 rounded border-border accent-[var(--primary)]"
                    />
                  )}
                  <label htmlFor={cid}>{item.label}</label>
                </li>
              );
            })}
          </ul>
        ) : null}
        {action ? <div className="mt-1">{action}</div> : null}
      </CardContent>
    </Card>
  );
}
