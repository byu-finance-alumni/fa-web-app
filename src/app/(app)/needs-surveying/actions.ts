"use server";

/**
 * Server action behind the Progress tab's CSV exports: "No reply yet" (#836)
 * and "Replied" (#866).
 *
 * A server action rather than a browser fetch for the same reason as the Links
 * report (`links/actions.ts`): the backend names the file in its
 * `Content-Disposition`, and that header is only readable server-side — the
 * API does not expose it cross-origin. The backend re-checks the caller's
 * permission; nothing here widens what they can see.
 */

import { apiGetFile, ApiError } from "@/lib/api";
import {
  isExportableYear,
  surveyExportErrorMessage,
  surveyExportFilename,
  surveyExportPath,
  type SurveyExportKind,
} from "@/components/needs-surveying/responders";

export type ExportSurveyListResult =
  | { ok: true; csv: string; filename: string }
  | { ok: false; error: string };

/**
 * One year's `kind` list as CSV text, or every year's when `year` is null. The
 * browser turns the text into a download.
 *
 * `kind` and `year` are both checked before they reach a URL: a server action
 * is a real endpoint anything can call, and the backend would 404/422 a bad
 * value anyway, but a sentence the user can read beats a failed request they
 * cannot.
 */
export async function exportSurveyList(
  kind: SurveyExportKind,
  year: number | null,
): Promise<ExportSurveyListResult> {
  if (kind !== "no-reply" && kind !== "replied") {
    return { ok: false, error: surveyExportErrorMessage(null) };
  }
  if (year !== null && !isExportableYear(year)) {
    return { ok: false, error: surveyExportErrorMessage(null) };
  }
  try {
    const file = await apiGetFile(surveyExportPath(kind, year));
    return {
      ok: true,
      csv: file.text,
      filename: file.filename ?? surveyExportFilename(kind, year),
    };
  } catch (e) {
    return {
      ok: false,
      error: surveyExportErrorMessage(e instanceof ApiError ? e.status : null),
    };
  }
}
