"use server";

/**
 * Server action behind the NetTreks report's Download CSV (#887).
 *
 * Same pattern as the survey Progress exports (`needs-surveying/actions.ts`):
 * a server action rather than a browser fetch because the backend names the
 * file in its `Content-Disposition`, which is only readable server-side. The
 * backend re-checks `alumni.export`, rate-limits and audit-logs the download;
 * nothing here widens what the caller can see.
 */

import { apiGetFile, ApiError } from "@/lib/api";
import { isReportFiltered, parseReportViewQuery } from "@/lib/reportView";
import {
  isNetTrekAreaKey,
  isNetTrekReportKind,
  netTrekExportErrorMessage,
  netTrekExportFilename,
  netTrekExportPath,
  netTrekReportExists,
  type NetTrekAreaKey,
  type NetTrekReportKind,
} from "@/lib/nettreks";

export type ExportNetTrekReportResult =
  | { ok: true; csv: string; filename: string }
  | { ok: false; error: string };

/**
 * One report as CSV text; the browser turns it into a download. Filtered and
 * sorted as the page is (`viewQuery`, #919). `area`, `kind` and the view are
 * checked before they reach a URL — a server action is a real endpoint anything
 * can call.
 */
export async function exportNetTrekReport(
  area: NetTrekAreaKey,
  kind: NetTrekReportKind,
  viewQuery = "",
): Promise<ExportNetTrekReportResult> {
  if (
    !isNetTrekAreaKey(area) ||
    !isNetTrekReportKind(kind) ||
    !netTrekReportExists(area, kind)
  ) {
    return { ok: false, error: netTrekExportErrorMessage(null) };
  }
  const view = parseReportViewQuery(viewQuery);
  try {
    const file = await apiGetFile(netTrekExportPath(area, kind, view));
    return {
      ok: true,
      csv: file.text,
      filename:
        file.filename ??
        netTrekExportFilename(area, kind, new Date(), isReportFiltered(view)),
    };
  } catch (e) {
    return {
      ok: false,
      error: netTrekExportErrorMessage(e instanceof ApiError ? e.status : null),
    };
  }
}
