import Link from "next/link";
import type { components } from "@/types/api.gen";

type RadiusAlumniRow = components["schemas"]["RadiusAlumniRow"];

const dash = <span className="text-gray-300">—</span>;

/**
 * Results table for the radius search. Rows arrive already sorted nearest-first
 * by the API. Compact rows, gray-50 sticky header, hover highlight — matches
 * AlumniTable styling. A simple table (not AlumniTable) because RadiusAlumniRow
 * has a different shape (flat name + distance column).
 */
export function RadiusResultsTable({ items }: { items: RadiusAlumniRow[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <th className="sticky top-0 z-10 bg-gray-50 px-4 py-2.5">Name</th>
            <th className="sticky top-0 z-10 bg-gray-50 px-4 py-2.5">City</th>
            <th className="sticky top-0 z-10 w-16 bg-gray-50 px-4 py-2.5">
              State
            </th>
            <th className="sticky top-0 z-10 w-20 bg-gray-50 px-4 py-2.5 text-right">
              Grad
            </th>
            <th className="sticky top-0 z-10 bg-gray-50 px-4 py-2.5">
              Current employer
            </th>
            <th className="sticky top-0 z-10 bg-gray-50 px-4 py-2.5">
              Current title
            </th>
            <th className="sticky top-0 z-10 w-28 bg-gray-50 px-4 py-2.5 text-right">
              Distance (mi)
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((r) => (
            <tr
              key={r.alumni_id}
              className="border-b border-gray-200 last:border-0 hover:bg-gray-50"
            >
              <td className="px-4 py-2.5">
                <Link
                  href={`/alumni/${r.alumni_id}`}
                  className="font-medium text-gray-900 hover:text-brand-blue-600"
                >
                  {r.name}
                </Link>
              </td>
              <td className="px-4 py-2.5 text-gray-700">{r.city ?? dash}</td>
              <td className="px-4 py-2.5 text-gray-700">{r.state ?? dash}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">
                {r.graduation_year ?? dash}
              </td>
              <td className="px-4 py-2.5 text-gray-700">
                {r.current_employer ?? dash}
              </td>
              <td className="px-4 py-2.5 text-gray-700">
                {r.current_title ?? dash}
              </td>
              <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-gray-900">
                {r.distance_miles.toFixed(1)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
