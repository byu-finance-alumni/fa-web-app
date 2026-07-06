"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Mirror a single search/filter string into the URL query (`?<key>=…`) so it
 * survives back-navigation and is shareable — the consistent, app-wide rule for
 * list/explorer filters (#259).
 *
 * This is the CLIENT-side-filter counterpart to the server-driven list toolbars
 * (AlumniFilters, EventsToolbar, ActivityToolbar, AuditToolbar, TaskFilters),
 * which already mirror their state into the URL inline. Use this hook when the
 * full dataset is already on the client and filtering is done in-memory (e.g.
 * the Users admin list) — it gives that page the same "filters live in the URL"
 * behavior without duplicating the debounce / re-seed bookkeeping.
 *
 * `initial` is the value the server read from the URL for this key and passed
 * down. The returned value is seeded from it and re-seeded whenever it changes
 * from an EXTERNAL navigation (deep link / Back) — never from our own writes
 * mid-typing, so keystrokes are not clobbered. Typing updates the returned value
 * immediately (responsive input) and, after `debounceMs`, `replace()`s the URL
 * with `scroll: false` (the list doesn't jump). `replace` (not `push`) keeps
 * Back returning to the previous page rather than stepping through every
 * keystroke. Clearing to empty writes immediately.
 *
 * Like the toolbars, the hook owns the whole query string for `basePath`; use it
 * on routes where this is the only URL-backed filter.
 */
export function useUrlQueryParam(
  key: string,
  initial: string,
  {
    basePath,
    debounceMs = 300,
  }: { basePath: string; debounceMs?: number },
): [string, (next: string) => void] {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  // The value of the last URL WE wrote — distinguishes our own replace() from an
  // external URL change (deep link / Back), so re-seeding never fights typing.
  const lastPushedRef = useRef(initial);

  // Live write-through: debounce typing, skip no-ops. Clearing applies at once so
  // the list resets without waiting out the debounce.
  useEffect(() => {
    if (value === lastPushedRef.current) return;
    const write = () => {
      lastPushedRef.current = value;
      const params = new URLSearchParams();
      if (value.trim()) params.set(key, value.trim());
      const qs = params.toString();
      router.replace(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
    };
    if (value.trim() === "") {
      write();
      return;
    }
    const timer = setTimeout(write, debounceMs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Re-seed only when the URL changed from outside — never from our own pushes.
  useEffect(() => {
    if (initial !== lastPushedRef.current) {
      lastPushedRef.current = initial;
      setValue(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  return [value, setValue];
}
