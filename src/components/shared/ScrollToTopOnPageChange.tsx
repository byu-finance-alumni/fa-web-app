"use client";

import { useEffect, useRef } from "react";

/**
 * Jump back to the top of the document when the page of a paginated list
 * changes.
 *
 * Paging is a `<Link>` to the same route with a different `offset`, and the App
 * Router treats that as the same page rather than a new one, so it leaves the
 * scroll position alone. On a full page of rows that lands you at the BOTTOM of
 * the next page, looking at its last row, having to scroll up to read the first
 * one.
 *
 * Driven by the `offset` PROP rather than `useSearchParams` on purpose: the
 * value is already known on the server, so this stays a leaf that re-renders
 * with its parent instead of forcing a Suspense boundary onto the page.
 *
 * The initial render is deliberately a no-op — arriving on a list with an
 * `offset` already in the URL (a deep link, a bookmark, the back button)
 * should not yank the viewport.
 */
export function ScrollToTopOnPageChange({ offset }: { offset: number }) {
  const previous = useRef(offset);

  useEffect(() => {
    if (previous.current === offset) return;
    previous.current = offset;
    // Instant, not smooth: the rows have already been replaced, so animating a
    // long list scrolls past content that is no longer the content you asked for.
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [offset]);

  return null;
}
