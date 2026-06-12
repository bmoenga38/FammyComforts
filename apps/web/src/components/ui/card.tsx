import * as React from "react";
import { cn } from "@/lib/cn";

/* Prototype card (css/styles.css .card): 16px radius, hairline border on the
   navy surface, soft elevation in light mode. */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-card border border-[var(--hairline)] bg-bg-card transition-[border-color,transform,box-shadow] duration-300",
        className,
      )}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}
