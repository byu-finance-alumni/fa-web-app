"use client";

import { usePathname } from "next/navigation";
import { BackLink, shouldShowBack } from "@/components/shell/BackLink";

/**
 * The desktop row above a page — and, most of the time, NOTHING AT ALL.
 *
 * ⚠️ IT MUST NOT RENDER AN EMPTY STRIP. That is the whole reason this is a
 * component and not four Tailwind classes in `Topbar`. The band under the photo
 * has now been removed three times: first as the white `Topbar`, then as the
 * zero-height Back overlay, then as the heading line that replaced the
 * breadcrumb ("remove the white bar on the alumni page", 2026-08-22). Every
 * time, what read as a bar was an element with padding and no content — the
 * shell is `bg-canvas`, so any full-width strip between the dark photo and the
 * page shows up as a pale band whether or not anything is drawn in it.
 *
 * So the row exists for ONE reason: a BACK button, on the data-entry screens
 * (`shouldShowBack`). On everything else this returns null and the page starts
 * immediately under the photo, which is what the bar was in the way of.
 *
 * ⚠️ `children` IS NOT RENDERED HERE (2026-08-22). Two pages — the alumni
 * profile and Admin — pass a `TopbarSearch` into that slot, and on a profile it
 * produced exactly the band this component exists to prevent: a full-width strip
 * holding one search box. The nav bar now carries a search of its own, on every
 * page, so the per-page one was a second box doing the same job while costing a
 * bar to sit in.
 *
 * The slot still renders on PHONES (see `Topbar`), where the nav bar does not
 * exist and that search is the only one available. So the prop stays and the
 * call sites are untouched.
 *
 * THE PAGE TITLE IS GONE FROM DESKTOP, deliberately. The nav bar says which
 * section you are in, and the pages say what they are in their own content;
 * a title repeated in a strip was the last thing keeping the strip alive.
 * Phones still show it — see `Topbar`, where nothing replaces that bar.
 */
export function DesktopPageRow() {
  const pathname = usePathname();
  if (!pathname || !shouldShowBack(pathname)) return null;

  return (
    <div className="hidden shrink-0 items-center gap-4 px-6 pb-1 pt-4 md:flex">
      <BackLink />
    </div>
  );
}
