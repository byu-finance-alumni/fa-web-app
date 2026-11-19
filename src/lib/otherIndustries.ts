/**
 * The dashboard "Other" table (fa-web-app#936): the people in the industry
 * chart's Other bar, grouped by secondary industry. The backend
 * (`GET /dashboard/other-industries`) does the grouping; this module only turns
 * a row into the alumni-list link for exactly the people it counted.
 */
import type { Schema } from "@/types/api";

export type OtherIndustries = Schema<"OtherSecondaryIndustries">;
export type OtherIndustryRow = Schema<"OtherSecondaryIndustryRow">;

/** The Other bar's own list — everyone in the table. */
export const OTHER_LIST_HREF = "/alumni?industry_group=other";

/**
 * Alumni list for one row: Other + that secondary-industry group, or Other +
 * no secondary industry for the "No secondary industry" row. The list (and its
 * CSV export) resolve the group through the same backend grouper the count
 * came from, so the list total matches the number shown.
 */
export function otherIndustryHref(row: OtherIndustryRow): string {
  const p = new URLSearchParams({ industry_group: "other" });
  if (row.no_secondary || row.group == null) {
    p.set("no_secondary_industry", "1");
  } else {
    p.set("secondary_industry_group", row.group);
  }
  return `/alumni?${p.toString()}`;
}

/**
 * The table's row order (fa-web-app#953): "No secondary industry" first (it sits
 * right under the pinned "All Other" row), then every secondary industry A–Z,
 * case-insensitive. The backend sends them highest count first; only the order
 * changes here — counts and links stay the backend's.
 */
export function sortOtherIndustryRows(
  rows: readonly OtherIndustryRow[],
): OtherIndustryRow[] {
  return [...rows].sort((a, b) => {
    if (a.no_secondary !== b.no_secondary) return a.no_secondary ? -1 : 1;
    return a.name.localeCompare(b.name, "en", { sensitivity: "base" });
  });
}
