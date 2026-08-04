/**
 * The alumni-list filter model and its URL round trip.
 *
 * This module owns THREE things that must always agree:
 *   1. `AlumniFilterState` — the shape the Filters slide-over holds in state.
 *   2. `parseAlumniFilters` — URL search params → state (used by the server
 *      component that renders the roster).
 *   3. `toAlumniFilterQs` — state → the canonical `/alumni` query string (used
 *      by the slide-over's live navigation).
 *
 * They live together because the panel re-serializes its ENTIRE state on every
 * interaction and `router.replace()`s the result, so **any param the model does
 * not carry is destroyed the moment a user touches a control**. That is not a
 * cosmetic drop: the list silently widens (a 1-row filtered view became 246
 * rows) with no error, and if the panel has no control for the param the user
 * cannot put it back.
 *
 * The rule, therefore: a query param that narrows `GET /alumni` must either be
 * modelled here (state + parse + serialize + a control in the panel) or be
 * listed in `PASS_THROUGH_PARAMS` as a known, accepted casualty. There is no
 * third option, and `alumniFilterParams.test.ts` fails the build if a new one
 * appears in the roster without a home.
 *
 * It also owns a FOURTH thing (#592): `toAlumniPopulationParams` — the single
 * definition of WHICH PEOPLE a view covers. The roster builds its `GET /alumni`
 * call from it and `@/lib/exportFilters` derives the export body from it, so the
 * list and its CSV export cannot resolve to different populations.
 */
import { EMPLOYMENT_STATUS_OPTIONS } from "@/constants/dropdowns";
import type { FilterOptions } from "@/types/filters";

/** Everything the backend GET /alumni supports, mirrored in the URL. */
export interface AlumniFilterState {
  q: string;
  /** Grad-year range (inclusive). Same value in both = exact year. */
  ymin: string;
  ymax: string;
  // Multi-select facets (repeated URL params; OR within a facet).
  employmentStatus: string[];
  pastEmployer: string[];
  industry: string[];
  secondaryIndustry: string[];
  title: string[];
  seniority: string[];
  city: string[];
  state: string[];
  tag: string[];
  statusLabel: string[];
  leadership: string[];
  surveyStatus: string[];
  /** Professional-designation filter (#404): multi-select over CFP/CFA/CPA with
   *  OR semantics (an alumnus holding ANY selected designation matches). Sent to
   *  GET /alumni as repeatable `designations=` params. Distinct from the
   *  cfa/cfp/cpa booleans below, which each AND-narrow to holders of that single
   *  designation. */
  designations: string[];
  /** Gender filter (#360): "" = all, else the single-letter code. Combinable
   *  with every other facet (e.g. females in a given industry). */
  gender: "" | "M" | "F";
  /** Industry grouping deep-link (dashboard → list): "other" = non-finance/Other
   *  bucket, "unknown" = missing industry. Mutually exclusive with picking
   *  specific industries; "" = no grouping filter. */
  industryGroup: "" | "other" | "unknown";
  // Last-contacted (derived from interactions).
  contactedAfter: string;
  contactedBefore: string;
  neverContacted: boolean;
  attended: boolean;
  donor: boolean;
  mentor: boolean;
  speaker: boolean;
  cfa: boolean;
  /** CFP holders (#584). A BOOLEAN that AND-narrows, distinct from picking "CFP"
   *  in the `designations` facet above — keep the two mechanisms separate. */
  cfp: boolean;
  /** CPA holders. NO LONGER OFFERED AS A CONTROL (#605) — no alumni hold a CPA,
   *  so the tickbox could only ever return zero rows, and it was removed from
   *  the list's Filters panel and the dashboard's Advanced search. The param
   *  stays MODELLED on purpose: an existing `?cpa=1` link must still narrow the
   *  list (and its export) rather than being silently dropped, and the panel
   *  still renders a removable chip for it. Search-only — CPA remains a valid
   *  designation on profiles, in the forms, and in import/export. */
  cpa: boolean;
  graduateDegree: boolean;
  archived: boolean;
  deceased: "" | "only" | "exclude";
  missingEmail: boolean;
  missingEmployer: boolean;
  duplicate: boolean;
  /** "Needs Surveying" view: alumni DUE for the biennial re-survey. Forced on by
   *  the /needs-surveying page (admin tier only) and never surfaced as a toggle/
   *  chip — it's not serialized into the query string (the route, not the URL,
   *  owns it), but it DOES flow into the export filters so an export from that
   *  page covers exactly the due set. */
  needsSurvey: boolean;
  sort:
    | "name"
    | "grad_desc"
    | "grad_asc"
    | "industry"
    | "city"
    | "state"
    | "employer"
    | "gender"
    | "updated";
}

