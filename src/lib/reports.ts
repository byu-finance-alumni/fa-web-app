/**
 * The Reports catalogue (#775).
 *
 * WHAT THIS IS, AND WHAT IT IS NOT. Tanya asked whether staff have to enumerate
 * every report they might ever want. They do not: the alumni list already
 * filters on most fields and its CSV export is DERIVED from the same population
 * params (`toAlumniPopulationParams` → `toExportFilters`), so an arbitrary
 * report is a filter away today. This module is therefore **shortcuts to the
 * handful they run often** — not a report builder, not saved reports, not
 * scheduling. Each entry is a name, a short line saying who is in it, and a link.
 *
 * THE ONE RULE THAT KEEPS IT HONEST: a report that opens the alumni list does
 * not carry a hand-written query string. Its href is SERIALIZED from the filter
 * model (`toAlumniFilterQs` over `EMPTY_FILTERS`), so a report link and the list
 * it opens cannot describe different people — and because the export derives
 * from the very same state, neither can the CSV. Hand-typing `/alumni?…` here
 * would recreate exactly the export/list drift #590 and #592 were about.
 *
 * It ALSO keeps the browser Back button working, which is not obvious: the
 * Filters panel re-serializes its state into the URL, and it only navigates
 * when the serialized form differs from what it last wrote. A report href that
 * is already canonical therefore produces NO navigation on arrival — one
 * history entry per click, so Back returns to Reports. See the guards in
 * `reports.test.ts`.
 *
 * DELIBERATELY NOT DUPLICATED. `/data-quality` owns missing email / phone /
 * duplicates and `/needs-surveying` owns the survey campaign; this page links to
 * them rather than recomputing them. "Missing employer" appears in both places
 * on purpose (Tanya named it), but every count here is read from the same
 * `GET /dashboard/data-quality` field the data-quality page reads, so there is
 * still only one definition of it.
 *
 * ⚠️ NO PLUMBING ON SCREEN (Jake, review of #775). Endpoint paths and predicate
 * provenance used to be printed under every row. They are facts a developer
 * wants and a staff screen does not, so they live in these comments now — do
 * not put "GET /…" back into anything that renders.
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

/** Which side of the quoted survey campaign a report's number comes from. */
export type SurveyCountKey = "replied" | "silent";

export type Report = {
  /** Stable id — React key, and what a test names when it fails. */
  id: string;
  title: string;
  /** One short line: who is in this report. */
  description: string;
  /** Where clicking it goes. */
  href: string;
  /** Text on the link (text-only — UX-UI.md forbids icons on controls). */
  action: string;
  /** Accessible label for the link. */
  linkLabel: string;
  /**
   * Set when the report opens the alumni list on this single boolean filter.
   * The href is derived from it — see {@link listReportHref}.
   */
  flag?: ReportFlagKey;
  /** The data-quality field carrying this report's count, when there is one. */
  countKey?: ReportCountKey;
  /** The survey-campaign figure carrying this report's count, when there is one. */
  surveyCountKey?: SurveyCountKey;
  /** Capability needed to follow the link without a 403 (UX only). */
  capability?: string;
  /** A caveat that must travel with the report wherever it is shown. */
  note?: string;
};

