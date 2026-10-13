"use client";

import { useTransition } from "react";

import { exportSurveyList } from "@/app/(app)/needs-surveying/actions";
import { useToast } from "@/components/ui/Toast";
import { downloadCsvFile } from "@/lib/csv";
import { EXPORT_KIND_PHRASE, type SurveyExportKind } from "./responders";

/**
 * "Export" beside a Progress-table count: that column's people as a CSV.
 * `kind` picks the column — "No reply yet" (#836) or "Replied" (#866).
 *
 * `year` null is the totals row — every year in one file. The file is built by
 * the backend from the same predicate as the count; the no-reply file also
 * drops archived alumni (which the count keeps), so it can be a few rows
 * shorter than the number it sits beside — never longer. Text only, per the standing no-icons rule;
 * the in-flight state is the word "Exporting". A failure is a toast rather than
 * an inline sentence because there is no room for one inside a table cell.
 */
export function SurveyExportButton({
  kind,
  year,
}: {
  kind: SurveyExportKind;
  year: number | null;
}) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  function runExport() {
    startTransition(async () => {
      const res = await exportSurveyList(kind, year);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      // The backend dates the filename, so everyone's download of the same
      // list is filed under the same name.
      downloadCsvFile(res.filename, res.csv);
      toast.success("Export downloaded.");
    });
  }

  const phrase = EXPORT_KIND_PHRASE[kind];
  return (
    <button
      type="button"
      onClick={runExport}
      disabled={pending}
      aria-label={
        year === null
          ? `Export everyone ${phrase}, all years, as CSV`
          : `Export the ${year} alumni ${phrase} as CSV`
      }
      className="ml-2 text-xs font-semibold text-brand-blue-600 underline-offset-4 hover:text-brand-blue-500 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500 disabled:opacity-50"
    >
      {pending ? "Exporting…" : "Export"}
    </button>
  );
}
