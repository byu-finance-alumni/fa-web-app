import Link from "next/link";
import { genderLabel } from "@/components/alumni/AlumniTable";
import { netTrekDisplayName, type NetTrekRow } from "@/lib/nettreks";
import { abbreviateState } from "@/lib/usStates";
import { safeExternalHref } from "@/lib/urlSafety";

/** The issue's columns, in its order (#887) — the CSV's header row. Name is
    split into three. The on-screen table shows the same columns in the same
    order under the short labels below. */
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

/**
 * Screen label, pinned width and alignment for each column above, in the same
 * order. Fifteen columns only fit the page if the headers are short and the
 * widths follow the content — so state shows as "UT" and gender as "M"/"F",
 * exactly as on the alumni list, and the full CSV names sit in each header's
 * hover text. Widths sum to 100%.
 */
export const NETTREK_SCREEN_COLUMNS = [
  { label: "First", w: "w-[6%]" },
  { label: "Middle", w: "w-[5%]" },
  { label: "Last", w: "w-[6%]" },
  { label: "Company", w: "w-[9%]" },
  { label: "Industry", w: "w-[9%]" },
  { label: "Secondary", w: "w-[7%]" },
  { label: "City", w: "w-[7%]" },
  { label: "State", w: "w-[4%]", center: true },
  { label: "Personal email", w: "w-[10%]" },
  { label: "Work email", w: "w-[8%]" },
  { label: "Phone", w: "w-[10%]" },
  { label: "LinkedIn", w: "w-[6%]", center: true },
  { label: "Gender", w: "w-[5%]", center: true },
  { label: "Grad", w: "w-[4%]", center: true },
  { label: "Host", w: "w-[4%]", center: true },
] as const;

// The alumni list's container, header, row and cell classes (AlumniTable,
// #268), so a NetTrek report reads as the same table. Horizontal padding is
// px-2 rather than the list's px-3: the list has 9 columns, this has 15, and
// the difference is what lets every column fit the page with nothing cut off.
const TH = "sticky top-0 z-10 truncate bg-gray-50 px-2 py-2.5";
const TD = "truncate px-2 py-2.5 text-gray-700";
const dash = <span className="text-gray-400">—</span>;

function text(value: string | number | null | undefined) {
  return value === null || value === undefined || value === "" ? dash : value;
}

/** Hover text for a truncated cell: the full value, or nothing when blank. */
function full(value: string | number | null | undefined) {
  return value === null || value === undefined || value === "" ? undefined : String(value);
}

/** A US number without its "+1 " prefix, which buys the column a few
    characters; anything else is shown as stored. The CSV keeps the value. */
function phoneLabel(value: string | null | undefined) {
  return value ? value.replace(/^\+1\s+/, "") : value;
}

/**
 * One NetTrek report's page of people. All 15 columns fit the page width, as
 * on the alumni list — nothing scrolls sideways; long values truncate with the
 * full text on hover. The last name links to the profile.
 */
export function NetTrekReportTable({ rows }: { rows: NetTrekRow[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-card">
      <table className="w-full table-fixed text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            {NETTREK_SCREEN_COLUMNS.map((c, i) => (
              <th
                key={c.label}
                title={NETTREK_TABLE_COLUMNS[i]}
                className={`${TH} ${c.w}${"center" in c ? " text-center" : ""}`}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.alumni_id}
              className="border-b border-gray-200 last:border-0 even:bg-gray-50/50 hover:bg-gray-50"
            >
              <td className={TD} title={full(r.first_name)}>{text(r.first_name)}</td>
              <td className={TD} title={full(r.middle_name)}>{text(r.middle_name)}</td>
              <td className={TD} title={full(r.last_name)}>
                <Link
                  href={`/alumni/${r.alumni_id}`}
                  aria-label={`Open ${netTrekDisplayName(r)}'s profile`}
                  className="font-medium text-gray-900 underline-offset-4 hover:text-brand-blue-600 hover:underline"
                >
                  {r.last_name || netTrekDisplayName(r)}
                </Link>
              </td>
              <td className={TD} title={full(r.company)}>{text(r.company)}</td>
              <td className={TD} title={full(r.industry)}>{text(r.industry)}</td>
              <td className={TD} title={full(r.secondary_industry)}>
                {text(r.secondary_industry)}
              </td>
              <td className={TD} title={full(r.company_city)}>{text(r.company_city)}</td>
              <td className={`${TD} text-center`} title={full(r.company_state)}>
                {text(abbreviateState(r.company_state ?? "") || r.company_state)}
              </td>
              <td className={TD} title={full(r.permanent_email)}>{text(r.permanent_email)}</td>
              <td className={TD} title={full(r.work_email)}>{text(r.work_email)}</td>
              <td className={`${TD} tabular-nums`} title={full(r.phone)}>
                {text(phoneLabel(r.phone))}
              </td>
              <td className={`${TD} text-center`}>
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
                    Open
                  </a>
                ) : (
                  text(r.linkedin_url)
                )}
              </td>
              <td className={`${TD} text-center`} title={full(r.gender)}>
                {text(genderLabel(r.gender))}
              </td>
              <td className={`${TD} text-center tabular-nums`}>{text(r.graduation_year)}</td>
              <td className={`${TD} text-center`}>{r.willing_to_host ? "Yes" : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
