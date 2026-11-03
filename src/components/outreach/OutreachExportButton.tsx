"use client";

import { useTransition } from "react";

import { exportOutreachList } from "@/app/(app)/outreach/actions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/Toast";
import { downloadCsvFile } from "@/lib/csv";
import type { OutreachGroupKey, OutreachListKey } from "@/lib/outreach";

/**
 * "Download CSV" for one Outreach list — the whole list, not just the page on
 * screen. Same flow as the NetTreks report's button. Text only, per the
 * no-icons rule.
 */
export function OutreachExportButton({
  group,
  listKey,
  industry,
  title,
}: {
  group: OutreachGroupKey;
  listKey: OutreachListKey;
  industry: string | null;
  title: string;
}) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  function runExport() {
    startTransition(async () => {
      const res = await exportOutreachList(group, listKey, industry);
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
