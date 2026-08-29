/**
 * The Reports catalogue (#775).
 *
 * WHAT THIS IS, AND WHAT IT IS NOT. Tanya asked whether staff have to enumerate
 * every report they might ever want. They do not: the alumni list already
 * filters on most fields and its CSV export is DERIVED from the same population
 * params (`toAlumniPopulationParams` → `toExportFilters`), so an arbitrary
 * report is a filter away today. This module is therefore **shortcuts to the
 * handful they run often** — not a report builder, not saved reports, not
 * scheduling. Each entry is a name, a sentence saying who is in it, and a link.
 *
 * THE ONE RULE THAT KEEPS IT HONEST: a report that opens the alumni list does
 * not carry a hand-written query string. Its href is SERIALIZED from the filter
 * model (`toAlumniFilterQs` over `EMPTY_FILTERS`), so a report link and the list
 * it opens cannot describe different people — and because the export derives
 * from the very same state, neither can the CSV. Hand-typing `/alumni?…` here
 * would recreate exactly the export/list drift #590 and #592 were about.
 *
 * DELIBERATELY NOT DUPLICATED. `/data-quality` owns missing email / phone /
 * duplicates and `/needs-surveying` owns the survey campaign; this page links to
 * them rather than recomputing them. "Missing employer" appears in both places
 * on purpose (Tanya named it), but the count comes from the same
 * `GET /dashboard/data-quality` field the data-quality page reads, so there is
 * still only one definition of it.
 */
import { CAPABILITY } from "@/constants/capabilities";
import {
  BOOLEAN_FLAGS,
  EMPTY_FILTERS,
  toAlumniFilterQs,
  type AlumniFilterState,
} from "@/lib/alumniFilterParams";
import type { Schema } from "@/types/api";

/** `GET /dashboard/data-quality` — generated from the backend schema. */
export type DataQuality = Schema<"DataQuality">;

/** The boolean filter keys a report may switch on. */
export type ReportFlagKey = (typeof BOOLEAN_FLAGS)[number]["key"];

/**
 * Which `DataQuality` field backs a report's headline number.
 *
 * `missing_photo` is `number | null` in the backend schema and the others are
 * plain `number`; the union keeps that difference visible at every call site
 * instead of letting a `?? 0` creep in (see {@link reportCount}).
 */
export type ReportCountKey = Extract<
  keyof DataQuality,
  "missing_employer" | "missing_linkedin" | "missing_photo"
>;

export type Report = {
  /** Stable id — React key, and what a test names when it fails. */
  id: string;
  title: string;
  /** One sentence: exactly who is in this report. */
  description: string;
  /** Where clicking it goes. */
  href: string;
  /** Text on the link (text-only — UX-UI.md forbids icons on controls). */
  action: string;
  /** Accessible label for the link. */
  linkLabel: string;
  /** Named so staff can see the number is read, not invented. */
  source: string;
  /**
   * Set when the report opens the alumni list on this single boolean filter.
   * The href is derived from it — see {@link listReportHref}.
   */
  flag?: ReportFlagKey;
  /** The data-quality field carrying this report's count, when there is one. */
  countKey?: ReportCountKey;
  /** Capability needed to follow the link without a 403 (UX only). */
  capability?: string;
  /** A caveat that must travel with the report wherever it is shown. */
  note?: string;
};

export type ReportSection = {
  id: string;
  title: string;
  blurb: string;
  reports: Report[];
};

/* ------------------------------------------------------- list-backed hrefs -- */

/** The filter state a single-flag report resolves to. */
export const listReportFilters = (flag: ReportFlagKey): AlumniFilterState => {
  // Assigned rather than spread with a computed key: every `ReportFlagKey` is a
  // boolean field, and writing it this way keeps `tsc` checking that.
  const filters: AlumniFilterState = { ...EMPTY_FILTERS };
  filters[flag] = true;
  return filters;
};

/**
 * The `/alumni` URL for a single-flag report, SERIALIZED from the filter model.
 *
 * Not a string literal on purpose: the roster parses the URL back through
 * `parseAlumniFilters` and builds both its query and its CSV export from the
 * result, so deriving the link from the same serializer is what guarantees the
 * report, the list and the export cover one population. A literal would go stale
 * silently the first time a param is renamed — the failure mode is a link that
 * still works and quietly returns everyone.
 */
