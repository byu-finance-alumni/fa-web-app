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
  // EXPERIMENT (experiment/top-nav): RENDERS NOTHING. Every page below the
  // dashboard still calls <Topbar>, and with the photo bar above it that white
  // strip sat between the two — the thing the dashboard already had removed.
  //
  // ⚠️ THE BREADCRUMB AND THE PAGE TITLE GO WITH IT, and that is a real loss,
  // not a tidy-up: on a deep screen the breadcrumb is the only thing telling you
  // where you are and how to get back. Blanking the component is the cheapest
  // way to see the idea; making it real means moving the title and trail into
  // the photo bar, under the nav row, the way the dashboard's greeting sits
  // there now.
  //
  // `children` (the centred zone some pages fill) disappears too — check any
  // page that passed something before judging this.
  return null;

  return (
    <header className="grid h-16 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-gray-300 bg-white px-4 md:px-6">
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