export const EMPTY_FILTERS: AlumniFilterState = {
  q: "",
  ymin: "",
  ymax: "",
  employmentStatus: [],
  pastEmployer: [],
  industry: [],
  secondaryIndustry: [],
  title: [],
  seniority: [],
  city: [],
  state: [],
  tag: [],
  statusLabel: [],
  leadership: [],
  surveyStatus: [],
  designations: [],
  gender: "",
  industryGroup: "",
  contactedAfter: "",
  contactedBefore: "",
  neverContacted: false,
  attended: false,
  donor: false,
  mentor: false,
  speaker: false,
  cfa: false,
  cfp: false,
  cpa: false,
  graduateDegree: false,
  archived: false,
  deceased: "",
  missingEmail: false,
  missingEmployer: false,
  duplicate: false,
  needsSurvey: false,
  sort: "name",
};

/**
 * Each multi-select facet: state key, display label, the URL/query param name,
 * and which FilterOptions list feeds it. Drives the panel, the chips, the
 * parser, and serialization so all four stay in sync — adding a row here is all
 * it takes to make a new multi-value facet survive a round trip.
 *
 * Order IS the panel's layout (it renders this list top to bottom). Employment
 * Status leads the employment block and Secondary Industry sits directly under
 * Industry, mirroring the dashboard's Advanced search (#584) — alumni matched
 * on their SECONDARY industry are found there, since `industry` narrowed to the
 * primary column only (fa-web-api#363).
 */
export const FACETS: {
  key: keyof AlumniFilterState;
  label: string;
  param: string;
  optKey: keyof FilterOptions;
}[] = [
  { key: "employmentStatus", label: "Employment status", param: "employment_status", optKey: "employment_statuses" },
  { key: "pastEmployer", label: "Past employer", param: "past_employer", optKey: "past_employers" },
  { key: "industry", label: "Industry", param: "industry", optKey: "industries" },
  { key: "secondaryIndustry", label: "Secondary industry", param: "secondary_industry", optKey: "secondary_industries" },
  { key: "title", label: "Job title", param: "title", optKey: "titles" },
  { key: "seniority", label: "Seniority", param: "seniority", optKey: "seniority_levels" },
  { key: "city", label: "City", param: "city", optKey: "cities" },
  { key: "state", label: "State", param: "state", optKey: "states" },
  { key: "tag", label: "Engagement tag", param: "tag", optKey: "tags" },
  { key: "statusLabel", label: "Status label", param: "status_label", optKey: "status_labels" },
  { key: "leadership", label: "Leadership role", param: "leadership_role", optKey: "leadership_roles" },
  { key: "surveyStatus", label: "Survey status", param: "survey_status", optKey: "survey_statuses" },
];

/**
 * Facets whose dropdown is a FIXED vocabulary rather than the data-derived list
 * `GET /alumni/filter-options` returns.
 *
 * Employment status (Jake, 2026-08-03): `/alumni/filter-options` builds
 * `employment_statuses` from the values alumni actually hold, so Military /
 * Part-time / Unemployed simply weren't offered until someone answered a survey
 * that way — the filter read as broken. It now shows the same seven options the
 * survey and the profile edit form show, from the one constant they all share
 * (`EMPLOYMENT_STATUS_OPTIONS`). Accepted tradeoff: an option nobody holds yet
 * returns zero rows. That is the whole point — hand-retyping the list here would
 * recreate the second source of truth #568 removed.
 *
 * A value already ON FILE but off this list (the intake sheet's "Employed",
 * "Unknown", …) is NOT lost: `MultiSelect` prepends any selected-but-unlisted
 * value, so a deep link filtering on one still renders it checked.
 *
 * Keyed by `FilterOptions` key so `facetOptions` can resolve either facet table
 * (this module's, for the list slide-over; DashboardSearch's, for the dashboard
 * Advanced search) — the two must never diverge on what a facet offers.
 */
