import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** The alumni list's header cell, the default for `base`. */
export const TH_BASE = "sticky top-0 z-10 bg-gray-50 px-3 py-2.5";

/** A clickable, server-backed sort header (#495). Shows the active direction; an
 *  inactive-but-sortable header shows a faint up/down affordance. */
export function SortTh({
  label,
  w,
  href,
  active,
  dir,
  align,
  base = TH_BASE,
  title,
}: {
  label: string;
  w: string;
  href: string;
  active: boolean;
  dir: "asc" | "desc";
  align?: "center" | "right";
  base?: string;
  title?: string;
}) {
  const Icon = active ? (dir === "asc" ? ArrowUp : ArrowDown) : ChevronsUpDown;
  return (
    <th
      title={title}
      className={cn(
        base,
        w,
        align === "right" && "text-right",
        align === "center" && "text-center",
      )}
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <Link
        href={href}
        scroll={false}
        className="group inline-flex max-w-full items-center gap-1 align-middle hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500 focus-visible:ring-offset-1"
        title={`Sort by ${label.toLowerCase()}`}
      >
        <span className="truncate">{label}</span>
        <Icon
          className={cn(
            "h-3.5 w-3.5 shrink-0",
            active
              ? "text-brand-blue-600"
              : "text-gray-300 group-hover:text-gray-500",
          )}
          aria-hidden="true"
        />
      </Link>
    </th>
  );
}
