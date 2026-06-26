"use client";

import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Sheet — slide-out side panel (drawer) built on Radix Dialog: focus-trap,
 * Esc-to-close, scroll-lock. Replaces the hand-rolled drawers. Default side
 * `right`. Use <SheetContent title> for a titled drawer with a close button.
 */
const Sheet = SheetPrimitive.Root;
const SheetTrigger = SheetPrimitive.Trigger;
const SheetClose = SheetPrimitive.Close;
const SheetPortal = SheetPrimitive.Portal;

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-40 bg-navy-900/30 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
      className,
    )}
    {...props}
  />
));
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName;

const sheetVariants = cva(
  "fixed z-50 flex flex-col bg-gray-100 shadow-xl transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-200 data-[state=open]:duration-300",
  {
    variants: {
      side: {
        right:
          "inset-y-0 right-0 h-full w-full border-l border-gray-200 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-md",
        left: "inset-y-0 left-0 h-full w-full border-r border-gray-200 data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-md",
      },
    },
    defaultVariants: { side: "right" },
  },
);

interface SheetContentProps
  extends Omit<
      React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
      "title"
    >,
    VariantProps<typeof sheetVariants> {
  title?: React.ReactNode;
}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(({ side = "right", className, title, children, ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <SheetPrimitive.Content
      ref={ref}
      className={cn(sheetVariants({ side }), className)}
      {...props}
    >
      {title !== undefined ? (
        <div className="flex items-start justify-between gap-3 border-b border-gray-200 bg-white p-5">
          <SheetPrimitive.Title className="min-w-0 truncate text-base font-semibold text-gray-900">
            {title}
          </SheetPrimitive.Title>
          <SheetPrimitive.Close
            aria-label="Close"
            className="rounded-md border border-gray-200 bg-white p-1.5 text-gray-500 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500"
          >
            <X className="h-4 w-4" />
          </SheetPrimitive.Close>
        </div>
      ) : null}
      {children}
    </SheetPrimitive.Content>
  </SheetPortal>
));
SheetContent.displayName = SheetPrimitive.Content.displayName;

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetPortal,
  SheetOverlay,
};
