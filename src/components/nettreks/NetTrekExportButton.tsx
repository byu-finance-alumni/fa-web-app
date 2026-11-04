"use client";

import { useTransition } from "react";

import { exportNetTrekReport } from "@/app/(app)/nettreks/actions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/Toast";
import { downloadCsvFile } from "@/lib/csv";
import type { NetTrekAreaKey, NetTrekReportKind } from "@/lib/nettreks";
import { isReportFiltered, reportViewQuery, type ReportView } from "@/lib/reportView";

/**
 * "Download CSV" for one NetTrek report (#887) — the whole report, not just
 * the page on screen, as filtered and sorted on screen (#919). Same flow as the survey Progress exports
 * (`SurveyExportButton`): a server action fetches the file, the browser saves
 * it, a toast reports either outcome. Text only, per the no-icons rule.
 */
export function NetTrekExportButton({
  area,
  kind,
  title,
  view,
}: {
  area: NetTrekAreaKey;
  kind: NetTrekReportKind;
  title: string;
  view: ReportView;
}) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  function runExport() {
    startTransition(async () => {
      const res = await exportNetTrekReport(area, kind, reportViewQuery(view));
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      downloadCsvFile(res.filename, res.csv);
      toast.success("Download complete.");
    });
  }

  return (
    <Button
      type="button"
      onClick={runExport}
      disabled={pending}
      aria-label={`Download ${isReportFiltered(view) ? "filtered " : ""}${title} as CSV`}
    >
      {pending ? "Downloading…" : "Download CSV"}
    </Button>
  );
}
