"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { pauseAllSurveys } from "@/app/(app)/engineer/surveys/actions";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/button";

/**
 * Engineer blanket pause: hold EVERY running survey campaign at once.
 *
 * Sits directly beside `StopAllSurveys`, and the difference between them has to
 * be unmistakable, because one is recoverable and the other is not:
 *
 *   pause — reversible. One confirm step, a plain (non-destructive) button, and
 *           copy that says out loud that each year can be resumed and picks its
 *           cadence up where it left off.
 *   stop  — terminal. Two steps, the destructive button, and typing STOP.
 *
 * So this deliberately does NOT reuse the type-the-word guard: making a
 * recoverable action as ceremonious as an irrecoverable one teaches people to
 * type past both. It still confirms once and names exactly which graduation
 * years it will hold, so it can't fire on a stray click.
 *
 * The button only drives the request; the backend re-enforces RequireEngineer
 * on POST /survey/schedules/pause-all and returns what it actually paused,
 * which is what the toast reports (never an assumed success).
 */
export function PauseAllSurveys({ activeYears }: { activeYears: number[] }) {
  const { toast } = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const count = activeYears.length;

  function run() {
    startTransition(async () => {
      const res = await pauseAllSurveys();
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      const { paused, graduation_years } = res.result;
      if (paused === 0) {
        // Someone else stopped them between the page render and the click.
        toast.success("No campaigns were running, so there was nothing to pause.");
      } else {
        toast.success(
          `Paused ${paused} campaign${paused === 1 ? "" : "s"} for ` +
            `graduation year${paused === 1 ? "" : "s"} ${graduation_years.join(", ")}. ` +
            `No emails will send until ${paused === 1 ? "it is" : "they are"} resumed.`,
        );
      }
      setOpen(false);
      // The action revalidates the route, but a bare `startTransition` doesn't
      // re-render the current server component (see PR #138) — force it so the
      // table flips to paused immediately.
      router.refresh();
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        onClick={() => setOpen(true)}
        disabled={count === 0}
        title={
          count === 0
            ? "No campaigns are currently running"
            : `Pause all ${count} running campaigns (reversible)`
        }
      >
        Pause all active surveys
      </Button>

      {open ? (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="pause-surveys-title"
          aria-describedby="pause-surveys-desc"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-navy-900/50 p-4"
        >
          <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-card">
            <h2
              id="pause-surveys-title"
              className="mb-3 text-lg font-semibold text-gray-900"
            >
              Pause {count} running campaign{count === 1 ? "" : "s"}?
            </h2>
            <p id="pause-surveys-desc" className="text-sm text-gray-600">
              Sending stops for graduation year
              {count === 1 ? " " : "s "}
              <span className="font-medium text-gray-900">
                {activeYears.join(", ")}
              </span>{" "}
              until you resume {count === 1 ? "it" : "them"}.{" "}
              <span className="font-medium text-gray-900">
                This is reversible.
              </span>{" "}
              Resuming picks each campaign up exactly where it left off. The
              time spent paused doesn’t count against its reminder schedule, so
              nothing is skipped. To stop {count === 1 ? "it" : "them"} for good
              instead, use Stop all active surveys.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="navy"
                autoFocus
                onClick={run}
                disabled={pending}
              >
                {pending ? "Pausing…" : "Pause all surveys"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
