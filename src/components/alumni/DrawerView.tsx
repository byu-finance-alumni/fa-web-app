"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * A "View all" trigger that opens a right-side slide-out drawer with arbitrary
 * content. Used for panels whose content isn't a simple list (e.g. the
 * Engagement & tags chip groups).
 */
export function DrawerView({
  title,
  triggerLabel = "View all",
  children,
  action,
}: {
  title: string;
  triggerLabel?: string;
  children: React.ReactNode;
  /** Optional control rendered in the drawer header (e.g. an "Add" button). */
  action?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="link"
        size="sm"
        className="px-0"
        onClick={() => setOpen(true)}
      >
        {triggerLabel}
      </Button>
      {open ? (
        <>
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-30 cursor-default bg-navy-900/30"
          />
          <aside
            role="dialog"
            aria-label={title}
            className="fixed inset-y-0 right-0 z-40 flex w-full flex-col bg-gray-100 shadow-xl sm:w-[440px]"
          >
            <div className="flex items-center justify-between gap-3 border-b border-gray-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
              <div className="flex items-center gap-2">
                {action}
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-5">
              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-card">
                {children}
              </div>
            </div>
          </aside>
        </>
      ) : null}
    </>
  );
}
