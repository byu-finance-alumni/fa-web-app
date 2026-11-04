"use client";

import { useTransition } from "react";

import { exportOutreachList } from "@/app/(app)/outreach/actions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/Toast";
import { downloadCsvFile } from "@/lib/csv";
import type { OutreachGroupKey, OutreachListKey } from "@/lib/outreach";
import { isReportFiltered, reportViewQuery, type ReportView } from "@/lib/reportView";

/**
 * "Download CSV" for one Outreach list — the whole list, not just the page on
 * screen, as filtered and sorted on screen (#919). Same flow as the NetTreks report's button. Text only, per the
 * no-icons rule.
 */
export function OutreachExportButton({
  group,
  listKey,
  industry,
  title,
  view,
}: {
  group: OutreachGroupKey;
  listKey: OutreachListKey;
  industry: string | null;
  title: string;
  view: ReportView;
}) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  function runExport() {
    startTransition(async () => {
      const res = await exportOutreachList(group, listKey, industry, reportViewQuery(view));
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
