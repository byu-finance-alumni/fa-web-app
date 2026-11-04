/**
 * How an Outreach people table is sorted and filtered (#917, #918), shared by
 * the NetTrek reports and the Outreach lists: it lives in the URL, and the same
 * params go to the backend, which owns both (a page is only 50 of the list). See
 * fa-web-api `app/services/report_view.py`.
 */
import type { QueryParams, Schema } from "@/types/api";

export type ReportSort = Schema<"ReportSortColumn">;
export type ReportSortDir = Schema<"ReportSortDir">;

export type ReportFilterOptions = Schema<"ReportFilterOptions">;

type ListQuery = QueryParams<"nettreks_report_nettreks__area___kind__get"> &
  QueryParams<"outreach_list_outreach__group___key__get">;

/** The filter params both list routes take: `f_` plus the column's name. */
export type ReportFilterParam = Extract<keyof ListQuery, `f_${string}`>;

export type ReportFilters = Partial<Record<ReportFilterParam, string>>;

export interface ReportView {
  /** Null is the default order: last name, then first name. */
  sort: ReportSort | null;
  dir: ReportSortDir;
  filters: ReportFilters;
}

export const DEFAULT_REPORT_VIEW: ReportView = { sort: null, dir: "asc", filters: {} };

/** The API's bounds on a filter value. */
const TEXT_MAX = 100;
const CHOICE_MAX = 255;

/**
 * Every filter, in column order. Keyed on the generated params, so one the API
 * adds or drops fails tsc. `options` names the dropdown's choices in
 * `filter_options`; the rest are text matches.
 */
const FILTERS: Record<
  ReportFilterParam,
  { label: string; max: number; options?: keyof ReportFilterOptions; valid?: RegExp }
> = {
  f_first_name: { label: "First", max: TEXT_MAX },
  f_middle_name: { label: "Middle", max: TEXT_MAX },
  f_last_name: { label: "Last", max: TEXT_MAX },
  f_company: { label: "Company", max: TEXT_MAX },
  f_industry: { label: "Industry", max: CHOICE_MAX, options: "industry" },
  f_secondary_industry: {
    label: "Secondary",
    max: CHOICE_MAX,
    options: "secondary_industry",
  },
  f_company_city: { label: "City", max: TEXT_MAX },
  f_company_state: { label: "State", max: CHOICE_MAX, options: "company_state" },
  f_permanent_email: { label: "Personal email", max: TEXT_MAX },
  f_work_email: { label: "Work email", max: TEXT_MAX },
  f_phone: { label: "Phone", max: TEXT_MAX },
  f_linkedin_url: { label: "LinkedIn", max: TEXT_MAX },
  f_gender: { label: "Gender", max: 1, options: "gender", valid: /^[MF]$/ },
  f_graduation_year: {
    label: "Grad",
    max: 4,
    options: "graduation_year",
    valid: /^[1-9][0-9]{0,3}$/,
  },
};

export const REPORT_FILTERS = (
  Object.entries(FILTERS) as [
    ReportFilterParam,
    (typeof FILTERS)[ReportFilterParam],
  ][]
).map(([param, filter]) => ({ param, ...filter }));

const CONTROL_CHARACTERS = /[\x00-\x1f\x7f-\x9f]/;

/** A filter value the API accepts, else null. Blank is no filter. */
function cleanFilter(param: ReportFilterParam, raw: string | undefined): string | null {
  const { max, valid } = FILTERS[param];
  const value = raw?.trim();
  if (!value || value.length > max || CONTROL_CHARACTERS.test(value)) return null;
  return !valid || valid.test(value) ? value : null;
}

/** Only the filters that are set and that the API accepts. */
export function cleanReportFilters(raw: ReportFilters): ReportFilters {
  const filters: ReportFilters = {};
  for (const { param } of REPORT_FILTERS) {
    const value = cleanFilter(param, raw[param]);
    if (value !== null) filters[param] = value;
  }
  return filters;
}

export function isReportFiltered(view: ReportView): boolean {
  return Object.keys(view.filters).length > 0;
}

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
  const raw: ReportFilters = {};
  for (const { param } of REPORT_FILTERS) raw[param] = first(sp[param]);
  return {
    sort: known ? (sort as ReportSort) : null,
    dir: known && first(sp.dir) === "desc" ? "desc" : "asc",
    filters: cleanReportFilters(raw),
  };
}

/** The view's query params, for both the page URL and the API. */
export function reportViewParams(view: ReportView): [string, string][] {
  const params: [string, string][] = [];
  if (view.sort) {
    params.push(["sort", view.sort]);
    if (view.dir === "desc") params.push(["dir", "desc"]);
  }
  for (const { param } of REPORT_FILTERS) {
    const value = view.filters[param];
    if (value) params.push([param, value]);
  }
  return params;
}

/** The view as a query string, to hand to a server action. */
export function reportViewQuery(view: ReportView): string {
  return new URLSearchParams(reportViewParams(view)).toString();
}

/** The view in a query string. A server action is a real endpoint anything can
 *  call, so the string is untrusted and goes through the same parse as a URL. */
export function parseReportViewQuery(query: unknown): ReportView {
  const params = new URLSearchParams(typeof query === "string" ? query : "");
  return parseReportView(Object.fromEntries(params));
}

/** `path` (which may already have a query) with the view on it. */
export function withReportView(path: string, view: ReportView): string {
  const query = reportViewQuery(view);
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
