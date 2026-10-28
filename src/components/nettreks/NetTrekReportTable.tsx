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

const cell = "whitespace-nowrap px-3 py-2";
const dash = <span className="text-gray-400">—</span>;

function text(value: string | number | null | undefined) {
  return value === null || value === undefined || value === "" ? dash : value;
}

/**
 * One NetTrek report's page of people. Wide by nature (15 columns), so it
 * scrolls sideways inside its card on desktop rather than squeezing the
 * contact columns. The last name links to the profile.
 */
export function NetTrekReportTable({ rows }: { rows: NetTrekRow[] }) {
  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            {NETTREK_TABLE_COLUMNS.map((c) => (
              <th key={c} className="whitespace-nowrap px-3 py-2.5">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 text-gray-700">
          {rows.map((r) => (
            <tr key={r.alumni_id}>
              <td className={cell}>{text(r.first_name)}</td>
              <td className={cell}>{text(r.middle_name)}</td>
              <td className={cell}>
                <Link
                  href={`/alumni/${r.alumni_id}`}
                  aria-label={`Open ${netTrekDisplayName(r)}'s profile`}
                  className="font-medium text-gray-900 underline-offset-4 hover:text-brand-blue-600 hover:underline"
                >
                  {r.last_name || netTrekDisplayName(r)}
                </Link>
              </td>
              <td className={cell}>{text(r.company)}</td>
              <td className={cell}>{text(r.industry)}</td>
              <td className={cell}>{text(r.secondary_industry)}</td>
              <td className={cell}>{text(r.company_city)}</td>
              <td className={cell}>{text(r.company_state)}</td>
              <td className={cell}>{text(r.permanent_email)}</td>
              <td className={cell}>{text(r.work_email)}</td>
              <td className={cell}>{text(r.phone)}</td>
              <td className={cell}>
                {/* Scheme-checked before it can become an href, as on the
                    profile; an unsafe stored value shows as plain text. */}
                {r.linkedin_url && safeExternalHref(r.linkedin_url) ? (
                  <a
                    href={safeExternalHref(r.linkedin_url)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-blue-600 underline-offset-4 hover:underline"
                  >
                    {r.linkedin_url}
                  </a>
                ) : (
                  text(r.linkedin_url)
                )}
              </td>
              <td className={cell}>{text(r.gender)}</td>
              <td className={`${cell} tabular-nums`}>{text(r.graduation_year)}</td>
              <td className={cell}>{r.willing_to_host ? "Yes" : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