export type ReportSection = {
  id: string;
  title: string;
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
 *
 * It is also what keeps Back working: an href the panel would have written
 * itself is one the panel will not rewrite on arrival.
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
 * to store one and is counted as missing it.
 */
export const MISSING_PHOTO_NET_ID_NOTE =
  "Counts alumni with no net ID — a headshot is stored under the net ID, so there is nowhere to keep one for them.";

/** Shown INSTEAD of a number when `missing_photo` comes back null. */
export const MISSING_PHOTO_UNAVAILABLE_NOTE =
  "Headshot storage could not be listed, so this figure is unknown — not zero. Try again shortly.";

/* ---------------------------------------------------- the survey campaigns -- */

/** `GET /survey/schedules` — one row per graduation year. */
export type SurveySchedule = Schema<"SurveyScheduleItem">;

/**
 * Why the survey reports quote ONE class rather than a grand total.
 *
 * There is no alumni-list filter that answers "responded to the most recent
 * survey": the list's `survey_status` facet and its `needs_survey` flag both
 * read the legacy `surveys` table, which `models.crm.Survey` documents as
 * READ-ONLY and which nothing in the backend has ever written. Live survey
 * activity lives in `survey_responses` + `survey_send_log`, reachable only
 * through the `/survey/…` campaign endpoints — and none of them returns a
 * global responder count.
 *
 * ⚠️ AND THERE IS NO GLOBAL NUMBER TO COMPUTE, EITHER. `survey_schedule` holds
 * one row per graduation year, each with its own start date, its own cycle and
 * its own status, and several classes can be live at once. Summing `replied`
 * and `recipients` across those rows adds a campaign that finished months ago to
 * one that was emailed yesterday and is still inside its reminder cadence, plus
 * completed and cancelled rows, and silently omits every class never scheduled.
 * That total would be a number nobody could act on and everybody would read as
 * "the survey" — so it is not computed. What IS quoted is a single, nameable
 * campaign: the class whose campaign started most recently and has actually
 * sent. Both survey rows carry the class year on screen for that reason.
 */
export const SURVEY_SCOPE_NOTE =
  "Campaigns run per graduation year; this is the class whose campaign started most recently.";

/** Statuses whose figures are worth quoting. `cancelled` never is. */
const QUOTABLE_STATUSES = new Set(["scheduled", "active", "completed"]);

/** The one campaign the survey reports put a number against. */
export type QuotedCampaign = {
  graduationYear: number;
  /** ISO date the campaign's current cycle started. */
  startDate: string;
  /** Distinct alumni emailed in that cycle — the denominator. */
  emailed: number;
  /** Of those, how many have replied (rejected submissions do not count). */
  replied: number;
  /** Emailed and still silent. Clamped; includes people mid-cadence. */
  silent: number;
};

/**
 * Pick the campaign whose numbers the survey reports quote.
 *
 * The rule, stated so it can be argued with: the most recently STARTED campaign
 * that has actually emailed somebody. A campaign with `recipients === 0` is
 * scheduled but unsent, and "0 of 0 replied" is not a fact about anybody — so it
 * is skipped rather than shown as a zero. Cancelled campaigns are skipped too:
 * their send log is real but nobody is working them.
 *
 * Ties on `start_date` (bulk-scheduled classes all share one) break on the
 * higher graduation year, which is the newest cohort — arbitrary but stable, and
 * the year is named on screen so the reader always knows which one they got.
 */
export function quotedCampaign(
  items: readonly SurveySchedule[] | null | undefined,
): QuotedCampaign | null {
  if (!items || items.length === 0) return null;
  const eligible = items.filter(
    (i) => QUOTABLE_STATUSES.has(i.status) && i.recipients > 0,
  );
  if (eligible.length === 0) return null;
  const best = eligible.reduce((a, b) => {
    if (a.start_date !== b.start_date) return a.start_date > b.start_date ? a : b;
    return a.graduation_year >= b.graduation_year ? a : b;
  });
  return {
    graduationYear: best.graduation_year,
    startDate: best.start_date,
    emailed: best.recipients,
    replied: best.replied,
    // Clamped: `replied` above `recipients` would be a backend bug, and a
    // negative "still silent" on screen is a puzzle rather than a report.
    silent: Math.max(0, best.recipients - best.replied),
  };
}

/** The figure a survey report shows, or null when there is no campaign to quote. */
export function surveyCount(
  campaign: QuotedCampaign | null,
  key: SurveyCountKey,
): ReportCount | null {
  if (!campaign) return null;
  const value = key === "replied" ? campaign.replied : campaign.silent;
  return {
    value: value.toLocaleString(),
    // Deliberately NOT the missing-data warning tone: a reply is not a defect,
    // and the silent side is a call sheet, not a data-quality failure.
    tone: "muted",
    unavailable: false,
  };
}

/**
 * WHOSE number it is, and which side of the campaign — rendered next to every
 * survey figure.
 *
 * A count with no owner on this screen would be read as "the survey", which is
 * the one thing it is not. Never show the number without this line, and keep it
 * side-specific: printing "3 of 14 have replied" beside a badge reading 11 makes
 * the reader do the subtraction, and half of them will do it wrong.
 */
export const surveyCountLabel = (
  campaign: QuotedCampaign,
  key: SurveyCountKey,
): string => {
  const of = `of ${campaign.emailed.toLocaleString()} emailed, Class of ${campaign.graduationYear}`;
  return key === "replied"
    ? `${campaign.replied.toLocaleString()} ${of}, have replied.`
    : `${campaign.silent.toLocaleString()} ${of}, have not replied yet.`;
};

/** Said instead of a number when no campaign has sent anything yet. */
export const SURVEY_COUNT_UNAVAILABLE_NOTE =
  "No campaign has been emailed yet, so there is nothing to count.";

/* ------------------------------------------------------------ the reports -- */

const MISSING_DATA_REPORTS: Report[] = [
  {
    id: "missing-employer",
    // Count and predicate are the Data quality page's, read from the one
    // `GET /dashboard/data-quality` field — two screens, one definition.
    title: "No company or employer",
    description: "Active alumni with no current employer on file.",
    href: listReportHref("missingEmployer"),
    flag: "missingEmployer",
    countKey: "missing_employer",
    action: "Open the list",
    linkLabel: "Open the alumni list filtered to alumni with no employer",
  },
  {
    id: "missing-linkedin",
    // Blank and whitespace-only both count as missing, backend-side.
    title: "No LinkedIn",
    description: "Active alumni with no LinkedIn URL on file.",
    href: listReportHref("missingLinkedin"),
    flag: "missingLinkedin",
    countKey: "missing_linkedin",
    action: "Open the list",
    linkLabel: "Open the alumni list filtered to alumni with no LinkedIn",
  },
  {
    id: "missing-photo",
    // Answered from one cached listing of the headshots bucket, so it can trail
    // an upload by up to five minutes.
    title: "No photo",
    description: "Active alumni with no headshot stored.",
    href: listReportHref("missingPhoto"),
    flag: "missingPhoto",
    countKey: "missing_photo",
    action: "Open the list",
    linkLabel: "Open the alumni list filtered to alumni with no photo",
    note: MISSING_PHOTO_NET_ID_NOTE,
  },
];

const SURVEY_REPORTS: Report[] = [
  {
    id: "survey-responded",
    title: "Responded to the most recent survey",
    description: "Replies to the class campaign, with the date each came in.",
    href: "/needs-surveying",
    action: "Open the campaign console",
    linkLabel: "Open the survey campaign console to see who responded",
    surveyCountKey: "replied",
    capability: CAPABILITY.SURVEYS_MANAGE,
    note: SURVEY_SCOPE_NOTE,
  },
  {
    id: "survey-not-responded",
    title: "Did not respond to the most recent survey",
    description: "Emailed and still silent — the follow-up call sheet.",
    href: "/needs-surveying",
    action: "Open the campaign console",
    linkLabel: "Open the survey campaign console to see who did not respond",
    surveyCountKey: "silent",
    capability: CAPABILITY.SURVEYS_MANAGE,
    note: SURVEY_SCOPE_NOTE,
  },
];

export const REPORT_SECTIONS: ReportSection[] = [
  { id: "missing-data", title: "Missing data", reports: MISSING_DATA_REPORTS },
  { id: "survey", title: "Survey", reports: SURVEY_REPORTS },
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
      "Missing email, missing phone and possible duplicates, with coverage bars.",
    capability: CAPABILITY.REPORTS_ADVANCED,
  },
  {
    href: "/needs-surveying",
    title: "Needs Surveying",
    description:
      "Schedule a class, then see who was emailed, who replied and who still needs chasing.",
    capability: CAPABILITY.SURVEYS_MANAGE,
  },
  {
    href: "/alumni",
    title: "Alumni list",
    description:
      "Anything else is a filter away, and Export downloads exactly the rows on screen.",
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
