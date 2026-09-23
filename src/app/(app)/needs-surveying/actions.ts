"use server";

/**
 * Server action behind the Progress tab's "No reply yet" export (#836).
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
  noReplyExportErrorMessage,
  noReplyExportFilename,
  noReplyExportPath,
} from "@/components/needs-surveying/responders";

export type ExportNoReplyResult =
  | { ok: true; csv: string; filename: string }
  | { ok: false; error: string };

/**
 * One year's "No reply yet" people as CSV text, or every year's when `year` is
 * null. The browser turns the text into a download.
 *
 * `year` is checked before it reaches a URL: a server action is a real
 * endpoint anything can call, and the backend would 422 a bad year anyway, but
 * a sentence the user can read beats a failed request they cannot.
 */
export async function exportNoReply(
  year: number | null,
): Promise<ExportNoReplyResult> {
  if (year !== null && !isExportableYear(year)) {
    return { ok: false, error: noReplyExportErrorMessage(null) };
  }
  try {
    const file = await apiGetFile(noReplyExportPath(year));
    return {
      ok: true,
      csv: file.text,
      filename: file.filename ?? noReplyExportFilename(year),
    };
  } catch (e) {
    return {
      ok: false,
      error: noReplyExportErrorMessage(e instanceof ApiError ? e.status : null),
    };
  }
}
