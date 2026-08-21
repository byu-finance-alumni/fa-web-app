"use client";

import { usePathname, useRouter } from "next/navigation";

/**
 * "Back" — one step, on the data-entry screens only.
 *
 * ⚠️ IT ADDS NO HEIGHT. The wrapper is `h-0` and the button is absolutely
 * positioned out of it, into the top padding the page below already has (`p-6`
 * on a profile). Laid out in flow it was a full-width row between the photo and
 * the content, and since the shell is `bg-canvas` and the pages are `bg-gray-100`
 * that empty row read as a pale bar across the window — the strip WAS the
 * problem, not something behind it.
 *
 * `left-6` and `top-1` are chosen against that `p-6`: 24px in, so it lines up
 * with the content's left edge, and 4px down, so its 20px height clears the
 * 24px of padding without ever touching what the page renders.
 *
 * WHY IT EXISTS. Moving navigation into the photo bar took the per-page
 * `Topbar` with it, and the breadcrumb went too. On a form you opened from
 * somewhere else, that trail was the only thing telling you how to leave without
 * saving.
 *
 * ⚠️ WHERE IT SHOWS — FORMS, NOT EVERY DEEP ROUTE (Jake, 2026-08-21). It first
 * appeared anywhere the path ran deeper than its nav entry, which put it on
 * browse screens like /alumni/842 and /map/state/UT that already read as
 * destinations and did not want one. The rule is now the screens you go to in
 * order to ENTER something and then leave: edit, new, and import.
 *
 * Still derived from the path rather than listed, so /alumni/[id]/edit/personal
 * and a future /events/[id]/edit/whatever are covered without anybody
 * remembering to add them. If a form ever lands on a path that does not end in
 * one of these words, this is the line to extend — a listed route table is the
 * thing to avoid, since it silently omits new screens.
 *
 * ⚠️ IT IS `router.back()`, NOT a link to the parent — which is what "take you
 * back one page" means and is usually right, but is worth knowing: it returns to
 * wherever you actually came from, so arriving on a profile from a pasted URL
 * leaves it doing whatever the browser's history does, and arriving from a
 * search returns you to that search with its filters intact (the reason to
 * prefer it over a hard link to /alumni).
 */
/**
 * The rule, exported so it can be checked against the app's real routes rather
 * than restated in a test — a test that reimplements this predicate passes no
 * matter what it says.
 *
 * A SEGMENT test, not `endsWith`: `/alumni/842/edit/personal` is still the edit
 * form, and so are the five other sections beside it.
 */
export function shouldShowBack(pathname: string): boolean {
  return pathname
    .split("/")
    .filter(Boolean)
    .some((s) => s === "edit" || s === "new" || s === "import");
}

export function BackLink() {
  const pathname = usePathname();
  const router = useRouter();

  if (!pathname || !shouldShowBack(pathname)) return null;

  return (
    <div className="relative z-20 h-0">
      <button
        type="button"
        onClick={() => router.back()}
        className="absolute left-6 top-1 whitespace-nowrap text-sm font-medium text-brand-blue-600 transition hover:text-brand-blue-500"
      >
        Back
      </button>
    </div>
  );
}
