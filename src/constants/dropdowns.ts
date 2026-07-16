/**
 * Canonical dropdown option lists for the app's controlled-vocabulary fields.
 *
 * Source of truth: `fa-web-api/database/dropdowns.md`. Keep this file in sync
 * with that doc (and the backend's matching constants) so the UI only ever
 * offers — and the backend only ever accepts — these exact, case-sensitive
 * values. This keeps filtering/grouping (e.g. the dashboard "Top industries"
 * chart) clean instead of fragmenting across free-text spellings.
 */

/**
 * Industries — used for current industry, secondary industry, and
 * employment-history industry.
 *
 * FALLBACK ONLY. The live options come from `GET /vocabulary/industry` (the
 * DB-backed `vocabulary_terms` list) via `useVocabOptions`; this constant is
 * what a dropdown shows until that fetch resolves, and what it keeps if the
 * fetch fails — so a select is never blank. Do not read it directly in a
 * dropdown: that is exactly the drift #282 removed.
 *
 * Order mirrors `INDUSTRIES` in fa-web-api/app/core/dropdowns.py — sorted
 * case-insensitively ("Financial Services" before "FP&A") with the "Other"
 * catch-all pinned last (#282) — which in turn mirrors `sort_order` on the
 * vocabulary rows, so the fallback and the fetched list agree on order.
 */
export const INDUSTRY_OPTIONS = [
  "Asset Management",
  "Commercial Banking",
  "Consulting",
  "Corporate Banking",
  "Corporate Finance",
  "Credit Risk",
  "Equity Research",
  "Financial Services",
  "FP&A",
  "Investment Banking",
  "Law",
  "Private Banking",
  "Private Credit",
  "Private Equity",
  "Real Estate",
  "Sales",
  "Sales and Trading",
  "Valuation & Advisory",
  "Venture Capital",
  "Wealth Management",
  "Other",
] as const;

export type Industry = (typeof INDUSTRY_OPTIONS)[number];

/**
 * Industries that may only be used as a SECONDARY industry (#452).
 *
 * Tanya, 2026-07-16: these four aren't dashboard industries and shouldn't be
 * offered as an alumnus's PRIMARY industry — but they must stay available as a
 * secondary one, so they are hidden from the primary dropdown rather than
 * deleted from the vocabulary. Mirrors `_PRIMARY_EXCLUDED_INDUSTRIES` in
 * fa-web-api/app/core/dropdowns.py.
 *
 * A record that already STORES one of these as its primary stays valid — the
 * backend still accepts them on write, and the dropdown re-adds the stored
 * value via `withValue()` so editing an unrelated field can't blank it.
 */
export const PRIMARY_EXCLUDED_INDUSTRIES = [
  "Law",
  "Corporate Banking",
  "Sales and Trading",
  "Credit Risk",
] as const;

const PRIMARY_EXCLUDED_LOWER = new Set<string>(
  PRIMARY_EXCLUDED_INDUSTRIES.map((v) => v.toLowerCase()),
);

/**
 * Drop the primary-excluded industries from `values`, preserving order.
 * Mirrors `filter_primary_industries` in fa-web-api/app/core/dropdowns.py —
 * case-insensitive, because term casing can drift from admin vocabulary edits.
 *
 * The server already applies this to `GET /vocabulary/industry?scope=primary`;
 * this exists so the FALLBACK list is narrowed the same way while that fetch is
 * in flight, and the dropdown never flashes an option it's about to drop.
 */
export function filterPrimaryIndustries(
  values: readonly string[],
): readonly string[] {
  return values.filter((v) => !PRIMARY_EXCLUDED_LOWER.has(v.trim().toLowerCase()));
}

/** Fallback options for the PRIMARY industry dropdown (`current_industry`). */
export const PRIMARY_INDUSTRY_OPTIONS = filterPrimaryIndustries(INDUSTRY_OPTIONS);

/**
 * Fallback options for the SECONDARY industry dropdown
 * (`current_industry_secondary`) — the full vocabulary, including the four
 * hidden from primary.
 */
export const SECONDARY_INDUSTRY_OPTIONS: readonly string[] = INDUSTRY_OPTIONS;

/**
 * The six canonical U.S. regions, in display order.
 *
 * FALLBACK ONLY, like `INDUSTRY_OPTIONS` — the live list comes from
 * `GET /vocabulary/state-regions` (`regions`) via `useStateRegions`, which is
 * derived server-side from the same map the write path uses to persist a
 * region. Mirrors `REGIONS` in fa-web-api/app/services/state_regions.py.
 *
 * "Mountain West" was split out of "West" as a 6th region (Tanya, 2026-07-16):
 * West is now AK/CA/HI/OR/WA, Mountain West is CO/ID/MT/NV/UT/WY. The
 * state -> region crosswalk itself is deliberately NOT duplicated here — the
 * endpoint is its single source of truth, and this list only exists so a Region
 * dropdown isn't blank before that fetch resolves (or if it fails).
 */
export const REGION_OPTIONS = [
  "Northeast",
  "Southeast",
  "Midwest",
  "Southwest",
  "West",
  "Mountain West",
] as const;

export type Region = (typeof REGION_OPTIONS)[number];

/** Engagement tags — the fixed, canonical set an alumnus can be labelled with.
 * Mirrors `TAGS` in fa-web-api/app/core/dropdowns.py. No free-text. */
export const TAG_OPTIONS = [
  "Mentor",
  "Highly Engaged",
  "Speaker",
  "Recruiter",
  "Donor",
  "Warm Contact",
  "High Value",
  "Club/Recruiting",
  "Finance Orgs",
  "Advisory Boards",
] as const;

export type Tag = (typeof TAG_OPTIONS)[number];

/** Status labels — the fixed, canonical record-status flags.
 * Mirrors `STATUS_LABELS` in fa-web-api/app/core/dropdowns.py. No free-text. */
export const STATUS_OPTIONS = [
  "Inactive",
  "Deceased",
  "Lost Contact",
  "Retired",
  "Do Not Contact",
] as const;

export type StatusLabel = (typeof STATUS_OPTIONS)[number];

/** Attendance status options for marking event attendance. */
export const ATTENDANCE_STATUS_OPTIONS = [
  "Registered",
  "Attended",
  "No Show",
  "Cancelled",
] as const;

export type AttendanceStatus = (typeof ATTENDANCE_STATUS_OPTIONS)[number];
