"use client";

import { useState, useTransition } from "react";
import { exportLinks } from "@/app/(app)/links/actions";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/button";
import {
  linksDateRangeError,
  toLinksQs,
  type LinksFilterState,
} from "@/lib/opportunityLinks";

/**
 * "Export CSV" on the Links toolbar — the file half of the dated report (#771).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE ONE RULE: THE FILE IS THE LIST
 * ─────────────────────────────────────────────────────────────────────────────
 * `filters` is the state THE PAGE RENDERED THE LIST FROM — the toolbar hands it
 * its own `initial` prop, which is the page's `effectiveFilters`, which is the
 * object that built the `/opportunity-links` request. It is deliberately NOT the
 * toolbar's local, mid-typing state: those two disagree for 300 ms after every
 * keystroke, and exporting from the newer one would hand someone a file that
 * does not match the rows they were looking at when they clicked.
 *
 * From there it stays derived: the click sends `toLinksQs(filters)` — literally
 * the list's own query string — and the server action re-parses it and asks the
 * backend with `toLinksExportQuery`, which is `toLinksApiQuery` minus paging.
 * One selection, three readers, no second assembler anywhere on the path.
 *
 * ERRORS ARE SHOWN, NOT THROWN. A failed export renders as a sentence under the
 * toolbar that names what to do about it — narrow the range, change the status,
 * sign in again — and stays on screen until the next attempt, because "413" in a
 * toast that vanished is not something a person can act on. Text only, per the
 * standing no-icons rule; the in-flight state is the word "Exporting".
 */
export function LinksExportButton({ filters }: { filters: LinksFilterState }) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // An inverted range selects nothing and the backend answers it with a 422.
  // The Filters menu says so where it was typed and the list says so where the
  // rows would be, so here it is enough to not offer a download that cannot
  // succeed.
  const rangeError = linksDateRangeError(filters);

  function runExport() {
    setError(null);
    startTransition(async () => {
      const res = await exportLinks(toLinksQs(filters));
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      // The backend dates the filename, so two people exporting the same report
      // file it under the same name.
      a.download = res.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Export downloaded.");
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        onClick={runExport}
        disabled={pending || rangeError !== null}
        className="h-9 shrink-0"
      >
        {pending ? "Exporting…" : "Export CSV"}
      </Button>

      {error ? (
        // `basis-full` breaks the toolbar's flex row so the sentence gets a line
        // of its own rather than squeezing the controls.
        <p
          role="alert"
          className="basis-full text-sm leading-relaxed text-danger-600"
        >
          {error}
        </p>
      ) : null}
    </>
  );
}