export const FIXED_FACET_OPTIONS: Partial<
  Record<keyof FilterOptions, readonly string[]>
> = {
  employment_statuses: EMPLOYMENT_STATUS_OPTIONS,
};

/**
 * The options a facet's multi-select should show: the fixed vocabulary when the
 * facet has one, otherwise the data-derived list from `/alumni/filter-options`.
 * Every facet dropdown in the app goes through here.
 */
export function facetOptions(
  optKey: keyof FilterOptions,
  options: FilterOptions | undefined | null,
): string[] {
  const fixed = FIXED_FACET_OPTIONS[optKey];
  if (fixed) return [...fixed];
  return (options?.[optKey] as string[] | undefined) ?? [];
}

/**
 * Boolean flags: state key → URL param → API param. Serialized into the URL as
 * `=1`, parsed with `isTrue` (so a deep link may send `1` or `true`), counted as
 * one active filter each, and each gets a checkbox in the panel.
 *
 * `api` is the name `GET /alumni` (and the export body) knows the flag by — four
 * of them differ from the URL spelling (`attended` → `attended_event`, `mentor`
 * → `mentor_willing`, `speaker` → `guest_speaker_willing`, `archived` →
 * `include_archived`). Keeping the pair in ONE row is what lets
 * `toAlumniPopulationParams` build the API call off this table instead of a
 * hand-written second list.
 */
export const BOOLEAN_FLAGS: {
  key: Extract<
    keyof AlumniFilterState,
    | "neverContacted"
    | "attended"
    | "donor"
    | "mentor"
    | "speaker"
    | "cfa"
    | "cfp"
    | "cpa"
    | "graduateDegree"
    | "archived"
    | "missingEmail"
    | "missingEmployer"
    | "duplicate"
  >;
  param: string;
  api: string;
}[] = [
  { key: "neverContacted", param: "never_contacted", api: "never_contacted" },
  { key: "attended", param: "attended", api: "attended_event" },
  { key: "donor", param: "donor", api: "donor" },
  { key: "mentor", param: "mentor", api: "mentor_willing" },
  { key: "speaker", param: "speaker", api: "guest_speaker_willing" },
  { key: "cfa", param: "cfa", api: "cfa" },
  { key: "cfp", param: "cfp", api: "cfp" },
  { key: "cpa", param: "cpa", api: "cpa" },
  { key: "graduateDegree", param: "graduate_degree", api: "graduate_degree" },
  { key: "archived", param: "archived", api: "include_archived" },
  { key: "missingEmail", param: "missing_email", api: "missing_email" },
  { key: "missingEmployer", param: "missing_employer", api: "missing_employer" },
  { key: "duplicate", param: "duplicate", api: "duplicate" },
];

/**
 * Params the roster forwards to the API straight off the URL, WITHOUT a home in
 * the filter model — so touching any control in the Filters slide-over drops
 * them. Accepted (with eyes open) because the panel has no matching control:
 *
 *  - `employer`      dashboard-only facet; the list dropped its current-employer
 *                    control in #153.
 *  - `near`/`radius` plain-English location search (#358); the panel filters by
 *                    discrete city/state, not a geocoded radius.
 *  - identity fields dashboard Quick/Advanced search; the list offers the single
 *                    free-text `q` box instead.
 *  - `spoke_after` / `spoke_before` — interaction-date deep links with no panel
 *                    control.
 *  - `year` / `missing` — legacy ALIASES the parser folds into ymin/ymax and the
 *                    missing_* flags; they round-trip under their modern names.
 *  - `offset`        pagination, owned by the pager (re-filtering resets to page
 *                    one by design).
 *  - `sort`          modelled; listed because the roster reads it via a helper.
 *
 * Anything NOT in this list and not modelled is a bug — see the test.
 *
 * "No home in the model" does NOT mean "invisible": the narrowing ones are
 * parsed by `parsePassThroughFilters` and folded into
 * `toAlumniPopulationParams`, so the CSV export covers the same people as a
 * deep-linked list (#592). Only `year` / `missing` (aliases), `offset` and
 * `sort` are outside that, none of which change WHO matches.
 */
