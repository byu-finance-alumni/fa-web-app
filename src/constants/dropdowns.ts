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
 * case-insensitively ("Financial Services" before "FP&A") with "Unknown",
 * "Graduate Student" and the "Other" catch-all pinned last, in that order
 * (#295/#294/#282) — which in turn mirrors `sort_order` on the vocabulary rows,
 * so the fallback and the fetched list agree on order.
 *
 * "Military" (#608) sits in the alphabetical BODY between "Law" and "Private
 * Banking", not the pinned tail: unlike "Graduate Student" it is a real answer
 * to "what do you do", and people scan for it under M. It was added because a
 * service member had no industry that fit and had to be recorded as Other or
 * Unknown, which dropped them out of the dashboard industry breakdown.
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
  "Military",
  "Private Banking",
  "Private Credit",
  "Private Equity",
  "Real Estate",
  "Sales",
  "Sales and Trading",
  "Valuation & Advisory",
  "Venture Capital",
  "Wealth Management",
  "Unknown",
  "Graduate Student",
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
 * Employment status — what an alum is currently doing (`alumni.employment_status`).
 *
 * Tanya, 2026-08-01 (#568): this was free text everywhere it was entered, so the
 * column collected one-off spellings ("Employed", "employed full time"). These
 * eight, in this order, are the answers the staff forms and the filter pick from.
 *
 * `Unknown` is the eighth (#377) and is pinned last, out of Tanya's order, the
 * same way it is in `INDUSTRY_OPTIONS`. Jake's 2026-08-04 prod cleanup
 * consolidated the misspelled `unkown` / `UNKOWN` rows onto the literal
 * `Unknown`, so ~65 live alumni hold it — it has to be a real, selectable option
 * or those records fail validation the next time anyone edits them. It is NOT
 * offered in the survey: see `SURVEY_EMPLOYMENT_STATUS_OPTIONS`.
 *
 * NOT a `vocabulary_terms` category — the column is plain `varchar(50)` and the
 * backend still accepts any string, so a record that already stores something
 * off-list keeps it: every dropdown re-adds the stored value via `withValue()`
 * (staff forms) or `SelectControl`'s preserve-unknown branch (survey). Editing
 * an unrelated field must never silently rewrite what's on file.
 *
 * Mirrors `EMPLOYMENT_STATUSES` in fa-web-api/app/core/dropdowns.py.
 */
export const EMPLOYMENT_STATUS_OPTIONS = [
  "Full-time",
  "Part-time",
  "Self-Employed",
  "Graduate Student",
  "Military",
  "Not in the Labor Force",
  "Unemployed",
  "Unknown",
] as const;

export type EmploymentStatus = (typeof EMPLOYMENT_STATUS_OPTIONS)[number];

/**
 * Marital status choices (#647).
 *
 * Free text until now, which is why staff reported the field as "missing" on the
 * survey: an empty box with no options beside it reads as nothing being asked,
 * so alumni skipped it and the column stayed blank.
 *
 * NOT a `vocabulary_terms` category, for the same reason employment status
 * isn't — plus one that is specific to this field: the survey now ENFORCES this
 * list on write, so an admin editing a runtime-mutable category could silently
 * start rejecting answers alumni submit. These four are a product call.
 *
 * A stored value outside these four still DISPLAYS — the survey's
 * `SelectControl` prepends it. That matters here: the CSV import already maps
 * "Undeclared"/"N/A"/"None"/"Unknown" to blank on the way in, so an off-list
 * value that survived in production is a real answer someone typed, and blanking
 * it while the alum edits an unrelated field would be silent data loss.
 *
 * Mirrors `MARITAL_STATUSES` in fa-web-api/app/core/dropdowns.py, whose own
 * tests pin it against `database/dropdowns.md`.
 */
export const MARITAL_STATUS_OPTIONS: readonly string[] = [
  "Single",
  "Married",
  "Divorced",
  "Widowed",
];

/**
 * Statuses that are a recorded NON-ANSWER rather than a real one (#572/#377).
 *
 * `Unknown` / `UNKNOWN` means "we asked and we don't know". Jake's call: keep it
 * in the database (it is real information about the record) but never hand it
 * back to an alum as something they can pick, since offering it re-collects the
 * non-answer we're trying to clear. The survey therefore renders a stored one as
 * blank; the STAFF forms and the list filter show it like any other option,
 * because staff need to see and target the record's true state.
 */
export const EMPLOYMENT_STATUS_PLACEHOLDERS = ["Unknown"] as const;

const EMPLOYMENT_STATUS_PLACEHOLDERS_LOWER = new Set<string>(
  EMPLOYMENT_STATUS_PLACEHOLDERS.map((v) => v.toLowerCase()),
);

/**
 * What the SURVEY offers an alum for their OWN employment status: the canonical
 * list minus the placeholders.
 *
 * "Unknown" is meaningless as a self-description — nobody describes themselves
 * as unknown, and offering it just re-collects the non-answer the survey exists
 * to clear. So it stays storable, editable, filterable, importable and
 * exportable everywhere else, and is dropped here and only here (#377).
 *
 * DERIVED, never hand-typed: a ninth status must reach the survey without anyone
 * remembering to update a second list. Mirrors `SURVEY_EMPLOYMENT_STATUSES` in
 * fa-web-api/app/core/dropdowns.py.
 */
export const SURVEY_EMPLOYMENT_STATUS_OPTIONS: readonly string[] =
  EMPLOYMENT_STATUS_OPTIONS.filter(
    (v) => !EMPLOYMENT_STATUS_PLACEHOLDERS_LOWER.has(v.toLowerCase()),
  );

/**
 * True when a stored status is a placeholder, not a real answer. Matched
 * case-insensitively and whitespace-trimmed: the intake sheet was free text, so
 * the same non-answer arrived as both "Unknown" and "UNKNOWN".
 */
export function isEmploymentStatusPlaceholder(
  value: string | null | undefined,
): boolean {
  const v = value?.trim().toLowerCase();
  return v ? EMPLOYMENT_STATUS_PLACEHOLDERS_LOWER.has(v) : false;
}

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
 * Mirrors `TAGS` in fa-web-api/app/core/dropdowns.py. No free-text.
 *
 * The last seven, plus "Mentor" and "Speaker", are the nine "ways to get
 * involved" (#629). Those nine are DERIVED tags: the backend stores them as
 * booleans on `alumni_program_engagement` and applying or removing one here
 * writes that flag, rather than an `alumni_tags` row. That is deliberate —
 * it means a survey answer and a hand-applied tag land in the same place, so
 * "find me mentors" returns one list instead of two half-populated ones. */
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
  "Women in Finance Mentor",
  "Event Helper",
  "NetTrek Host",
  "Finance Conference",
  "Company Event Sponsor",
  "Case Competition Host",
  "PIFF Donor",
] as const;

export type Tag = (typeof TAG_OPTIONS)[number];

/** The nine "ways to get involved" the survey asks about, as engagement flag →
 * the tag that now carries it on the profile (#629).
 *
 * Mirrors `ENGAGEMENT_FLAG_TAGS` in fa-web-api/app/core/dropdowns.py (inverted:
 * keyed by flag, because the profile reads flags). Every one of these renders
 * as a tag chip, so none of the nine can be answerable-but-invisible again. */
export const ENGAGEMENT_FLAG_TAGS: Record<string, Tag> = {
  mentor_willing: "Mentor",
  women_in_finance_mentor_willing: "Women in Finance Mentor",
  guest_speaker_willing: "Speaker",
  help_at_event_willing: "Event Helper",
  nettrek_host_willing: "NetTrek Host",
  finance_conference_willing: "Finance Conference",
  company_event_sponsor_willing: "Company Event Sponsor",
  case_competition_host_willing: "Case Competition Host",
  piff_donor: "PIFF Donor",
};

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

/* ----------------------------------------------------------- military (#608) -- */

/**
 * The employment status and the industry that both mean "serving".
 *
 * They are SEPARATE columns and neither is derived from the other — the staff
 * forms only *suggest* the industry when the status is set (see
 * `suggestMilitaryIndustry`). Mirrors `MILITARY_STATUS` in
 * fa-web-api/app/core/dropdowns.py.
 */
export const MILITARY_STATUS = "Military";
export const MILITARY_INDUSTRY = "Military";

/**
 * True when a stored employment status records military service.
 *
 * Trimmed + case-insensitive: `employment_status` is a plain `varchar` with no
 * write validation, so production holds casing drift from the free-text intake
 * sheet ("military", "MILITARY").
 */
export function isMilitaryStatus(value: string | null | undefined): boolean {
  return value?.trim().toLowerCase() === MILITARY_STATUS.toLowerCase();
}

/**
 * How a serving alumnus's employer reads on the profile: `Military/<branch>`.
 *
 * Jake, 2026-08-04 (#608): the branch is stored the ordinary way (the employer
 * field) and is OPTIONAL — we want it when we know it but never chase it, which
 * is also why it is exempt from the missing-employer flag. Displaying the bare
 * branch on its own ("Air Force") loses the fact that it is service, so the
 * profile prefixes it.
 *
 * Returns `null` when there is nothing to show at all, so callers keep their
 * existing "render nothing" branch.
 *
 * Cases:
 *   Military + "Air Force"  -> "Military/Air Force"
 *   Military + no branch    -> "Military"      (never a dangling "Military/")
 *   Military + "military"   -> "Military"      (no "Military/Military")
 *   any other status        -> the employer, untouched
 */
export function employerDisplay(
  employmentStatus: string | null | undefined,
  employer: string | null | undefined,
): string | null {
  const branch = employer?.trim() || null;
  if (!isMilitaryStatus(employmentStatus)) return branch;
  if (!branch || branch.toLowerCase() === MILITARY_STATUS.toLowerCase()) {
    return MILITARY_STATUS;
  }
  return `${MILITARY_STATUS}/${branch}`;
}

/**
 * Employment statuses for which a BLANK EMPLOYER is complete data (#608).
 *
 * Mirrors `EMPLOYER_NOT_APPLICABLE_STATUSES` in fa-web-api/app/core/dropdowns.py,
 * which drives the backend's missing-employer flag, the Data-quality counts and
 * the `?missing_employer=1` drill-down. This copy exists so the per-profile
 * Completeness checklist agrees with those numbers for the same record.
 *
 * `Military` is on the list on Jake's call, 2026-08-04: "the branch does not
 * matter." We still want the branch when we know it — see `employerDisplay` —
 * but it is optional and never chased.
 *
 * NOT exempt: `Self-Employed` (their own company is the employer and we want its
 * name), `Full-time` / `Part-time`, and `Unknown` (we don't know what they're
 * doing, so we can't claim the blank employer was intentional).
 */
export const EMPLOYER_NOT_APPLICABLE_STATUSES = [
  "Military",
  "Unemployed",
  "Not in the Labor Force",
  "Graduate Student",
] as const;

const EMPLOYER_NOT_APPLICABLE_LOWER = new Set<string>(
  EMPLOYER_NOT_APPLICABLE_STATUSES.map((v) => v.toLowerCase()),
);

/**
 * False when the status means there is no employer to record — so a blank
 * employer is complete data, not a gap. An absent/blank status returns `true`
 * (we can't assume the blank was intentional), matching `employer_applies` in
 * the backend.
 */
export function employerApplies(value: string | null | undefined): boolean {
  const v = value?.trim().toLowerCase();
  return v ? !EMPLOYER_NOT_APPLICABLE_LOWER.has(v) : true;
}

/**
 * Which industry slot (if any) should be SUGGESTED when the status is set to
 * Military (#608).
 *
 * Status and industry are independent columns, so someone can be Military by
 * status with no industry recorded and then never turn up in an industry search
 * for Military. This closes that gap without forcing anything:
 *
 *   - empty primary                       -> suggest it as the PRIMARY industry
 *   - primary taken, secondary empty       -> suggest it as the SECONDARY one.
 *     This is Jake's reservist case exactly: primary Investment Banking +
 *     secondary Military. Never overwrite a primary the user chose.
 *   - both slots filled, or either already Military -> suggest NOTHING
 *   - status isn't Military                -> suggest NOTHING (one-way only:
 *     switching away must not strip a Military industry the user picked)
 *
 * Pure and stateless — the CALLER decides when to apply it, which is how
 * "suggest, never force" is enforced: it fires on a user CHANGE of the status
 * field only, never on load and never on save, so a value the user has since
 * edited is not re-suggested over the top.
 *
 * Deliberately NOT wired into the CSV import or the survey: a bulk file and an
 * alum's own self-report are taken at face value, not silently amended.
 */
export function suggestMilitaryIndustry(
  employmentStatus: string | null | undefined,
  currentIndustry: string | null | undefined,
  secondaryIndustry: string | null | undefined,
): "current_industry" | "current_industry_secondary" | null {
  if (!isMilitaryStatus(employmentStatus)) return null;
  const primary = currentIndustry?.trim() || "";
  const secondary = secondaryIndustry?.trim() || "";
  const isMil = (v: string) =>
    v.toLowerCase() === MILITARY_INDUSTRY.toLowerCase();
  if (isMil(primary) || isMil(secondary)) return null;
  if (!primary) return "current_industry";
  if (!secondary) return "current_industry_secondary";
  return null;
}
