/**
 * The "no options loaded yet" value for the advanced-filter panel.
 *
 * ONE definition, because there were two hand-written copies — the dashboard's
 * Advanced search and the alumni list's Filters panel — and adding option lists
 * to the backend broke both, identically, at the same time. Now a new facet
 * costs one line here, and `tsc` points straight at it.
 *
 * Every list empty is exactly what "nothing loaded" means for a multi-select:
 * the control renders with no choices rather than with stale ones.
 */
import type { FilterOptions } from "@/types/filters";

export const EMPTY_FILTER_OPTIONS: FilterOptions = {
  employers: [],
  past_employers: [],
  titles: [],
  seniority_levels: [],
  industries: [],
  secondary_industries: [],
  employment_statuses: [],
  cities: [],
  states: [],
  countries: [],
  regions: [],
  past_titles: [],
  universities: [],
  degrees: [],
  majors: [],
  tags: [],
  status_labels: [],
  leadership_roles: [],
  survey_statuses: [],
  graduation_years: [],
  graduation_classes: [],
};
