"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

/**
 * Floating action button (mobile only). A fixed "+" at the bottom-right that
 * expands into a vertical speed-dial of a page's primary actions. The action
 * controls are passed as `children` — each renders its own trigger/dialog, so
 * tapping one opens its flow on top of the dial. Sits above the bottom tab bar
 * and below action dialogs (z-30 < dialog z-50), honoring the safe-area inset.
 */
export function Fab({
  children,
  label = "Actions",
}: {
  children: React.ReactNode;
  /** Accessible label for the collapsed button. */
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="md:hidden">
      {open ? (
        <button
          type="button"
          aria-label="Close actions"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-navy-900/20"
        />
      ) : null}

      <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 z-30 flex flex-col items-end gap-2">
        {open ? (
          <div className="flex flex-col items-end gap-2">{children}</div>
        ) : null}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "Close actions" : label}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-blue-600 text-white shadow-lg transition-colors hover:bg-brand-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500 focus-visible:ring-offset-2"
        >
          <Plus
            className={`h-6 w-6 transition-transform ${open ? "rotate-45" : ""}`}
            aria-hidden="true"
          />
        </button>
      </div>
    </div>
  );
}
