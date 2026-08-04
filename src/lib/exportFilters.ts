/**
 * The alumni list's filter state → the `POST /alumni/export` body.
 *
 * An export must cover EXACTLY the population the user is looking at, so this
 * module does not restate the filters — it **derives** them. `toExportFilters`
 * asks `toAlumniPopulationParams` (the one definition of who is in a view, also
 * used by the roster to build its `GET /alumni` call) for the membership params
 * and mechanically translates each one into its export-body field. There is no
 * second hand-maintained list to drift, which is the whole point: export/list
 * parity has now broken twice, in two different ways.
 *
 *  - #590 — the panel's newest facets were missing from the export mapping, so
 *    an export ignored them and covered a wider set than the rows on screen.
 *  - #592 — the export sent `is_alumni: null` expecting the backend to apply its
 *    `is_alumni=true` default. But `model_dump(exclude_unset=True)` counts an
 *    explicit null as SET, so the predicate vanished and friends of the program
 *    were exported from the alumni list: 29 records under the words "Exports the
 *    26 alumni matching your current filters".
 *
 * `sort` is intentionally not a membership param — it changes the order of the
 * matching people, never who they are, and the export has its own stable order.
 */
import {
  EMPTY_PASS_THROUGH,
  toAlumniPopulationParams,
  type AlumniFilterState,
  type PassThroughFilters,
  type RosterScope,
} from "@/lib/alumniFilterParams";
import type { AlumniExportFilters } from "@/types/export";

/* --------------------------------------------------- param → body field ---- */

/** Export-body fields whose type is exactly `T` — so a mapping row can't file a
 *  multi-value facet under a boolean field and typecheck anyway. */
type FieldsOfType<T> = {
  [K in keyof AlumniExportFilters]-?: [AlumniExportFilters[K]] extends [T]
    ? [T] extends [AlumniExportFilters[K]]
      ? K
      : never
    : never;
}[keyof AlumniExportFilters];

type MultiField = FieldsOfType<string[] | null>;
type TextField = FieldsOfType<string | null>;
type IntField = FieldsOfType<number | null>;
type FlagField = FieldsOfType<boolean>;
type TriStateField = FieldsOfType<boolean | null>;

type ParamExport =
  /** Repeatable facet → `string[] | null`. */
  | { as: "multi"; field: MultiField }
  /** Single string → `string | null`. */
  | { as: "text"; field: TextField }
  /** Numeric → `number | null`. */
  | { as: "int"; field: IntField }
  /** Present-means-true flag → `boolean`. */
  | { as: "flag"; field: FlagField }
  /** Present-means-a-real-`true`-or-`false` predicate → `boolean | null`, where
   *  the null the field defaults to is the ABSENCE of the predicate. */
  | { as: "tristate"; field: TriStateField }
  /** Roster scope: `kind=alumni|friend` → `is_alumni=true|false`. */
  | { as: "scope" }
  /** `POST /alumni/export` has no field for this one, so an export cannot honour
   *  it. The label is what the user is told (see `exportParityGaps`) — the
   *  export is BLOCKED rather than quietly widened. */
  | { as: "unsupported"; label: string };

/**
 * Every param `toAlumniPopulationParams` can emit, and where it lands in the
 * export body. A param missing from this table is treated as unsupported at
 * runtime (fail closed, never widen) and fails the parity test at build time —
 * so a filter added to the model can't silently stop applying to exports.
 */
const EXPORT_MAPPING: Record<string, ParamExport> = {
  kind: { as: "scope" },
  q: { as: "text", field: "q" },
  grad_year_min: { as: "int", field: "grad_year_min" },
  grad_year_max: { as: "int", field: "grad_year_max" },
  // Multi-select facets.
  employment_status: { as: "multi", field: "employment_status" },
  past_employer: { as: "multi", field: "past_employer" },
  industry: { as: "multi", field: "industry" },
  secondary_industry: { as: "multi", field: "secondary_industry" },
  title: { as: "multi", field: "title" },
  seniority: { as: "multi", field: "seniority" },
  city: { as: "multi", field: "city" },
  state: { as: "multi", field: "state" },
  tag: { as: "multi", field: "tag" },
  status_label: { as: "multi", field: "status_label" },
  leadership_role: { as: "multi", field: "leadership_role" },
  survey_status: { as: "multi", field: "survey_status" },
  employer: { as: "multi", field: "employer" },
  // Identity facets (dashboard deep links).
  net_id: { as: "text", field: "net_id" },
  first_name: { as: "text", field: "first_name" },
  last_name: { as: "text", field: "last_name" },
  preferred_name: { as: "text", field: "preferred_name" },
  email: { as: "text", field: "email" },
  gender: { as: "text", field: "gender" },
  industry_group: { as: "text", field: "industry_group" },
  contacted_after: { as: "text", field: "contacted_after" },
  contacted_before: { as: "text", field: "contacted_before" },
  // Flags.
  never_contacted: { as: "flag", field: "never_contacted" },
  attended_event: { as: "flag", field: "attended_event" },
  donor: { as: "flag", field: "donor" },
  mentor_willing: { as: "flag", field: "mentor_willing" },
  guest_speaker_willing: { as: "flag", field: "guest_speaker_willing" },
  cfa: { as: "flag", field: "cfa" },
  cfp: { as: "flag", field: "cfp" },
  cpa: { as: "flag", field: "cpa" },
  missing_email: { as: "flag", field: "missing_email" },
  missing_employer: { as: "flag", field: "missing_employer" },
  duplicate: { as: "flag", field: "duplicate" },
  include_archived: { as: "flag", field: "include_archived" },
  needs_survey: { as: "flag", field: "needs_survey" },
  deceased: { as: "tristate", field: "deceased" },
  // ---- Formerly unsupported, wired up by fa-web-api#366 --------------------
  // These six narrow the LIST, and until the backend schema gained matching
  // fields the dialog had to warn that the file would be wider. The backend now
  // resolves each through the SAME predicate `GET /alumni` uses, so they map
  // like any other facet and the warning no longer fires for them.
  //
  // `near` is the one with teeth: an un-pinpointable phrase is a 422 from the
  // export rather than a silent nationwide CSV. That refusal is deliberate —
  // the list can fall back to unfiltered because the operator SEES the widened
  // result on screen; a downloaded file gives no such tell.
  designations: { as: "multi", field: "designations" },
  graduate_degree: { as: "flag", field: "graduate_degree" },
  near: { as: "text", field: "near" },
  // Radius is a FLOAT (the backend accepts 1..3000); the "int" case is a
  // `Number()` parse, which is correct for it despite the name.
  radius: { as: "int", field: "radius" },
  spoke_after: { as: "text", field: "spoke_after" },
  spoke_before: { as: "text", field: "spoke_before" },
};

