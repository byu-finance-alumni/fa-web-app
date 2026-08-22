import { SignOutButton } from "@/components/auth/SignOutButton";
import { DesktopPageRow } from "@/components/shell/DesktopPageRow";
import { type Crumb } from "@/components/ui/Breadcrumb";

export function Topbar({
  title,
  breadcrumb,
  children,
}: {
  /** Plain page title — used by top-level section pages (no breadcrumb).
   *  Omit BOTH this and `breadcrumb` when the page carries its own identity in
   *  the content area (the Dashboard's hero band does). The leading grid cell is
   *  still emitted in that case — the bar is a three-column grid with equal
   *  `1fr` sides, and dropping the element would slide `children` and Sign out
   *  a column to the left. */
  title?: string;
  /**
   * ⚠️ NO LONGER RENDERED AS A TRAIL (Jake, 2026-08-22 — "i dont like the
   * breadcrumps"). Its LAST item becomes the plain page title instead, which is
   * why the prop is still here and why all ~55 call sites are untouched: they
   * already describe where they are, and the last crumb is the best short name
   * for the page ("Alec Dent", "Import", "Edit").
   *
   * Kept as `Crumb[]` rather than collapsed to a string at the call sites so
   * restoring the trail is one component away, and so a page that gains a level
   * does not have to re-derive its own title.
   */
  breadcrumb?: Crumb[];
  children?: React.ReactNode;
}) {
  // TWO SHAPES, because the photo bar replaces this on desktop and nothing
  // replaces it on a phone.
  //
  // PHONES (`md:hidden`): the original white bar, untouched. Below `md` the top
  // nav does not render and the sidebar never did, so this is the ONLY thing
  // carrying Sign out — blanking it took the only way off a phone.
  //
  // DESKTOP: usually NOTHING — see `DesktopPageRow`, which renders a row only
  // when there is a Back button or a `children` control to put in it. A strip
  // holding just a page title was still a pale band under the photo, which is
  // what "remove the white bar on the alumni page" was about (2026-08-22).
  //
  // The title survives on phones only, where this bar is not replaced by
  // anything. `heading` is still derived here because that bar uses it.
  // ONE heading, derived once so the two bars can never disagree. An explicit
  // `title` wins; otherwise the deepest crumb is the page's own name.
  const heading = title ?? breadcrumb?.at(-1)?.label;

  return (
    <>
      <header className="grid h-16 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-gray-300 bg-white px-4 md:hidden">
        {heading ? (
          <h1 className="truncate text-base font-semibold text-gray-900">
            {heading}
          </h1>
        ) : (
          /* Titleless bar: an empty cell holds the column open. Never an empty
             <h1> — a screen reader would announce a nameless heading. */
          <div aria-hidden="true" />
        )}
        <div className="flex items-center justify-center">{children}</div>
        <div className="flex items-center justify-end gap-3">
          <SignOutButton />
        </div>
      </header>

      <DesktopPageRow>{children}</DesktopPageRow>
    </>
  );
}
