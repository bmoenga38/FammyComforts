import * as React from "react";
import { Card, CardContent } from "./card";

export interface MetricTileProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Decorative leading icon (e.g. a lucide-react icon). */
  icon?: React.ReactNode;
  label: string;
  value: React.ReactNode;
  note?: React.ReactNode;
}

/** KPI tile for dashboards — icon + label + large value + optional sub-note. */
export function MetricTile({ icon, label, value, note, className, ...props }: MetricTileProps) {
  return (
    <Card className={className} {...props}>
      <CardContent className="flex flex-col gap-1">
        {icon ? (
          <span aria-hidden="true" className="text-text-muted [&_svg]:size-5">
            {icon}
          </span>
        ) : null}
        <span className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</span>
        <span className="text-2xl font-bold text-heading">{value}</span>
        {note ? <span className="text-sm text-text-dim">{note}</span> : null}
      </CardContent>
    </Card>
  );
}
