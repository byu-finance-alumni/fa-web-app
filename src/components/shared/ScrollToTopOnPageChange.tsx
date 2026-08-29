"use client";

import { useEffect } from "react";

/**
 * Jump back to the top of the list when the page of results changes.
 *
 * Paging is a `<Link>` to the same route with a different `offset`. The App
 * Router treats that as the same page rather than a new one, so it leaves the
 * scroll position alone — landing you at the BOTTOM of the next page, looking
 * at its last row.
 *
 * ⚠️ **The document does not scroll in this app.** Every `(app)` page renders
 * its own `<main className="flex-1 overflow-auto">` inside a shell column that
 * is `[overflow:clip]`, so the scrollbar belongs to that `<main>` — not to the
 * window. `window.scrollTo` alone is a silent no-op here, which is exactly how
 * the first attempt at this shipped to prod and did nothing. Both are scrolled
 * below: whichever one is not the scroller is already at 0, so it costs nothing.
 *
 * Deliberately has **no "did it actually change" guard**. A ref initialised at
 * mount would be defeated if the App Router ever remounts this subtree on
 * navigation, and the guard buys nothing: a fresh page load already starts at
 * the top, so scrolling to the top on mount is a no-op rather than a jump.
 */
export function ScrollToTopOnPageChange({ offset }: { offset: number }) {
  useEffect(() => {
    // Instant, not smooth: the rows have already been replaced, so animating a
    // long scroll travels past content that is no longer what you asked for.
    document.querySelector("main")?.scrollTo({ top: 0, behavior: "auto" });
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [offset]);

  return null;
}