export const PASS_THROUGH_PARAMS = [
  "employer",
  "near",
  "radius",
  "net_id",
  "first_name",
  "last_name",
  "preferred_name",
  "email",
  "spoke_after",
  "spoke_before",
  "year",
  "missing",
  "offset",
] as const;

/* ------------------------------------------------------------ parsing ----- */

/** Search params: every value may arrive as a string or (for repeated multi-
 *  select params) a string[]. */
export type SearchParamMap = Record<string, string | string[] | undefined>;

/** Normalize a search param to a clean string[] (handles single + repeated). */
export const arr = (v: string | string[] | undefined): string[] =>
  v == null ? [] : (Array.isArray(v) ? v : [v]).filter(Boolean);

/** First value of a possibly-repeated param. */
export const one = (v: string | string[] | undefined): string =>
  (Array.isArray(v) ? v[0] : v) ?? "";

/** Truthy boolean URL param: accepts "1" or "true" (case-insensitive). */
export const isTrue = (v: string | string[] | undefined): boolean => {
  const s = one(v).toLowerCase();
  return s === "1" || s === "true";
};

const SORT_VALUES = [
  "grad_desc",
  "grad_asc",
  "industry",
  "city",
  "state",
  "employer",
  "gender",
  "updated",
] as const;

export function parseSort(raw: string): AlumniFilterState["sort"] {
  return (SORT_VALUES as readonly string[]).includes(raw)
    ? (raw as AlumniFilterState["sort"])
    : "name";
}

/**
 * URL search params → filter state. The inverse of `toAlumniFilterQs` for every
 * field except `needsSurvey`, which the ROUTE owns (/needs-surveying) and the
 * URL never carries.
 */
export function parseAlumniFilters(sp: SearchParamMap): AlumniFilterState {
  const f: AlumniFilterState = {
    ...EMPTY_FILTERS,
    q: one(sp.q),
    ymin: one(sp.ymin) || one(sp.year),
    ymax: one(sp.ymax) || one(sp.year),
    designations: arr(sp.designations),
    gender:
      one(sp.gender).toUpperCase() === "F"
        ? "F"
        : one(sp.gender).toUpperCase() === "M"
          ? "M"
          : "",
    industryGroup:
      one(sp.industry_group).toLowerCase() === "other"
        ? "other"
        : one(sp.industry_group).toLowerCase() === "unknown"
          ? "unknown"
          : "",
    contactedAfter: one(sp.contacted_after),
    contactedBefore: one(sp.contacted_before),
    deceased: isTrue(sp.deceased)
      ? "only"
      : one(sp.deceased) === "0" || one(sp.deceased).toLowerCase() === "false"
        ? "exclude"
        : "",
    needsSurvey: false,
    sort: parseSort(one(sp.sort)),
  };
  for (const facet of FACETS) {
    (f[facet.key] as string[]) = arr(sp[facet.param]);
  }
  for (const flag of BOOLEAN_FLAGS) {
    f[flag.key] = isTrue(sp[flag.param]);
  }
  // Legacy single-param aliases the dashboard's data-quality tiles still emit.
  if (one(sp.missing) === "email") f.missingEmail = true;
  if (one(sp.missing) === "employer") f.missingEmployer = true;
  return f;
}

/* -------------------------------------------------------- serializing ----- */

