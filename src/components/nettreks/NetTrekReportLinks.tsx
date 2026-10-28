import Link from "next/link";
import { Card } from "@/components/ui/card";
import {
  netTrekReportHref,
  type NetTrekAreaSummary,
  type NetTrekReportCount,
} from "@/lib/nettreks";

/**
 * The NetTreks landing list (#887): one row per area, each with its
 * "<Area> NetTrek Hosts" and "<Area> Area Alumni" links and their counts.
 * Other has only a Hosts link. Titles and counts come from the backend, so
 * the words here cannot drift from the report they open.
 */
export function NetTrekReportLinks({ areas }: { areas: NetTrekAreaSummary[] }) {
  return (
    <Card className="overflow-hidden p-0">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <th className="px-4 py-2.5">Area</th>
            <th className="px-4 py-2.5">NetTrek hosts</th>
            <th className="px-4 py-2.5">Area alumni</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {areas.map((area) => (
            <tr key={area.key}>
              <td className="px-4 py-3 font-medium text-gray-900">{area.name}</td>
              <td className="px-4 py-3">
                <ReportLink area={area} report={area.hosts} />
              </td>
              <td className="px-4 py-3">
                {area.area_alumni ? (
                  <ReportLink area={area} report={area.area_alumni} />
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function ReportLink({
  area,
  report,
}: {
  area: NetTrekAreaSummary;
  report: NetTrekReportCount;
}) {
  return (
    <Link
      href={netTrekReportHref(area.key, report.kind)}
      className="font-semibold text-brand-blue-600 underline-offset-4 hover:text-brand-blue-500 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500"
    >
      {report.title}
      <span className="ml-2 font-normal tabular-nums text-gray-500">
        ({report.count.toLocaleString("en-US")})
      </span>
    </Link>
  );
}
