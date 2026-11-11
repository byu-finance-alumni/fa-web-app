import Link from "next/link";
import { apiGet, ApiError } from "@/lib/api";
import { Topbar } from "@/components/shell/Topbar";
import { TopbarSearch } from "@/components/shared/TopbarSearch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      <main className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-3xl space-y-4">
          <Link
            href="/dashboard"
            className="text-sm text-brand-blue-600 hover:underline"
          >
            Back to dashboard
          </Link>
          {error ? (
            <LoadError status={error.status} noun="the Other industries" />
          ) : data ? (
            <Card>
              <CardHeader>
                <CardTitle>
                  Other, by secondary industry ({data.total.toLocaleString()})
                </CardTitle>
                <p className="text-sm text-gray-500">
                  Alumni whose primary industry falls under Other on the
                  dashboard, grouped by their secondary industry. Click a row to
                  open those alumni.{" "}
                  <Link
                    href={OTHER_LIST_HREF}
                    className="text-brand-blue-600 hover:underline"
                  >
                    Open all {data.total.toLocaleString()}
                  </Link>
                </p>
              </CardHeader>
              <CardContent>
                {data.rows.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    No alumni are in Other right now.
                  </p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        <th className="py-2 pr-4 font-semibold">
                          Secondary industry
                        </th>
                        <th className="py-2 text-right font-semibold">Alumni</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.rows.map((row) => (
                        <tr
                          key={row.no_secondary ? "__none__" : row.group}
                          className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
                        >
                          <td className="py-2 pr-4">
                            <Link
                              href={otherIndustryHref(row)}
                              className={
                                row.no_secondary
                                  ? "italic text-gray-600 hover:underline"
                                  : "text-brand-blue-700 hover:underline"
                              }
                            >
                              {row.name} ({row.count.toLocaleString()})
                            </Link>
                          </td>
                          <td className="py-2 text-right tabular-nums text-gray-700">
                            {row.count.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </main>
    </>
  );
}
