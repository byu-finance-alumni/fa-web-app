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
