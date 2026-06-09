"use client";

import { useState } from "react";
import { X } from "lucide-react";

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
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-brand-blue-600 hover:text-brand-blue-500"
      >
        {triggerLabel}
      </button>
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
            <div className="flex items-center justify-between gap-3 border-b border-gray-300 bg-white p-5">
              <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
              <div className="flex items-center gap-2">
                {action}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="rounded-lg border border-gray-300 bg-white p-1.5 text-gray-500 hover:bg-gray-50"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-5">
              <div className="rounded-xl border border-gray-300 bg-white p-4">
                {children}
              </div>
            </div>
          </aside>
        </>
      ) : null}
    </>
  );
}
