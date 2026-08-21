import { SignOutButton } from "@/components/auth/SignOutButton";
import { Breadcrumb, type Crumb } from "@/components/ui/Breadcrumb";

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
  /** Breadcrumb trail — used by every screen below the top level (UX-UI.md). */
  breadcrumb?: Crumb[];
  children?: React.ReactNode;
}) {
  // EXPERIMENT (experiment/top-nav): PHONES ONLY — `md:hidden`.
  //
  // It used to render at every width. With the photo bar above it on desktop
  // that left a white strip between the two, which is what this branch removed.
  // Blanking it outright was wrong, though: it renders at EVERY width on `dev`,
  // and it is the only thing carrying SIGN OUT below `md` — the sidebar is
  // `hidden md:flex` and the mobile tab bar has four tabs, none of them sign
  // out. Returning null took the only way off a phone with it.
  //
  // So: gone where the photo bar replaces it, kept where nothing does. Phones
  // also keep the page title and breadcrumb this way.
  //
  // ⚠️ ON DESKTOP THE BREADCRUMB AND TITLE ARE STILL GONE, and that is a real
  // loss rather than a tidy-up — on a deep screen the trail was the only thing
  // saying where you are. Making this branch real means moving the title and
  // trail into the photo bar, under the nav row, the way the dashboard's
  // greeting sits there now. `children` (the centred zone some pages fill) is
  // desktop-hidden too — check any page that passed something before judging it.
  return (
    <header className="grid h-16 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-gray-300 bg-white px-4 md:hidden md:px-6">
      {/* Compact top bar renders the title at 16px — see UX-UI.md typography "Known gap". */}
      {breadcrumb ? (
        <Breadcrumb items={breadcrumb} />
      ) : title ? (
        <h1 className="text-base font-semibold text-gray-900">{title}</h1>
      ) : (
        /* Titleless bar: an empty cell holds the column open. Never an empty
           <h1> — a screen reader would announce a nameless heading. */
        <div aria-hidden="true" />
      )}
      {/* Center zone — equal 1fr columns either side keep it truly centered */}
      <div className="flex items-center justify-center">{children}</div>
      <div className="flex items-center justify-end gap-3">
        <SignOutButton />
      </div>
    </header>
  );
}
