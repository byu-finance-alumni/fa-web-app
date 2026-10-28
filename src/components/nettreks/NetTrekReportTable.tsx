import Link from "next/link";
import { Card } from "@/components/ui/card";
import { netTrekDisplayName, type NetTrekRow } from "@/lib/nettreks";
import { safeExternalHref } from "@/lib/urlSafety";

/** The issue's columns, in its order (#887). Name is split into three. */
export const NETTREK_TABLE_COLUMNS = [
  "First Name",
  "Middle Name",
  "Last Name",
  "Company",
  "Industry",
  "Secondary Industry",
  "Company City",
  "Company State",
  "Permanent Email",
  "Work Email",
  "Phone",
  "LinkedIn URL",
  "Gender",
  "Graduation Year",
  "Willing to Host a NetTrek",
] as const;

/** Pinned widths, one per column above (sums to 100%). With `table-fixed` the
    whole table fits the page like the alumni list (#268) — long values
    truncate in their column (full text on hover) instead of pushing the table
    past the edge. The CSV always carries the full values. */
const COLUMN_WIDTHS = [
  "w-[6%]",
  "w-[5%]",
  "w-[7%]",
  "w-[9%]",
  "w-[8%]",
  "w-[8%]",
  "w-[7%]",
  "w-[5%]",
  "w-[11%]",
  "w-[10%]",
  "w-[7%]",
  "w-[5%]",
  "w-[4%]",
  "w-[4%]",
  "w-[4%]",
] as const;

const cell = "truncate px-2 py-2";
const dash = <span className="text-gray-400">—</span>;

function text(value: string | number | null | undefined) {
  return value === null || value === undefined || value === "" ? dash : value;
}

/** Hover text for a truncated cell: the full value, or nothing when blank. */
function full(value: string | number | null | undefined) {
  return value === null || value === undefined || value === "" ? undefined : String(value);
}

/**
 * One NetTrek report's page of people. All 15 columns fit the page width,
 * as on the alumni list — nothing scrolls sideways. The last name links to
 * the profile.
 */
export function NetTrekReportTable({ rows }: { rows: NetTrekRow[] }) {
  return (
    <Card className="overflow-hidden p-0">
      <table className="w-full table-fixed text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            {NETTREK_TABLE_COLUMNS.map((c, i) => (
              <th key={c} className={`${COLUMN_WIDTHS[i]} px-2 py-2.5 align-bottom`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 text-gray-700">
          {rows.map((r) => (
            <tr key={r.alumni_id}>
              <td className={cell} title={full(r.first_name)}>
                {text(r.first_name)}
              </td>
              <td className={cell} title={full(r.middle_name)}>
                {text(r.middle_name)}
              </td>
              <td className={cell} title={full(r.last_name)}>
                <Link
                  href={`/alumni/${r.alumni_id}`}
                  aria-label={`Open ${netTrekDisplayName(r)}'s profile`}
                  className="font-medium text-gray-900 underline-offset-4 hover:text-brand-blue-600 hover:underline"
                >
                  {r.last_name || netTrekDisplayName(r)}
                </Link>
              </td>
              <td className={cell} title={full(r.company)}>
                {text(r.company)}
              </td>
              <td className={cell} title={full(r.industry)}>
                {text(r.industry)}
              </td>
              <td className={cell} title={full(r.secondary_industry)}>
                {text(r.secondary_industry)}
              </td>
              <td className={cell} title={full(r.company_city)}>
                {text(r.company_city)}
              </td>
              <td className={cell} title={full(r.company_state)}>
                {text(r.company_state)}
              </td>
              <td className={cell} title={full(r.permanent_email)}>
                {text(r.permanent_email)}
              </td>
              <td className={cell} title={full(r.work_email)}>
                {text(r.work_email)}
              </td>
              <td className={cell} title={full(r.phone)}>
                {text(r.phone)}
              </td>
              <td className={cell}>
                {/* Scheme-checked before it can become an href, as on the
                    profile; an unsafe stored value shows as plain text. */}
                {r.linkedin_url && safeExternalHref(r.linkedin_url) ? (
                  <a
                    href={safeExternalHref(r.linkedin_url)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={r.linkedin_url}
                    className="text-brand-blue-600 underline-offset-4 hover:underline"
                  >
                    LinkedIn
                  </a>
                ) : (
                  text(r.linkedin_url)
                )}
              </td>
              <td className={cell} title={full(r.gender)}>
                {text(r.gender)}
              </td>
              <td className={`${cell} tabular-nums`}>{text(r.graduation_year)}</td>
              <td className={cell}>{r.willing_to_host ? "Yes" : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
