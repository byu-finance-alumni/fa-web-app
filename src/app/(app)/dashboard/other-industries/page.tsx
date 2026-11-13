import Link from "next/link";
import { apiGet, ApiError } from "@/lib/api";
import { Topbar } from "@/components/shell/Topbar";
import { TopbarSearch } from "@/components/shared/TopbarSearch";
import { LoadError } from "@/components/shared/LoadError";
import {
  OTHER_LIST_HREF,
  otherIndustryHref,
  type OtherIndustries,
} from "@/lib/otherIndustries";

/**
 * The dashboard industry chart's "Other" bar, opened up (fa-web-app#936): the
 * people in it grouped by SECONDARY industry, highest count first, each row
 * linking to the alumni list of exactly those people.
 *
 * The rows are built by the backend from the data each time — a secondary
 * industry nobody has used before simply appears as a new row — and spellings
 * of one name are folded together there ("Healthcare - Biotech" and "healthcare
 * services" count as Healthcare). The rows add up to the Other bar.
 */
// The Outreach list tables' link styling (OutreachListLinks), so this page
// reads like the Event Speakers lists.
const LINK_CLASS =
  "font-semibold text-brand-blue-600 underline-offset-4 hover:text-brand-blue-500 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500";
const COUNT_CLASS = "ml-2 font-normal tabular-nums text-gray-500";

export default async function OtherIndustriesPage() {
  let data: OtherIndustries | null = null;
  let error: ApiError | null = null;
  try {
    data = await apiGet<OtherIndustries>("/dashboard/other-industries", {
      revalidate: 60,
      tags: ["dashboard"],
    });
  } catch (e) {
    error =
      e instanceof ApiError
        ? e
        : new ApiError(0, "Failed to load the Other industries.");
  }

  return (
    <>
      <Topbar title="Other industries">
        <TopbarSearch />
      </Topbar>
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="space-y-5">
          <Link
            href="/dashboard"
            className="text-sm text-brand-blue-600 hover:underline"
          >
            Back to dashboard
          </Link>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900">
            Other industries
          </h1>

          {error ? (
            <LoadError status={error.status} noun="the Other industries" />
          ) : data ? (
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-card">
              <table className="w-full table-fixed text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <th className="bg-gray-50 px-3 py-2.5">
                      Secondary industries
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.length === 0 ? (
                    <tr>
                      <td className="px-3 py-2.5 text-gray-500">
                        No alumni are in Other right now.
                      </td>
                    </tr>
                  ) : (
                    <>
                      <tr className="border-b border-gray-200">
                        <td className="px-3 py-2.5">
                          <Link href={OTHER_LIST_HREF} className={LINK_CLASS}>
                            All Other
                            <span className={COUNT_CLASS}>
                              ({data.total.toLocaleString("en-US")})
                            </span>
                          </Link>
                        </td>
                      </tr>
                      {data.rows.map((row) => (
                        <tr
                          key={row.no_secondary ? "__none__" : row.group}
                          className="border-b border-gray-200 last:border-0 even:bg-gray-50/50"
                        >
                          <td className="px-3 py-2.5">
                            <Link
                              href={otherIndustryHref(row)}
                              className={
                                row.no_secondary
                                  ? `${LINK_CLASS} italic`
                                  : LINK_CLASS
                              }
                            >
                              {row.name}
                              <span className={COUNT_CLASS}>
                                ({row.count.toLocaleString("en-US")})
                              </span>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </main>
    </>
  );
}
