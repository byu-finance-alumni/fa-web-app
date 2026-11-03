import Link from "next/link";
import {
  outreachListHref,
  type OutreachGroupKey,
  type OutreachListLink,
} from "@/lib/outreach";

/**
 * An Outreach landing page's report links, one per row, each with its count —
 * the NetTreks landing table's styling. Titles and counts come from the
 * backend, so the words here cannot drift from the list they open.
 */
export function OutreachListLinks({
  group,
  links,
  heading,
  emptyLabel = "Nobody is on these lists yet.",
}: {
  group: OutreachGroupKey;
  links: OutreachListLink[];
  heading: string;
  emptyLabel?: string;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-card">
      <table className="w-full table-fixed text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <th className="bg-gray-50 px-3 py-2.5">{heading}</th>
          </tr>
        </thead>
        <tbody>
          {links.length === 0 ? (
            <tr>
              <td className="px-3 py-2.5 text-gray-500">{emptyLabel}</td>
            </tr>
          ) : (
            links.map((link) => (
              <tr
                key={`${link.key}:${link.industry ?? ""}`}
                className="border-b border-gray-200 last:border-0 even:bg-gray-50/50"
              >
                <td className="px-3 py-2.5">
                  <Link
                    href={outreachListHref(group, link.key, link.industry)}
                    className="font-semibold text-brand-blue-600 underline-offset-4 hover:text-brand-blue-500 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500"
                  >
                    {link.title}
                    <span className="ml-2 font-normal tabular-nums text-gray-500">
                      ({link.count.toLocaleString("en-US")})
                    </span>
                  </Link>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
