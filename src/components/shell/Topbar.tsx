import { SignOutButton } from "@/components/auth/SignOutButton";
import { BackLink } from "@/components/shell/BackLink";
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
  // DESKTOP (`md:flex`): a heading LINE, not a bar. No background, no border, no
  // fixed height — the white strip between the photo and the page was the whole
  // complaint, and it was the bar's surface, not its contents. The contents are
  // worth keeping: on a screen you drilled into, the breadcrumb is the only
  // thing saying where you are, and losing it silently was the cost of moving
  // navigation into the photo (#737).
  //
  // Sign out is dropped here — the nav bar carries it, and two on one screen was
  // the bug that took the hero's copy out.
  //
  // ⚠️ BACK LIVES IN THIS ROW, not in the shell. It used to be a zero-height
  // overlay hanging in the page's own top padding, which worked only while
  // nothing else was there; this line lands in exactly that space. Every route
  // that shows a Back — edit, new, import — renders a Topbar (checked, all ten),
  // so the button keeps its full coverage and now sits ON the same line as the
  // trail instead of on top of it.
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

      <div className="hidden shrink-0 items-center gap-4 px-6 pb-1 pt-4 md:flex">
        <BackLink />
        {heading ? (
          <h1 className="truncate text-base font-semibold text-gray-900">
            {heading}
          </h1>
        ) : null}
        {children ? <div className="ml-auto flex items-center">{children}</div> : null}
      </div>
    </>
  );
}