/** Serialize filter state to the canonical /alumni query string. */
export function toAlumniFilterQs(f: AlumniFilterState): string {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set("q", f.q.trim());
  if (f.ymin.trim()) p.set("ymin", f.ymin.trim());
  if (f.ymax.trim()) p.set("ymax", f.ymax.trim());
  for (const facet of FACETS) {
    for (const v of f[facet.key] as string[]) p.append(facet.param, v);
  }
  // Designations (#404): repeated param, OR semantics server-side.
  for (const v of f.designations) p.append("designations", v);
  if (f.gender) p.set("gender", f.gender);
  if (f.industryGroup) p.set("industry_group", f.industryGroup);
  if (f.contactedAfter) p.set("contacted_after", f.contactedAfter);
  if (f.contactedBefore) p.set("contacted_before", f.contactedBefore);
  for (const flag of BOOLEAN_FLAGS) {
    if (f[flag.key]) p.set(flag.param, "1");
  }
  if (f.deceased === "only") p.set("deceased", "1");
  if (f.deceased === "exclude") p.set("deceased", "0");
  if (f.sort && f.sort !== "name") p.set("sort", f.sort);
  return p.toString();
}

/* ----------------------------------------------------------- population ---- */

/**
 * Which roster the user is on (#218). `alumni` = `/alumni` (graduates only,
 * `is_alumni=true`); `friend` = `/friends` (friends of the program,
 * `is_alumni=false`). The ROUTE fixes it — it is never a URL filter — but it is
 * every bit as much a population predicate as the facets, so it has to travel
 * with them.
 */
export type RosterScope = "alumni" | "friend";

/**
 * The narrowing params the roster honours straight off the URL, with no home in
 * the filter model (`PASS_THROUGH_PARAMS`). They are NOT cosmetic: a dashboard
 * deep link like `?employer=Goldman+Sachs` or `?near=Provo` cuts the list down
 * hard, so anything that claims to cover "the rows the user is looking at" — the
 * CSV export above all — has to see them too (#592).
 */
export interface PassThroughFilters {
  employer: string[];
  net_id: string;
  first_name: string;
  last_name: string;
  preferred_name: string;
  email: string;
  /** Plain-English location search (#358) + its optional radius override. */
  near: string;
  radius: string;
  spoke_after: string;
  spoke_before: string;
}

