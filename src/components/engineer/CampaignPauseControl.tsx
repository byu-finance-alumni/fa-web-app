"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  pauseSurvey,
  resumeSurvey,
} from "@/app/(app)/engineer/surveys/actions";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/button";

/**
 * Per-campaign Pause / Resume for one graduation year.
 *
 * The friction is deliberately asymmetric, and inverted from what a delete-style
 * control would do:
 *
 *   Pause  — fires on one click. It STOPS emails going out and is fully
 *            reversible, so there is nothing to protect against; a confirm here
 *            would only slow down the one action someone reaches for in a hurry.
 *   Resume — confirms first. It START emails going out again to a whole cohort,
 *            which is the failure everyone is nervous about, so it names the
 *            year and says what happens next before it fires.
 *
 * Neither is the terminal `cancel` — that stays on Manage → Needs Surveying (per
 * year) and the Stop all switch above (blanket). Rendering nothing for a
 * completed or cancelled campaign is intentional: the backend 409s those, so
 * offering a button that can only fail would be a lie.
 *
 * The backend re-enforces full access on both routes; this only drives them and
 * reports the state it actually got back.
 */
export function CampaignPauseControl({
  graduationYear,
  status,
}: {
  graduationYear: number;
  status: string;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  const isPaused = status === "paused";
  const isRunning = status === "scheduled" || status === "active";

  function run(mode: "pause" | "resume") {
    startTransition(async () => {
      const res =
        mode === "pause"
          ? await pauseSurvey(graduationYear)
          : await resumeSurvey(graduationYear);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(
        mode === "pause"
          ? `Class of ${graduationYear} paused. No survey emails will send for it until it is resumed.`
          : `Class of ${graduationYear} resumed. It picks up at the stage it was on when it was paused, and ` +
              `the time it spent paused doesn’t count against its reminder schedule.`,
      );
      setConfirming(false);
      // The action revalidates the route, but a bare `startTransition` doesn't
      // re-render the current server component (see PR #138) — force it so this
      // row's status flips immediately.
      router.refresh();
    });
  }

  if (!isPaused && !isRunning) return null;

  if (isRunning) {
    return (
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => run("pause")}
        disabled={pending}
        title={`Pause the ${graduationYear} campaign (reversible)`}
      >
        {pending ? "Pausing…" : "Pause"}
      </Button>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => setConfirming(true)}
        disabled={pending}
        title={`Resume the ${graduationYear} campaign`}
      >
        Resume
      </Button>

      {confirming ? (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={`resume-title-${graduationYear}`}
          aria-describedby={`resume-desc-${graduationYear}`}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-navy-900/50 p-4"
        >
          <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 text-left shadow-card">
            <h2
              id={`resume-title-${graduationYear}`}
              className="mb-3 text-lg font-semibold text-gray-900"
            >
              Resume the Class of {graduationYear} campaign?
            </h2>
            <p
              id={`resume-desc-${graduationYear}`}
              className="text-sm text-gray-600"
            >
              Survey emails to the Class of{" "}
              <span className="font-medium text-gray-900">
                {graduationYear}
              </span>{" "}
              start going out again on the next daily run. It picks up at the
              stage it was on when it was paused, and the time it spent paused
              doesn’t count against its reminder schedule, so no reminder is
              skipped and nobody already emailed is emailed twice.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setConfirming(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="navy"
                autoFocus
                onClick={() => run("resume")}
                disabled={pending}
              >
                {pending ? "Resuming…" : "Resume campaign"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
