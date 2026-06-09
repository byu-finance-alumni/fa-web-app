import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type Crumb = {
  label: string;
  /** Omit on the last (current) crumb — it renders as plain text, not a link. */
  href?: string;
};

/**
 * Breadcrumb trail shown in the top bar on every screen below the top level
 * (UX-UI.md §Layout). Ancestor crumbs are blue-600 links; the last crumb is the
 * current page (gray-900, not a link); separators are the Lucide chevron-right.
 */
export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex items-center gap-1.5 text-sm">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex min-w-0 items-center gap-1.5">
              {item.href && !last ? (
                <Link
                  href={item.href}
                  className="font-medium text-brand-blue-600 hover:text-brand-blue-500"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className="truncate font-semibold text-gray-900"
                  aria-current={last ? "page" : undefined}
                >
                  {item.label}
                </span>
              )}
              {!last ? (
                <ChevronRight
                  className="h-4 w-4 shrink-0 text-gray-400"
                  aria-hidden="true"
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
