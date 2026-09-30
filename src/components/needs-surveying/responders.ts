/**
 * The names behind the Progress tab's counts, and its "No reply yet" export
 * (#836).
 *
 * `GET /survey/schedules/{year}/responders` lists who is behind a year's
 * "Replied" and "Looks good" counts; the backend builds it from the SAME
 * predicate as the counts, so each list is as long as its number.
 * `GET /survey/schedules/{year}/no-reply/export` (and the all-years
 * `/survey/schedules/no-reply/export`) download the "No reply yet" column as a
 * CSV. The pure parts — paths, which list a cell reads, the sentences — live
 * here so they can be pinned by a test without a DOM, like `held-out.ts` and
 * `campaign-progress.ts` next door.
 */
import type { components } from "@/types/api.gen";

export type SurveyResponders = components["schemas"]["SurveyResponders"];
export type SurveyResponder = components["schemas"]["SurveyResponder"];

/** Which count a hover belongs to: "Replied" or "Looks good" (`confirmed`). */
export type ResponderKind = "replied" | "confirmed";

/** The column heading each kind sits under, reused as the popover's title. */
export const RESPONDER_KIND_LABEL: Record<ResponderKind, string> = {
  replied: "Replied",
  confirmed: "Looks good",
};

/** One year's responders. One request serves both of the year's hovers. */
export function respondersRequestPath(graduationYear: number): string {
  return `/survey/schedules/${graduationYear}/responders`;
}

/** The list a cell shows. `confirmed` is a subset of `replied`. */
export function respondersFor(
  data: SurveyResponders,
  kind: ResponderKind,
): SurveyResponder[] {
  return data[kind];
}

/* ------------------------------------------ median-hover fill times ------ */

/** One replier with a recorded fill time, for the median-hover breakdown. */
export type ResponderFillTime = {
  alumni_id: number;
  name: string;
  fillSeconds: number;
};

/**
 * The `replied` people who have a recorded fill time, longest first — the
 * breakdown behind the "Median time to complete" hover (#543 follow-on).
 *
 * The backend attaches `fill_seconds` to each replier: the same representative
 * time the median is built over, or null for a replier with no usable timer (a
 * confirmation, or a response predating the column). The nulls are dropped, so
 * the hover lists exactly the people whose times make up the median. Ordered
 * DESCENDING so the slowest — the outliers that pull a median up — read first.
 */
export function fillTimeResponders(
  data: SurveyResponders,
): ResponderFillTime[] {
  return data.replied
    .map((p) => ({
      alumni_id: p.alumni_id,
      name: p.name,
      fillSeconds: p.fill_seconds ?? null,
    }))
    .filter((p): p is ResponderFillTime => typeof p.fillSeconds === "number")
    .sort((a, b) => b.fillSeconds - a.fillSeconds);
}

/**
 * Said only when the names do not match the number beside them.
 *
 * The backend guarantees they match at the same instant, but the table was
 * loaded when the tab opened and the names are fetched on first hover, so a
 * reply landing in between makes them differ by one. Saying so beats a list
 * that silently disagrees with its own heading. Empty string when they agree.
 */
export function respondersDriftNote(shown: number, count: number): string {
  if (shown === count) return "";
  return `This list has ${shown.toLocaleString()}; the table showed ${count.toLocaleString()} when it loaded. Reload the page to update the counts.`;
}

/* ----------------------------------------------------- no-reply export ---- */

// The API's accepted graduation-year range (`_GRAD_YEAR_MIN`/`_MAX` in
// fa-web-api `routes/survey.py`; 1900 is the test cohort). The server action
// is a real endpoint anything can call, so it refuses anything else rather
// than splicing it into a URL.
const GRAD_YEAR_MIN = 1900;
const GRAD_YEAR_MAX = 2100;

export function isExportableYear(year: unknown): year is number {
  return (
    typeof year === "number" &&
    Number.isInteger(year) &&
    year >= GRAD_YEAR_MIN &&
    year <= GRAD_YEAR_MAX
  );
}

/** One year's "No reply yet" CSV, or every year's when `year` is null. */
export function noReplyExportPath(year: number | null): string {
  return year === null
    ? "/survey/schedules/no-reply/export"
    : `/survey/schedules/${year}/no-reply/export`;
}

/**
 * The name used when the backend's `Content-Disposition` is missing or unsafe.
 * Matches the backend's own `survey_no_reply_<year|all>_<YYYY-MM-DD>.csv`, so
 * the file is named the same either way.
 */
export function noReplyExportFilename(
  year: number | null,
  now: Date = new Date(),
): string {
  return `survey_no_reply_${year ?? "all"}_${now.toISOString().slice(0, 10)}.csv`;
}

/** What to tell someone whose export failed — and what to do about it. */
export function noReplyExportErrorMessage(status: number | null): string {
  if (status === 401) {
    return "Your session has expired, so the export didn’t run. Sign in again and try it once more.";
  }
  if (status === 403) {
    return "Exporting this list needs survey access. Ask a Super Admin if you need it.";
  }
  if (status === 404) {
    return "That graduation year no longer has a campaign, so there is nothing to export. Reload the page.";
  }
  if (status === 429) {
    return "Too many requests just now, so the export didn’t run. Wait a few seconds and try again.";
  }
  return "The export didn’t run, so no file was downloaded. Nothing has changed. Try again in a moment.";
}
