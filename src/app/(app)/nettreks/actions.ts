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
 * One report as CSV text; the browser turns it into a download. `area` and
 * `kind` are checked before they reach a URL — a server action is a real
 * endpoint anything can call.
 */
export async function exportNetTrekReport(
  area: NetTrekAreaKey,
  kind: NetTrekReportKind,
): Promise<ExportNetTrekReportResult> {
  if (
    !isNetTrekAreaKey(area) ||
    !isNetTrekReportKind(kind) ||
    !netTrekReportExists(area, kind)
  ) {
    return { ok: false, error: netTrekExportErrorMessage(null) };
  }
  try {
    const file = await apiGetFile(netTrekExportPath(area, kind));
    return {
      ok: true,
      csv: file.text,
      filename: file.filename ?? netTrekExportFilename(area, kind),
    };
  } catch (e) {
    return {
      ok: false,
      error: netTrekExportErrorMessage(e instanceof ApiError ? e.status : null),
    };
  }
}
