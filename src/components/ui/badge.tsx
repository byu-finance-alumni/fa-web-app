import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Badge — status labels, tags, and chips. Colors map to UX-UI.md semantics:
 * tag (brand-blue), neutral, success, warning, danger, muted
 * (archived/deceased), solid.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full font-medium leading-none whitespace-nowrap",
  {
    variants: {
      variant: {
        tag: "bg-brand-blue-50 text-navy-800",
        neutral: "bg-gray-100 text-gray-700",
        success: "bg-success-50 text-success-600",
        warning: "bg-warning-50 text-warning-600",
        danger: "bg-danger-50 text-danger-600",
        muted: "bg-gray-100 text-gray-500",
        solid: "bg-brand-blue-600 text-white",
      },
      size: {
        sm: "px-1.5 py-0.5 text-[11px]",
        default: "px-2 py-0.5 text-xs",
      },
    },
    defaultVariants: {
      variant: "neutral",
      size: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <span
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
