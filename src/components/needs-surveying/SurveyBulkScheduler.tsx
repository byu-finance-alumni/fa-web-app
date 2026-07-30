"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarRange } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/Toast";
import { ApiClientError, clientGet, clientPostJson } from "@/lib/api-client";
import type { components } from "@/types/api.gen";

/** Distinct graduation years present in the DB, straight off the OpenAPI. */
type GradYearCount = components["schemas"]["GraduationYearCount"];
/** One graduation year's auto-send schedule + per-stage sent counts. */
type SurveyScheduleItem = components["schemas"]["SurveyScheduleItem"];
/** Body for bulk creating/replacing schedules for many years in one call. */
type SurveyScheduleBulkRequest =
  components["schemas"]["SurveyScheduleBulkRequest"];

/** Human labels for a schedule status. */
const STATUS_LABEL: Record<string, string> = {
  scheduled: "Scheduled",
  active: "Active",
  completed: "Completed",
  cancelled: "Cancelled",
};

/** Today as an ISO `YYYY-MM-DD` (local, no tz drift) — the min for scheduling. */
function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Format an ISO `YYYY-MM-DD` as e.g. "Mar 3, 2026" (no timezone drift). */
function formatDate(iso: string): string {
  if (!iso) return "Not scheduled";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * "Schedule all years" — a header button that opens a dialog for setting each
 * graduation year's auto-send start date in one pass. Self-contained (matches
 * the SurveySampleEditor / SurveyMessageEditor button+dialog pattern): it fetches
 * its own graduation years + existing schedules when opened, prefilling each row
 * from the year's current schedule, offers an "apply one date to all" shortcut,
 * and POSTs the filled rows to `/survey/schedules/bulk`.
 *
 * On a successful bulk save it dispatches a `survey:schedules-changed` window
 * event so the campaign console below live-refreshes its schedules (and its
 * prefilled per-year date) without a page reload.
 */
export function SurveyBulkScheduler() {
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  // Real DB graduation years + existing schedules (null while loading).
  const [years, setYears] = useState<GradYearCount[] | null>(null);
  const [schedules, setSchedules] = useState<SurveyScheduleItem[] | null>(null);
  // A start date per graduation year, plus an "apply to all" convenience date.
  const [bulkDates, setBulkDates] = useState<Record<number, string>>({});
  const [applyAll, setApplyAll] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Load graduation years + existing schedules, then seed each row's date from
  // the year's current schedule (blank for years that have no schedule yet).
  const load = useCallback(() => {
    setYears(null);
    setSchedules(null);
    Promise.all([
      clientGet<GradYearCount[]>("/survey/graduation-years").catch(() => []),
      clientGet<SurveyScheduleItem[]>("/survey/schedules").catch(() => []),
    ]).then(([yearList, scheduleList]) => {
      const ys = yearList ?? [];
      const scheds = scheduleList ?? [];
      setYears(ys);
      setSchedules(scheds);
      const seed: Record<number, string> = {};
      for (const y of ys) {
        // Seed the date only from a RUNNABLE schedule (scheduled/active) so a
        // cancelled/completed year starts BLANK — it's skipped on submit and
        // never silently re-created from a leftover start date. (The per-row
        // label below still shows the real status, e.g. "Cancelled".)
        const runnable = scheds.find(
          (s) =>
            s.graduation_year === y.graduation_year &&
            (s.status === "scheduled" || s.status === "active"),
        );
        seed[y.graduation_year] = runnable?.start_date ?? "";
      }
      setBulkDates(seed);
      setApplyAll("");
    });
  }, []);

  // Fetch fresh each time the dialog opens so it reflects the latest schedules.
  useEffect(() => {
    if (open) load();
  }, [open, load]);

  // "Apply to all": fill every row with one date.
  const applyDateToAll = (date: string) => {
    setApplyAll(date);
    if (!date) return;
    const next: Record<number, string> = {};
    for (const y of years ?? []) next[y.graduation_year] = date;
    setBulkDates(next);
  };

  // Only rows with a date set are scheduled; blank rows are skipped.
  const filled = (years ?? []).filter(
    (y) => (bulkDates[y.graduation_year] ?? "").length > 0,
  );

  const submit = async () => {
    if (submitting || filled.length === 0) return;
    setSubmitting(true);
    try {
      const body: SurveyScheduleBulkRequest = {
        schedules: filled.map((y) => ({
          graduation_year: y.graduation_year,
          start_date: bulkDates[y.graduation_year],
        })),
      };
      await clientPostJson<SurveyScheduleItem[]>(
        "/survey/schedules/bulk",
        body,
      );
      // Let the campaign console live-refresh its schedules + prefilled date.
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("survey:schedules-changed"));
      }
      setOpen(false);
      const n = body.schedules.length;
      toast.success(`Scheduled ${n} ${n === 1 ? "year" : "years"}.`);
    } catch (err) {
      const msg =
        err instanceof ApiClientError && err.message
          ? err.message
          : "the request failed.";
      toast.error(`Couldn't schedule: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="lg"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        <CalendarRange aria-hidden="true" />
        Schedule all years
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          title="Schedule all graduation years"
          description="Set a start date per class, or apply one date to every year. Blank rows are skipped."
        >
          <DialogBody className="space-y-4">
            {/* Apply-to-all convenience row. */}
            <div className="flex flex-wrap items-end gap-3 rounded-md border border-brand-blue-300/50 bg-brand-blue-50 p-3">
              <div className="min-w-[12rem] flex-1">
                <Label htmlFor="bulk-apply-all">Apply one date to all</Label>
                <Input
                  id="bulk-apply-all"
                  type="date"
                  min={todayIso()}
                  value={applyAll}
                  onChange={(e) => applyDateToAll(e.target.value)}
                  className="mt-1"
                />
              </div>
              <p className="flex-1 text-xs text-gray-500">
                Fills every year below — adjust individual rows afterward.
              </p>
            </div>

            {/* One row per graduation year (scrollable). */}
            <div className="max-h-[22rem] divide-y divide-gray-100 overflow-y-auto rounded-md border border-gray-200">
              {years === null ? (
                <p className="px-4 py-6 text-sm text-gray-500">
                  Loading graduation years…
                </p>
              ) : years.length === 0 ? (
                <p className="px-4 py-6 text-sm text-gray-500">
                  No graduation years found.
                </p>
              ) : (
                years.map((y) => {
                  const existing = schedules?.find(
                    (s) => s.graduation_year === y.graduation_year,
                  );
                  return (
                    <div
                      key={y.graduation_year}
                      className="flex items-center justify-between gap-3 px-4 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium tabular-nums text-gray-900">
                          {y.graduation_year}
                        </p>
                        <p className="text-xs text-gray-400">
                          {existing
                            ? `${STATUS_LABEL[existing.status] ?? existing.status} · starts ${formatDate(existing.start_date)}`
                            : "Not scheduled"}
                        </p>
                      </div>
                      <Input
                        type="date"
                        min={todayIso()}
                        aria-label={`Start date for graduation year ${y.graduation_year}`}
                        value={bulkDates[y.graduation_year] ?? ""}
                        onChange={(e) =>
                          setBulkDates((d) => ({
                            ...d,
                            [y.graduation_year]: e.target.value,
                          }))
                        }
                        className="w-[10.5rem]"
                      />
                    </div>
                  );
                })
              )}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={submit}
              disabled={submitting || filled.length === 0}
            >
              <CalendarRange aria-hidden="true" />
              {submitting
                ? "Scheduling…"
                : `Schedule ${filled.length} ${filled.length === 1 ? "year" : "years"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
