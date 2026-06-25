"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Button — the single source of truth for actionable controls. Replaces the 8+
 * hand-rolled button styles found across the app. Tokens/radii/heights follow
 * UX-UI.md: one control height (h-9), one focus ring, `rounded-md`.
 */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Primary brand action — one per view.
        primary:
          "bg-brand-blue-600 text-white hover:bg-brand-blue-500 active:bg-brand-blue-600",
        // Secondary — white surface with gray border.
        secondary:
          "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 active:bg-gray-100",
        // Destructive — archive/delete/merge.
        destructive: "bg-danger-600 text-white hover:bg-danger-600/90",
        // Navy — strong dark action (used sparingly on light surfaces).
        navy: "bg-navy-800 text-white hover:bg-navy-700",
        // Ghost — low-emphasis icon/text button.
        ghost: "text-gray-700 hover:bg-gray-100 hover:text-gray-900",
        // Link — inline text action.
        link: "text-brand-blue-600 underline-offset-4 hover:text-brand-blue-500 hover:underline",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        default: "h-9 px-4",
        lg: "h-10 px-5",
        icon: "h-9 w-9 px-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Render as the child element (e.g. a Next.js `<Link>`) via Radix Slot. */
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
