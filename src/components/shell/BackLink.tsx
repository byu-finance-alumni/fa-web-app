"use client";

import { usePathname, useRouter } from "next/navigation";
import { resolveActiveHref } from "@/components/shell/nav";

/**
 * "Back" — one step, on any screen you had to click into to reach.
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
 * `Topbar` with it, and the breadcrumb went too. On a top-level destination that
 * costs nothing — the bar itself says where you are. On a screen you drilled
 * into, an alumni profile say, the trail was the only thing telling you how to
 * get back, and losing it silently is worse than the white bar it replaced.
 *
 * WHERE IT SHOWS. Only where the route is DEEPER than the nav entry that
 * matched it: `resolveActiveHref` maps /alumni/842 back to /alumni, so the two
 * differ exactly when you are below a destination. /alumni gets no button;
 * /alumni/842 does. That is derived rather than listed, so a new sub-route gets
 * one without anybody remembering to add it.
 *
 * ⚠️ IT IS `router.back()`, NOT a link to the parent — which is what "take you
 * back one page" means and is usually right, but is worth knowing: it returns to
 * wherever you actually came from, so arriving on a profile from a pasted URL
 * leaves it doing whatever the browser's history does, and arriving from a
 * search returns you to that search with its filters intact (the reason to
 * prefer it over a hard link to /alumni).
 */
export function BackLink() {
  const pathname = usePathname();
  const router = useRouter();

  if (!pathname) return null;
  const destination = resolveActiveHref(pathname);
  // No match at all (a route outside the nav) still counts as "deep" — those
  // are the screens most likely to be dead ends.
  if (destination === pathname) return null;

  return (
    <div className="relative z-20 h-0">
      <button
        type="button"
        onClick={() => router.back()}
        className="absolute left-6 top-1 whitespace-nowrap text-sm font-medium text-brand-blue-600 transition hover:text-brand-blue-500"
      >
        &larr; Back
      </button>
    </div>
  );
}
