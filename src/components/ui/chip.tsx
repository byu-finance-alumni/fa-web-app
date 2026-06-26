"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Chip — a pill-shaped filter / quick-action control. Used for the filter chips
 * above tables (industry, grad year, region), dashboard quick filters, and
 * activity/event type filters. Render as a Link with `asChild` for deep-link
 * filters, or as a button for toggles. `active` shows the selected state.
 */
const chipVariants = cva(
  "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-3.5",
  {
    variants: {
      active: {
        true: "border-brand-blue-600 bg-brand-blue-600 text-white hover:bg-brand-blue-500",
        false:
          "border-gray-300 bg-white text-gray-700 hover:border-brand-blue-300 hover:bg-brand-blue-50/60",
      },
    },
    defaultVariants: { active: false },
  },
);

export interface ChipProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "value">,
    VariantProps<typeof chipVariants> {
  asChild?: boolean;
}

const Chip = React.forwardRef<HTMLButtonElement, ChipProps>(
  ({ className, active, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(chipVariants({ active }), className)}
        {...props}
      />
    );
  },
);
Chip.displayName = "Chip";

export { Chip, chipVariants };
