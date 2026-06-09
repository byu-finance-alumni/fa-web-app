"use client";

import { Children, useState } from "react";
import { X } from "lucide-react";

/**
 * Shows the first `collapsed` list rows inline; when there are more, a
 * "View all (N)" button opens a right-side slide-out drawer with the full list.
 * Children are the pre-rendered <li> rows (passed from the server component).
 * Used by the profile's Employment history and Recent events panels.
 */
export function DrawerList({
  title,
  children,
  collapsed = 3,
  listClassName,
  ordered = false,
  action,
}: {
  title: string;
  children: React.ReactNode;
  collapsed?: number;
  listClassName?: string;
  ordered?: boolean;
  /** Optional control rendered in the drawer header (e.g. an "Add" button). */
  action?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const items = Children.toArray(children);
  const shown = items.slice(0, collapsed);
  const remaining = items.length - collapsed;
  const List = (ordered ? "ol" : "ul") as "ol" | "ul";

  return (
    <>
      <List className={listClassName}>{shown}</List>
      {remaining > 0 ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-2 text-sm font-medium text-brand-blue-600 hover:text-brand-blue-500"
        >
          View all {items.length}
        </button>
      ) : null}

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
                <List className={listClassName}>{items}</List>
              </div>
            </div>
          </aside>
        </>
      ) : null}
    </>
  );
}
