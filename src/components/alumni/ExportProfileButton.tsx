"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/button";
import { exportProfile } from "@/app/(app)/alumni/actions";

/**
 * Exports the alumni profile as a downloadable JSON file.
 *
 * The exported DATA is fetched from the audited server endpoint
 * (`GET /alumni/{id}/export`, RequireFullAccess) via the `exportProfile` server
 * action — NOT serialized client-side from an in-memory prop. The backend
 * strips the audit trail and internal user PKs and records every export
 * (FERPA / BYU data-governance). The client only turns the returned JSON into a
 * Blob download; `fileBaseName` is used solely for the download filename.
 *
 * Full action feedback per the design system: a pending/disabled state with a
 * spinner while the export is fetched, a success toast on completion, and an
 * error toast on failure (no silent failures).
 */
export function ExportProfileButton({
  alumniId,
  fileBaseName,
}: {
  alumniId: number;
  fileBaseName: string;
}) {
  const { toast } = useToast();
  const [pending, setPending] = useState(false);

  async function handleExport() {
    if (pending) return;
    setPending(true);
    try {
      const result = await exportProfile(alumniId);
      if (!result.ok) {
        toast.error(result.error || "Export failed. Please try again.");
        return;
      }
      const json = JSON.stringify(result.data, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileBaseName || "alumni-profile"}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Defer revocation so the browser has time to start the download.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Profile exported.");
    } catch {
      toast.error("Export failed. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      variant="secondary"
      onClick={handleExport}
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <Download className="h-4 w-4" aria-hidden="true" />
      )}
      {pending ? "Exporting…" : "Export"}
    </Button>
  );
}