/**
 * The body with NO predicate applied anywhere — every optional filter at the
 * value the backend reads as "don't narrow on this".
 *
 * `is_alumni` is the exception, and deliberately so: it starts `true`, not
 * `null`. `null` there means "alumni AND friends", i.e. the widest possible
 * population, so a bug that failed to set it would leak non-alumni again. This
 * fails CLOSED — the worst a future omission can do is export too few.
 */
const NO_PREDICATE: AlumniExportFilters = {
  q: null,
  net_id: null,
  first_name: null,
  last_name: null,
  preferred_name: null,
  email: null,
  graduation_year: null,
  grad_year_min: null,
  grad_year_max: null,
  deceased: null,
  gender: null,
  industry_group: null,
  employer: null,
  past_employer: null,
  industry: null,
  secondary_industry: null,
  title: null,
  seniority: null,
  employment_status: null,
  city: null,
  state: null,
  tag: null,
  status_label: null,
  leadership_role: null,
  survey_status: null,
  needs_survey: false,
  contacted_after: null,
  contacted_before: null,
  never_contacted: false,
  attended_event: false,
  donor: false,
  mentor_willing: false,
  guest_speaker_willing: false,
  cfp: false,
  cfa: false,
  cpa: false,
  missing_email: false,
  missing_employer: false,
  duplicate: false,
  is_alumni: true,
  include_archived: false,
  // Added by fa-web-api#366. `near`/`radius` null = no location predicate;
  // the two booleans are non-nullable server-side, so false IS "no predicate".
  near: null,
  radius: null,
  designations: null,
  graduate_degree: false,
  spoke_after: null,
  spoke_before: null,
  // Supported by GET /alumni and by the export, but no UI surfaces it today.
  missing_phone: false,
  sort: "name",
};

/* ------------------------------------------------------------ the mapper --- */

/**
 * Filter state (+ the route's scope + the URL-only pass-through filters) → the
 * export body, derived from the very params the list is fetched with.
 */
export function toExportFilters(
  f: AlumniFilterState,
  scope: RosterScope = "alumni",
  pt: PassThroughFilters = EMPTY_PASS_THROUGH,
): AlumniExportFilters {
  const out: AlumniExportFilters = { ...NO_PREDICATE };
  const params = toAlumniPopulationParams(f, scope, pt);
  for (const param of new Set(params.keys())) {
    const mapping = EXPORT_MAPPING[param];
    // Unmapped or unsupported: leave the field at "no predicate" and let
    // `exportParityGaps` stop the export, rather than widen it silently.
    if (!mapping) continue;
    const values = params.getAll(param);
    switch (mapping.as) {
      case "multi":
        out[mapping.field] = values;
        break;
      case "text":
        out[mapping.field] = values[0];
        break;
      case "int": {
        const n = Number(values[0]);
        out[mapping.field] = Number.isFinite(n) ? n : null;
        break;
      }
      case "flag":
        out[mapping.field] = values[0] === "true";
        break;
      case "tristate":
        // Only emitted when a real predicate applies, so the value IS the
        // predicate ("false" = exclude, not "no filter").
        out[mapping.field] = values[0] === "true";
        break;
      case "scope":
        out.is_alumni = values[0] !== "friend";
        break;
    }
  }
  return out;
}

/**
 * Active filters the export API cannot express, as user-facing labels (#592).
 *
 * Non-empty means an export would return a DIFFERENT population than the list —
 * wider, and made of real people's records — so the dialog blocks the download
 * and says which filter is in the way. Empty is the normal case and the
 * invariant the parity test pins: list and export cover the same people.
 */
export function exportParityGaps(
  f: AlumniFilterState,
  scope: RosterScope = "alumni",
  pt: PassThroughFilters = EMPTY_PASS_THROUGH,
): string[] {
  const labels: string[] = [];
  for (const param of new Set(toAlumniPopulationParams(f, scope, pt).keys())) {
    const mapping = EXPORT_MAPPING[param];
    if (!mapping) labels.push(param);
    else if (mapping.as === "unsupported") labels.push(mapping.label);
  }
  return [...new Set(labels)];
}

/** Exposed for the parity test — the mapping is the contract. */
export const EXPORT_MAPPING_FOR_TEST = EXPORT_MAPPING;
