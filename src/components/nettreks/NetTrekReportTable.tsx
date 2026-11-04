import Link from "next/link";
import { ReportRow } from "@/components/nettreks/ReportRow";
import { SortTh } from "@/components/shared/SortTh";
import { genderLabel } from "@/lib/format";
import { netTrekDisplayName, type NetTrekRow } from "@/lib/nettreks";
import { formatPhone } from "@/lib/phone";
import {
  reportSortState,
  toggleReportSort,
  type ReportSort,
  type ReportView,
} from "@/lib/reportView";
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
] as const;

/**
 * Screen label, pinned width and alignment for each column above, in the same
 * order. Fourteen columns only fit the page if the headers are short and the
 * widths follow the content — so state shows as "UT" and gender as "M"/"F",
 * exactly as on the alumni list, and the full CSV names sit in each header's
 * hover text. Widths sum to 100%.
 */
export const NETTREK_SCREEN_COLUMNS: readonly {
  label: string;
  sort: ReportSort;
  w: string;
  center?: boolean;
}[] = [
  { label: "First", sort: "first_name", w: "w-[6%]" },
  { label: "Middle", sort: "middle_name", w: "w-[6%]" },
  { label: "Last", sort: "last_name", w: "w-[6%]" },
  { label: "Company", sort: "company", w: "w-[9%]" },
  { label: "Industry", sort: "industry", w: "w-[9%]" },
  { label: "Secondary", sort: "secondary_industry", w: "w-[7%]" },
  { label: "City", sort: "company_city", w: "w-[7%]" },
  { label: "State", sort: "company_state", w: "w-[5%]", center: true },
  { label: "Personal email", sort: "permanent_email", w: "w-[10%]" },
  { label: "Work email", sort: "work_email", w: "w-[8%]" },
  { label: "Phone", sort: "phone", w: "w-[10%]" },
  { label: "LinkedIn", sort: "linkedin_url", w: "w-[6%]", center: true },
  { label: "Gender", sort: "gender", w: "w-[6%]", center: true },
  { label: "Grad", sort: "graduation_year", w: "w-[5%]", center: true },
];

// The alumni list's container, header, row and cell classes (AlumniTable,
// #268), so a NetTrek report reads as the same table. Horizontal padding is
// px-2 rather than the list's px-3: the list has 9 columns, this has 14, and
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

/**
 * One NetTrek report's page of people. All 14 columns fit the page width, as
 * on the alumni list — nothing scrolls sideways; long values truncate with the
 * full text on hover. Clicking a row opens the profile, and the last name stays
 * a real link for keyboard and new-tab use (#920). Every header sorts
 * the whole list on the server through the page URL (#917), except Gender for
 * someone it is hidden from: the backend ignores that sort for them.
 */
export function NetTrekReportTable({
  rows,
  view,
  viewHref,
  canSeeGender,
}: {
  rows: NetTrekRow[];
  view: ReportView;
  /** This list's page URL for a view, first page. */
  viewHref: (view: ReportView) => string;
  canSeeGender: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-card">
      <table className="w-full table-fixed text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            {NETTREK_SCREEN_COLUMNS.map((c, i) =>
              c.sort === "gender" && !canSeeGender ? (
                <th
                  key={c.label}
                  title={NETTREK_TABLE_COLUMNS[i]}
                  className={`${TH} ${c.w} text-center`}
                >
                  {c.label}
                </th>
              ) : (
                <SortTh
                  key={c.label}
                  label={c.label}
                  title={NETTREK_TABLE_COLUMNS[i]}
                  w={c.w}
                  base={TH}
                  align={c.center ? "center" : undefined}
                  href={viewHref(toggleReportSort(view, c.sort))}
                  {...reportSortState(view, c.sort)}
                />
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <ReportRow
              key={r.alumni_id}
              href={`/alumni/${r.alumni_id}`}
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
                {text(formatPhone(r.phone))}
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
            </ReportRow>
          ))}
        </tbody>
      </table>
    </div>
  );
}