export const listReportHref = (flag: ReportFlagKey): string =>
  `/alumni?${toAlumniFilterQs(listReportFilters(flag))}`;

/* ------------------------------------------------------------- the counts -- */

/**
 * ⚠️ `missing_photo` is `int | null` and **null is not zero**.
 *
 * Null means the headshots bucket could not be listed — the backend refuses to
 * serve an empty key set as an answer, because "nobody has a photo" and "we
 * could not find out" produce identical-looking numbers and only one of them is
 * true. Rendering that null as `0` turns a storage outage into "everybody has a
 * photo", which is the opposite of the truth and the reason this helper exists
 * rather than a `?? 0` at the call site.
 */
export const COUNT_UNAVAILABLE = "Unavailable";

export type ReportCount = {
  /** Ready to render: a localized number, or {@link COUNT_UNAVAILABLE}. */
  value: string;
  /** UX-UI.md: missing-data = warning; nothing missing = success. */
  tone: "warning" | "success" | "muted";
  /** True only when the number is UNKNOWN — never for a real zero. */
  unavailable: boolean;
};

/** A data-quality figure as it should be rendered. Null ≠ zero — see above. */
export function reportCount(count: number | null | undefined): ReportCount {
  if (count == null) {
    return { value: COUNT_UNAVAILABLE, tone: "muted", unavailable: true };
  }
  return {
    value: count.toLocaleString(),
    tone: count > 0 ? "warning" : "success",
    unavailable: false,
  };
}

/**
 * Said wherever the photo report is presented, in every state.
 *
 * Staff read "1,438 missing a photo" against "583 headshots on file" and
 * conclude the number is broken. It is not: a headshot is an object in the
 * `headshots` bucket keyed by net ID, so an alumnus with NO net ID has nowhere
 * to store one and is counted as missing it. That materially changes the figure,
 * so it is stated on the page rather than left to be rediscovered.
 */
export const MISSING_PHOTO_NET_ID_NOTE =
  "Alumni with no net ID are counted here: a headshot is stored under the net ID, so there is nowhere to keep one for them.";

/** Shown INSTEAD of a number when `missing_photo` comes back null. */
export const MISSING_PHOTO_UNAVAILABLE_NOTE =
  "The headshot storage could not be listed, so this figure is unknown — it is not zero, and it does not mean every alumnus has a photo. Try again in a few minutes.";

/* ------------------------------------------------------------ the reports -- */

/**
 * Why the two survey reports link to /needs-surveying instead of the list.
 *
 * There is no alumni-list filter that answers "responded to the most recent
 * survey". The list's `survey_status` facet and its `needs_survey` flag both
 * read the legacy `surveys` table, which `models.crm.Survey` documents as
 * READ-ONLY and which nothing in the backend has ever written; live survey
 * activity lives in `survey_responses` + `survey_send_log` and is reachable only
 * through the `/survey/…` campaign endpoints.
 *
 * And "the most recent survey" is ambiguous in the data: campaigns are scoped
 * per GRADUATION YEAR with their own start date and cycle number, so there is no
 * single global survey to be most recent. The campaign console already presents
 * both sides per class — "N of M replied", the already-replied drill-down, and
 * the non-responder call sheet — so these entries point there and say which
 * class to pick, rather than inventing a second, disagreeing answer.
 */
export const SURVEY_SCOPE_NOTE =
  "Survey campaigns run per graduation year, so pick the class on the campaign console — there is no single most-recent survey across all alumni.";

const MISSING_DATA_REPORTS: Report[] = [
  {
    id: "missing-employer",
    title: "No company or employer",
    description:
      "Active alumni with no current employer recorded — career data that needs enrichment.",
    href: listReportHref("missingEmployer"),
    flag: "missingEmployer",
    countKey: "missing_employer",
    action: "Open the list",
    linkLabel: "Open the alumni list filtered to alumni with no employer",
    source:
      "Same count and same predicate as the Data quality page — one definition, read from GET /dashboard/data-quality.",
  },
  {
    id: "missing-linkedin",
    title: "No LinkedIn",
    description:
      "Active alumni with no LinkedIn URL on file. A blank or whitespace-only value counts as missing.",
    href: listReportHref("missingLinkedin"),
    flag: "missingLinkedin",
    countKey: "missing_linkedin",
    action: "Open the list",
    linkLabel: "Open the alumni list filtered to alumni with no LinkedIn",
    source: "GET /dashboard/data-quality, same predicate as the list filter.",
  },
  {
    id: "missing-photo",
    title: "No photo",
    description:
      "Active alumni with no headshot stored. Answered from one cached listing of the headshot storage, so it can be up to five minutes behind an upload.",
    href: listReportHref("missingPhoto"),
    flag: "missingPhoto",
    countKey: "missing_photo",
    action: "Open the list",
    linkLabel: "Open the alumni list filtered to alumni with no photo",
    source: "GET /dashboard/data-quality, same predicate as the list filter.",
    note: MISSING_PHOTO_NET_ID_NOTE,
  },
];

