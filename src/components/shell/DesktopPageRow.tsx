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
 * So the row exists only when it has something to hold:
 *
 *   * a BACK button, on the data-entry screens (`shouldShowBack`); or
 *   * `children`, the slot a couple of pages fill with their own control.
 *
 * On everything else this returns null and the page starts immediately under
 * the photo, which is what the bar was in the way of.
 *
 * THE PAGE TITLE IS GONE FROM DESKTOP, deliberately. The nav bar says which
 * section you are in, and the pages say what they are in their own content;
 * a title repeated in a strip was the last thing keeping the strip alive.
 * Phones still show it — see `Topbar`, where nothing replaces that bar.
 */
export function DesktopPageRow({ children }: { children?: React.ReactNode }) {
  const pathname = usePathname();
  const back = Boolean(pathname && shouldShowBack(pathname));

  if (!back && !children) return null;

  return (
    <div className="hidden shrink-0 items-center gap-4 px-6 pb-1 pt-4 md:flex">
      {back ? <BackLink /> : null}
      {children ? <div className="ml-auto flex items-center">{children}</div> : null}
    </div>
  );
}
