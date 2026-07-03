"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Global safety net for the Radix "stuck `pointer-events: none`" bug.
 *
 * Radix modal overlays (Dialog/AlertDialog, and modal Popover/Select/Dropdown)
 * lock `pointer-events: none` on `<body>` while open and clear it on close. When
 * a dialog closes and immediately triggers `router.refresh()` (many of our save
 * flows do), that cleanup can be interrupted and the lock stays stuck — freezing
 * the ENTIRE page (nav, quick search, tabs, buttons). Because the lock is a DOM
 * style, it also survives client-side navigation, so a page with no dialogs of
 * its own (e.g. the dashboard) stays frozen with no way to self-heal.
 *
 * This mounts once in the app shell and clears a stuck lock on first load and on
 * every route change — but only when no Radix overlay is actually open, so it
 * never unlocks the background behind a genuinely-open modal or dropdown.
 */
export function PointerEventsGuard() {
  const pathname = usePathname();

  useEffect(() => {
    if (document.body.style.pointerEvents !== "none") return;
    const overlayOpen = document.querySelector(
      '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [data-radix-popper-content-wrapper]',
    );
    if (!overlayOpen) {
      document.body.style.pointerEvents = "";
    }
  }, [pathname]);

  return null;
}
