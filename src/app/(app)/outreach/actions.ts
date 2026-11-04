"use server";

/**
 * Server action behind an Outreach list's Download CSV — the NetTreks report's
 * pattern (`nettreks/actions.ts`): a server action because the backend names
 * the file in its `Content-Disposition`, which is only readable server-side.
 * The backend re-checks `alumni.export`, rate-limits and audit-logs the
 * download; nothing here widens what the caller can see.
 */

import { apiGetFile, ApiError } from "@/lib/api";
import { netTrekExportErrorMessage } from "@/lib/nettreks";
import { isReportFiltered, parseReportViewQuery } from "@/lib/reportView";
import {
  cleanIndustry,
  isOutreachGroupKey,
  isOutreachListKey,
  outreachExportFilename,
  outreachExportPath,
  outreachListExists,
  type OutreachGroupKey,
  type OutreachListKey,
} from "@/lib/outreach";

export type ExportOutreachListResult =
  | { ok: true; csv: string; filename: string }
  | { ok: false; error: string };

/**
 * One list as CSV text; the browser turns it into a download. Filtered and
 * sorted as the page is (`viewQuery`, #919). Every argument is checked before
 * it reaches a URL — a server action is a real endpoint
 * anything can call.
 */
export async function exportOutreachList(
  group: OutreachGroupKey,
  key: OutreachListKey,
  industry: string | null,
  viewQuery = "",
): Promise<ExportOutreachListResult> {
  const ind = typeof industry === "string" ? cleanIndustry(industry) : null;
  if (
    !isOutreachGroupKey(group) ||
    !isOutreachListKey(key) ||
    !outreachListExists(group, key, ind) ||
    (ind !== null && ind.length > 255)
  ) {
    return { ok: false, error: netTrekExportErrorMessage(null) };
  }
  const view = parseReportViewQuery(viewQuery);
  try {
    const file = await apiGetFile(outreachExportPath(group, key, ind, view));
    return {
      ok: true,
      csv: file.text,
      filename:
        file.filename ??
        outreachExportFilename(group, key, ind, new Date(), isReportFiltered(view)),
    };
  } catch (e) {
    return {
      ok: false,
      error: netTrekExportErrorMessage(e instanceof ApiError ? e.status : null),
    };
  }
}
