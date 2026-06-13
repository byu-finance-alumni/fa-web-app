/**
 * Canonical dropdown option lists for the app's controlled-vocabulary fields.
 *
 * Source of truth: `fa-web-api/database/dropdowns.md`. Keep this file in sync
 * with that doc (and the backend's matching constants) so the UI only ever
 * offers — and the backend only ever accepts — these exact, case-sensitive
 * values. This keeps filtering/grouping (e.g. the dashboard "Top industries"
 * chart) clean instead of fragmenting across free-text spellings.
 */

/** Industries — used for current industry, secondary industry, and
 * employment-history industry. "Other" is the catch-all and stays last. */
export const INDUSTRY_OPTIONS = [
  "Asset Management",
  "Commercial Banking",
  "Consulting",
  "Corporate Finance",
  "Equity Research",
  "Investment Banking",
  "Private Banking",
  "Private Credit",
  "Private Equity",
  "Real Estate",
  "Sales",
  "Valuation & Advisory",
  "Venture Capital",
  "Wealth Management",
  "Other",
] as const;

export type Industry = (typeof INDUSTRY_OPTIONS)[number];

/** Engagement tags — the fixed, canonical set an alumnus can be labelled with.
 * Mirrors `TAGS` in fa-web-api/app/core/dropdowns.py. No free-text. */
export const TAG_OPTIONS = [
  "Mentor",
  "Highly Engaged",
  "Speaker",
  "Recruiter",
  "Donor",
] as const;

export type Tag = (typeof TAG_OPTIONS)[number];

/** Status labels — the fixed, canonical record-status flags.
 * Mirrors `STATUS_LABELS` in fa-web-api/app/core/dropdowns.py. No free-text. */
export const STATUS_OPTIONS = [
  "Inactive",
  "Deceased",
  "Lost Contact",
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
