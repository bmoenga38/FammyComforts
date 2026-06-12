import * as React from "react";
import { cn } from "@/lib/cn";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        // Prototype .input: surface-high fill, 12px radius, teal focus ring.
        "w-full rounded-ctrl border border-border bg-bg-input px-3.5 py-2.5 text-sm text-text placeholder:text-text-muted placeholder:opacity-70 transition-[border-color,box-shadow] duration-300 focus-visible:border-primary focus-visible:shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary)_18%,transparent)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
