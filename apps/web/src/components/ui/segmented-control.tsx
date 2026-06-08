"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export interface SegmentedOption<T extends string> {
  label: string;
  value: T;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
  className?: string;
  "aria-label"?: string;
}

/** Controlled segmented button group (radiogroup) — arrow-key operable, focus follows selection. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onValueChange,
  className,
  "aria-label": ariaLabel,
}: SegmentedControlProps<T>) {
  const buttonRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  function select(rawIndex: number) {
    const len = options.length;
    if (len === 0) return;
    const i = ((rawIndex % len) + len) % len;
    const next = options[i];
    if (!next) return;
    onValueChange(next.value);
    // Focus must follow selection in a radiogroup (WAI-ARIA APG).
    buttonRefs.current[i]?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const idx = options.findIndex((o) => o.value === value);
    const base = idx === -1 ? 0 : idx;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      select(base + 1);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      select(base - 1);
    }
  }

  // Roving tabindex: exactly one button is tabbable. If `value` matches no option,
  // fall back to the first so the group never drops out of the tab order.
  const activeIndex = options.findIndex((o) => o.value === value);
  const tabbableIndex = activeIndex === -1 ? 0 : activeIndex;

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={cn("inline-flex rounded-lg border border-border bg-bg-alt p-0.5", className)}
    >
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              buttonRefs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={i === tabbableIndex ? 0 : -1}
            onClick={() => onValueChange(o.value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus",
              active ? "bg-bg-card text-text shadow-sm" : "text-text-muted hover:text-text",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
