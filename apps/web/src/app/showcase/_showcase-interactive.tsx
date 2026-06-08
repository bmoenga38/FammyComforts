"use client";

import { useState } from "react";
import { SegmentedControl, Button, useToast } from "@/components/ui";

/** Client island for the showcase: stateful SegmentedControl + a toast trigger. */
export function ShowcaseInteractive() {
  const [filter, setFilter] = useState("all");
  const { toast } = useToast();

  return (
    <div className="flex flex-wrap items-center gap-4">
      <SegmentedControl
        aria-label="Room filter"
        options={[
          { label: "All", value: "all" },
          { label: "Available", value: "available" },
          { label: "Premium", value: "premium" },
        ]}
        value={filter}
        onValueChange={setFilter}
      />
      <span className="text-sm text-text-muted">
        Filter: <span className="font-mono text-text">{filter}</span>
      </span>
      <Button variant="ghost" onClick={() => toast("Booking draft saved.")}>
        Show toast
      </Button>
    </div>
  );
}