export const EMPTY_PASS_THROUGH: PassThroughFilters = {
  employer: [],
  net_id: "",
  first_name: "",
  last_name: "",
  preferred_name: "",
  email: "",
  near: "",
  radius: "",
  spoke_after: "",
  spoke_before: "",
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * URL search params → the pass-through filters, validated exactly once (the
 * roster used to validate them inline, which meant the export — reading nothing
 * — could not have agreed with it even in principle).
 */
export function parsePassThroughFilters(sp: SearchParamMap): PassThroughFilters {
  const text = (v: string | string[] | undefined) => one(v).trim();
  const radius = text(sp.radius);
  const spokeAfter = text(sp.spoke_after);
  const spokeBefore = text(sp.spoke_before);
  return {
    employer: arr(sp.employer),
    net_id: text(sp.net_id),
    first_name: text(sp.first_name),
    last_name: text(sp.last_name),
    preferred_name: text(sp.preferred_name),
    email: text(sp.email),
    near: text(sp.near),
    radius: /^\d{1,4}$/.test(radius) ? radius : "",
    spoke_after: ISO_DATE.test(spokeAfter) ? spokeAfter : "",
    spoke_before: ISO_DATE.test(spokeBefore) ? spokeBefore : "",
  };
}

/** Is anything outside the filter model narrowing the view right now? */
export function hasPassThroughFilters(pt: PassThroughFilters): boolean {
  return (
    pt.employer.length > 0 ||
    Boolean(
      pt.net_id ||
        pt.first_name ||
        pt.last_name ||
        pt.preferred_name ||
        pt.email ||
        pt.near ||
        pt.spoke_after ||
        pt.spoke_before,
    )
  );
}

/**
 * **The single definition of which people a view covers** (#592).
 *
 * Returns the `GET /alumni` params that decide MEMBERSHIP — no `limit`,
 * `offset` or `sort`, which change how the matching people are presented but
 * never who they are. The roster builds its API call from this, and
 * `toExportFilters` derives the export body from it, so the list and its CSV
 * cannot answer "who is in this cohort?" differently.
 *
 * The bug that forced this: the export sent `is_alumni: null` meaning "let the
 * backend default it", but an explicitly-null field counts as SET, so the
 * predicate was dropped entirely and 19 friends of the program rode along in a
 * file labelled "the 26 alumni matching your current filters". Hence the rule
 * this function embodies: a predicate is either emitted with a real value or
 * genuinely absent — never a null standing in for a default.
 */
export function toAlumniPopulationParams(
  f: AlumniFilterState,
  scope: RosterScope = "alumni",
  pt: PassThroughFilters = EMPTY_PASS_THROUGH,
): URLSearchParams {
  const p = new URLSearchParams();
  // ALWAYS explicit, even though `alumni` is the backend default. Relying on a
  // default is what let the export lose it.
  p.set("kind", scope);
  if (f.q.trim()) p.set("q", f.q.trim());
  if (f.ymin.trim()) p.set("grad_year_min", f.ymin.trim());
  if (f.ymax.trim()) p.set("grad_year_max", f.ymax.trim());
  for (const facet of FACETS) {
    for (const v of f[facet.key] as string[]) p.append(facet.param, v);
  }
  // Designations (#404): repeated param, OR semantics server-side.
  for (const v of f.designations) p.append("designations", v);
  if (f.gender) p.set("gender", f.gender);
  if (f.industryGroup) p.set("industry_group", f.industryGroup);
  if (f.contactedAfter) p.set("contacted_after", f.contactedAfter);
  if (f.contactedBefore) p.set("contacted_before", f.contactedBefore);
  for (const flag of BOOLEAN_FLAGS) {
    if (f[flag.key]) p.set(flag.api, "true");
  }
  if (f.deceased === "only") p.set("deceased", "true");
  if (f.deceased === "exclude") p.set("deceased", "false");
  // Route-owned (/needs-surveying), never in the URL — but it narrows, so it
  // belongs to the population like anything else.
  if (f.needsSurvey) p.set("needs_survey", "true");
  // Pass-through (URL-only) narrowing params.
  for (const v of pt.employer) p.append("employer", v);
  if (pt.net_id) p.set("net_id", pt.net_id);
  if (pt.first_name) p.set("first_name", pt.first_name);
  if (pt.last_name) p.set("last_name", pt.last_name);
  if (pt.preferred_name) p.set("preferred_name", pt.preferred_name);
  if (pt.email) p.set("email", pt.email);
  if (pt.near) {
    p.set("near", pt.near);
    // `radius` alone means nothing to the backend — it only overrides the radius
    // inferred from a `near` phrase.
    if (pt.radius) p.set("radius", pt.radius);
  }
  if (pt.spoke_after) p.set("spoke_after", pt.spoke_after);
  if (pt.spoke_before) p.set("spoke_before", pt.spoke_before);
  return p;
}

/* ------------------------------------------------------------ counting ---- */

/**
 * How many filters are narrowing the list — the badge on the Filters button.
 * `needsSurvey` is excluded on purpose: it's route-owned, not something the user
 * set here or can clear.
 */
export function countActiveFilters(f: AlumniFilterState): number {
  const facets = FACETS.reduce(
    (n, facet) => n + (f[facet.key] as string[]).length,
    0,
  );
  const flags = BOOLEAN_FLAGS.reduce((n, flag) => n + (f[flag.key] ? 1 : 0), 0);
  return (
    facets +
    flags +
    f.designations.length +
    (f.gender ? 1 : 0) +
    (f.industryGroup ? 1 : 0) +
    (f.ymin.trim() || f.ymax.trim() ? 1 : 0) +
    (f.contactedAfter ? 1 : 0) +
    (f.contactedBefore ? 1 : 0) +
    (f.deceased ? 1 : 0)
  );
}
