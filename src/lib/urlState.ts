/**
 * Mirroring on-screen state into the address bar (fa-web-app#944).
 *
 * The profile's Back button returns to the URL a profile link was clicked on
 * (`?from=`, see `returnTo.ts`). Anything a page keeps ONLY in React state — an
 * open drawer, a selected year, a chosen tab — is not in that URL, so Back
 * landed on the right page in the wrong state: the drawer shut, the year reset,
 * the list gone. Pages that open profiles from such state write it into the
 * query string with `replaceUrlParams` and read it back on load.
 *
 * `replaceState`, not a router navigation: nothing is fetched or re-rendered on
 * the server, and no history entry is added, so the browser's own Back still
 * leaves the page in one step. Next keeps `useSearchParams` in sync with it.
 */

/** `search` ("?a=1" or "a=1" or "") with `updates` applied — a string sets the
 *  key, null or "" removes it. Returns "?…", or "" when nothing is left. */
export function withSearchUpdates(
  search: string,
  updates: Readonly<Record<string, string | null | undefined>>,
): string {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  for (const [key, value] of Object.entries(updates)) {
    if (value == null || value === "") params.delete(key);
    else params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/** Apply `updates` to the current URL's query without navigating. A no-op on
 *  the server and when nothing would change. */
export function replaceUrlParams(
  updates: Readonly<Record<string, string | null | undefined>>,
): void {
  if (typeof window === "undefined") return;
  const { pathname, search, hash } = window.location;
  const next = withSearchUpdates(search, updates);
  if (next === search || (next === "" && search === "?")) return;
  // `null` state, per Next's docs: its patched replaceState merges its own
  // router state in, and passing the current state back would skip the sync
  // that keeps `useSearchParams` current.
  window.history.replaceState(null, "", `${pathname}${next}${hash}`);
}
