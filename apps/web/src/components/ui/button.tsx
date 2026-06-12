import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

/* Prototype button language (css/styles.css .btn): 12px radius, semibold,
   teal gradient + soft glow on primary, ghost outline that tints teal. */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-ctrl font-semibold transition-all duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus active:scale-[0.98] disabled:pointer-events-none disabled:opacity-55",
  {
    variants: {
      variant: {
        primary:
          "bg-btn-primary bg-[linear-gradient(135deg,#14b8a6_0%,#0d9488_60%,#0f766e_100%)] text-on-primary shadow-[0_6px_22px_var(--primary-glow)] hover:brightness-105 hover:-translate-y-px",
        ghost:
          "border border-border bg-transparent text-text hover:border-primary hover:text-primary",
      },
      size: {
        default: "px-4 py-2.5 text-sm",
        sm: "px-3 py-1.5 text-xs",
      },
      fullWidth: {
        true: "w-full",
        false: "",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
      fullWidth: false,
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, fullWidth, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size, fullWidth }), className)}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export { buttonVariants };