const SURVEY_REPORTS: Report[] = [
  {
    id: "survey-responded",
    title: "Responded to the most recent survey",
    description:
      "Who replied to the campaign for a graduation class, with the date each reply came in.",
    href: "/needs-surveying",
    action: "Open the campaign console",
    linkLabel: "Open the survey campaign console to see who responded",
    source:
      "The campaign console's per-class reply tally and its already-replied list — the live survey response records, not a list filter.",
    capability: CAPABILITY.SURVEYS_MANAGE,
    note: SURVEY_SCOPE_NOTE,
  },
  {
    id: "survey-not-responded",
    title: "Did not respond to the most recent survey",
    description:
      "Who received the campaign emails for a graduation class and never replied — the manual follow-up call sheet.",
    href: "/needs-surveying",
    action: "Open the campaign console",
    linkLabel: "Open the survey campaign console to see who did not respond",
    source:
      "The campaign console's non-responder list for the selected class, built from the send log and the responses.",
    capability: CAPABILITY.SURVEYS_MANAGE,
    note: SURVEY_SCOPE_NOTE,
  },
];

export const REPORT_SECTIONS: ReportSection[] = [
  {
    id: "missing-data",
    title: "Missing data",
    blurb:
      "Each one opens the alumni list already filtered, so it can be worked through, sorted, or exported to CSV from there.",
    reports: MISSING_DATA_REPORTS,
  },
  {
    id: "survey",
    title: "Survey",
    blurb:
      "Survey replies are not a filter on the alumni list — they live with the campaign that sent them, per graduation class.",
    reports: SURVEY_REPORTS,
  },
];

/** Every report, flattened — the order the page renders them in. */
export const ALL_REPORTS: Report[] = REPORT_SECTIONS.flatMap((s) => s.reports);

/* ------------------------------------------------------- the other places -- */

/** Existing screens Reports sends people to rather than reimplementing. */
export type RelatedSurface = {
  href: string;
  title: string;
  description: string;
  capability?: string;
};

export const RELATED_SURFACES: RelatedSurface[] = [
  {
    href: "/data-quality",
    title: "Data quality",
    description:
      "Missing email, missing phone and potential duplicate records, with field-coverage bars. Those counts live there and are not repeated here.",
    capability: CAPABILITY.REPORTS_ADVANCED,
  },
  {
    href: "/needs-surveying",
    title: "Needs Surveying",
    description:
      "The re-survey campaign console: schedule a class, see who was emailed, who replied and who still needs chasing.",
    capability: CAPABILITY.SURVEYS_MANAGE,
  },
  {
    href: "/alumni",
    title: "Alumni list",
    description:
      "Anything not listed above is a filter away. Build it in the Filters panel and use Export to download exactly the rows on screen.",
  },
];

/** Reports whose capability the user holds (or which need none). UX only. */
export const visibleReports = (
  reports: readonly Report[],
  capabilities: readonly string[] = [],
): Report[] =>
  reports.filter((r) => !r.capability || capabilities.includes(r.capability));

/** Sections with their unavailable reports removed, and empties dropped. */
export const visibleReportSections = (
  capabilities: readonly string[] = [],
): ReportSection[] =>
  REPORT_SECTIONS.map((s) => ({
    ...s,
    reports: visibleReports(s.reports, capabilities),
  })).filter((s) => s.reports.length > 0);

/** Related surfaces the user may actually open. */
export const visibleRelatedSurfaces = (
  capabilities: readonly string[] = [],
): RelatedSurface[] =>
  RELATED_SURFACES.filter(
    (s) => !s.capability || capabilities.includes(s.capability),
  );
