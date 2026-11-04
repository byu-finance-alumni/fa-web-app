/**
 * How an Outreach people table is sorted (#917), shared by the NetTrek reports
 * and the Outreach lists: it lives in the URL, and the same params go to the
 * backend, which owns the order (a page is only 50 of the list). See fa-web-api
 * `app/services/report_view.py`.
 */
import type { Schema } from "@/types/api";

export type ReportSort = Schema<"ReportSortColumn">;
export type ReportSortDir = Schema<"ReportSortDir">;

export interface ReportView {
  /** Null is the default order: last name, then first name. */
  sort: ReportSort | null;
  dir: ReportSortDir;
}

export const DEFAULT_REPORT_VIEW: ReportView = { sort: null, dir: "asc" };

/** The column the default order sorts by, so its header shows an arrow. */
const DEFAULT_SORT: ReportSort = "last_name";

/** Keyed on the generated union, so a column the API adds or drops fails tsc. */
const SORT_COLUMNS: Record<ReportSort, true> = {
  first_name: true,
  middle_name: true,
  last_name: true,
  company: true,
  industry: true,
  secondary_industry: true,
  company_city: true,
  company_state: true,
  permanent_email: true,
  work_email: true,
  phone: true,
  linkedin_url: true,
  gender: true,
  graduation_year: true,
};

type SearchParams = Record<string, string | string[] | undefined>;

function first(raw: string | string[] | undefined): string | undefined {
  return Array.isArray(raw) ? raw[0] : raw;
}

/** The view a URL asks for. Anything the API would refuse is dropped here, so a
 *  stale or hand-edited link shows the list instead of an error. */
export function parseReportView(sp: SearchParams): ReportView {
  const sort = first(sp.sort);
  const known = sort !== undefined && Object.hasOwn(SORT_COLUMNS, sort);
  return {
    sort: known ? (sort as ReportSort) : null,
    dir: known && first(sp.dir) === "desc" ? "desc" : "asc",
  };
}

/** The view's query params, for both the page URL and the API. */
export function reportViewParams(view: ReportView): [string, string][] {
  const params: [string, string][] = [];
  if (view.sort) {
    params.push(["sort", view.sort]);
    if (view.dir === "desc") params.push(["dir", "desc"]);
  }
  return params;
}

/** `path` (which may already have a query) with the view on it. */
export function withReportView(path: string, view: ReportView): string {
  const query = new URLSearchParams(reportViewParams(view)).toString();
  if (!query) return path;
  return `${path}${path.includes("?") ? "&" : "?"}${query}`;
}

/** The header cell's state: which column is active, and which way. */
export function reportSortState(view: ReportView, column: ReportSort) {
  return { active: (view.sort ?? DEFAULT_SORT) === column, dir: view.dir };
}

/** The view a header click asks for: a new column starts ascending, the active
 *  one flips. Last name ascending is the default, so its URL stays clean. */
export function toggleReportSort(view: ReportView, column: ReportSort): ReportView {
  const { active, dir } = reportSortState(view, column);
  const next: ReportSortDir = active && dir === "asc" ? "desc" : "asc";
  if (column === DEFAULT_SORT && next === "asc") {
    return { ...view, sort: null, dir: "asc" };
  }
  return { ...view, sort: column, dir: next };
}
