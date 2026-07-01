"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Dialog — centered modal (Radix): focus-trap, Esc-to-close, scroll-lock built
 * in. Replaces the hand-rolled overlay+panel modals. Use <DialogContent title>
 * for a titled modal with a close button.
 */
/**
 * Wrap Radix's Root to defensively clear the `pointer-events: none` that Radix
 * locks onto `<body>` while a modal is open. Several dialogs call
 * `router.refresh()` the instant they close (on a successful save); that server
 * re-render can race Radix's own cleanup and leave the lock stuck — making the
 * ENTIRE page unclickable ("everything is disabled"). Clearing it shortly after
 * close is a safe no-op when Radix already cleaned up, and un-sticks the page
 * when it didn't.
 */
function Dialog({
  onOpenChange,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Root>) {
  return (
    <DialogPrimitive.Root
      onOpenChange={(open) => {
        onOpenChange?.(open);
        if (!open && typeof document !== "undefined") {
          // Run after Radix's close handling + any router.refresh() settle. Only
          // clear when no other Radix dialog is still open, so a stacked dialog
          // never unlocks its own backdrop.
          window.setTimeout(() => {
            const stillOpen = document.querySelector(
              '[role="dialog"][data-state="open"]',
            );
            if (!stillOpen && document.body.style.pointerEvents === "none") {
              document.body.style.pointerEvents = "";
            }
          }, 250);
        }
      }}
      {...props}
    />
  );
}
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;
const DialogPortal = DialogPrimitive.Portal;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-navy-900/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

interface DialogContentProps
  extends Omit<
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
    "title"
  > {
  /** Visible + a11y title rendered in the header with a close button. */
  title?: React.ReactNode;
  description?: React.ReactNode;
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, title, description, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-full max-w-md -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg",
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
        className,
      )}
      {...props}
    >
      {title !== undefined ? (
        <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-4">
          <div className="min-w-0">
            <DialogPrimitive.Title className="text-sm font-semibold text-gray-900">
              {title}
            </DialogPrimitive.Title>
            {description !== undefined ? (
              <DialogPrimitive.Description className="mt-0.5 text-xs text-gray-500">
                {description}
              </DialogPrimitive.Description>
            ) : null}
          </div>
          <DialogPrimitive.Close
            aria-label="Close"
            className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500"
          >
            <X className="h-4 w-4" />
          </DialogPrimitive.Close>
        </div>
      ) : null}
      {children}
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

/** Scrollable body region for dialog content. */
function DialogBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("overflow-auto px-5 py-4", className)} {...props} />;
}

/** Footer action row, divided from the body. */
function DialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-2 border-t border-gray-200 px-5 py-3",
        className,
      )}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogBody,
  DialogFooter,
  DialogPortal,
  DialogOverlay,
};
