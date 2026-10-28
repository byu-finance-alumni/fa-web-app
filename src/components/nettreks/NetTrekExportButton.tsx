"use client";

import { useTransition } from "react";

import { exportNetTrekReport } from "@/app/(app)/nettreks/actions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/Toast";
import { downloadCsvFile } from "@/lib/csv";
import type { NetTrekAreaKey, NetTrekReportKind } from "@/lib/nettreks";

/**
 * "Download CSV" for one NetTrek report (#887) — the whole report, not just
 * the page on screen. Same flow as the survey Progress exports
 * (`SurveyExportButton`): a server action fetches the file, the browser saves
 * it, a toast reports either outcome. Text only, per the no-icons rule.
 */
export function NetTrekExportButton({
  area,
  kind,
  title,
}: {
  area: NetTrekAreaKey;
  kind: NetTrekReportKind;
  title: string;
}) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  function runExport() {
    startTransition(async () => {
      const res = await exportNetTrekReport(area, kind);
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
      aria-label={`Download ${title} as CSV`}
    >
      {pending ? "Downloading…" : "Download CSV"}
    </Button>
  );
}
