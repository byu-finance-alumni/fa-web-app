"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import type { Profile } from "@/types/profile";

/**
 * Exports the alumni profile as a downloadable JSON file.
 *
 * Provides full action feedback per the design system: a pending/disabled
 * state with a spinner while the file is generated, a success toast on
 * completion, and an error toast if generation/download fails (no silent
 * failures). The export is produced entirely on the client from the profile
 * data already loaded on the page.
 */
export function ExportProfileButton({
  profile,
  fileBaseName,
}: {
  profile: Profile;
  fileBaseName: string;
}) {
  const { toast } = useToast();
  const [pending, setPending] = useState(false);

  async function handleExport() {
    if (pending) return;
    setPending(true);
    try {
      const json = JSON.stringify(
        { exported_at: new Date().toISOString(), profile },
        null,
        2,
      );
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
    <button
      type="button"
      onClick={handleExport}
      disabled={pending}
      aria-busy={pending}
      className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <Download className="h-4 w-4" aria-hidden="true" />
      )}
      {pending ? "Exporting…" : "Export"}
    </button>
  );
}
