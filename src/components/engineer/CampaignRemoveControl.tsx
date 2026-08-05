"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  cancelSurveyCampaign,
  deleteSurveyCampaign,
} from "@/app/(app)/engineer/surveys/actions";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/button";
import { campaignRemoveMode } from "./campaign-remove-mode";

/**
 * Remove one graduation year's campaign, next to Pause/Resume (#398).
 *
 * Jake: "make it so in the surveys you can delete the survey campaigns next to
 * the resume button." A campaign scheduled against the wrong year was stuck
 * there forever — pausing hid the symptom, the row stayed.
 *
 * ONE control, TWO honest verbs, chosen by whether the campaign has ever emailed
 * anyone (`emailsSentAllTime`):
 *
 *   Delete — nothing was ever sent. The schedule row is all that exists, so it
 *            goes.
 *   Cancel — emails went out. The row stays, terminally stopped, beside the
 *            history it explains. Not politeness: `survey_schedule` is the only
 *            holder of the year's cycle number, so deleting it would make the
 *            next campaign for this year think everyone had already been emailed
 *            and send to nobody. The backend refuses the delete outright; this
 *            just never offers it.
 *
 * Either way the emails already sent and the answers alumni submitted are kept,
 * and the confirm says so — "delete campaign" reads like it takes those with it,
 * and it does not.
 *
 * Nothing is offered for an already-cancelled campaign: it is stopped, and the
 * backend would only refuse a delete for the same cycle-number reason.
 */
export function CampaignRemoveControl({
  graduationYear,
  status,
  emailsSentAllTime,
}: {
  graduationYear: number;
  status: string;
  emailsSentAllTime: number;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  // The verb, and whether there is one at all — see `campaignRemoveMode`.
  const mode = campaignRemoveMode(status, emailsSentAllTime);
  const hasSent = mode === "cancel";

  function run() {
    startTransition(async () => {
      const res = hasSent
        ? await cancelSurveyCampaign(graduationYear)
        : await deleteSurveyCampaign(graduationYear);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(
        hasSent
          ? `Class of ${graduationYear} cancelled. It will not send again; the ${emailsSentAllTime} email${
              emailsSentAllTime === 1 ? "" : "s"
            } already sent and every submitted answer are kept.`
          : `Class of ${graduationYear} campaign deleted. It never sent anything, and no survey answers were touched.`,
      );
      setConfirming(false);
      // The action revalidates the route, but a bare `startTransition` doesn't
      // re-render the current server component (see PR #138) — force it so the
      // row disappears (or flips to cancelled) immediately.
      router.refresh();
    });
  }

  if (mode === "none") return null;

  const verb = hasSent ? "Cancel" : "Delete";

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => setConfirming(true)}
        disabled={pending}
        title={
          hasSent
            ? `Cancel the ${graduationYear} campaign — it has already emailed ${emailsSentAllTime}`
            : `Delete the ${graduationYear} campaign — it has never sent anything`
        }
      >
        {verb}
      </Button>

      {confirming ? (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={`remove-title-${graduationYear}`}
          aria-describedby={`remove-desc-${graduationYear}`}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-navy-900/50 p-4"
        >
          <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 text-left shadow-card">
            <h2
              id={`remove-title-${graduationYear}`}
              className="mb-3 text-lg font-semibold text-gray-900"
            >
              {hasSent
                ? `Cancel the Class of ${graduationYear} campaign?`
                : `Delete the Class of ${graduationYear} campaign?`}
            </h2>
            <div
              id={`remove-desc-${graduationYear}`}
              className="space-y-3 text-sm text-gray-600"
            >
              {hasSent ? (
                <>
                  <p>
                    This campaign has already emailed{" "}
                    <span className="font-medium text-gray-900">
                      {emailsSentAllTime}{" "}
                      {emailsSentAllTime === 1 ? "alum" : "alumni"}
                    </span>
                    , so it is cancelled rather than deleted: it stops sending
                    immediately and stays listed as history. A cancelled campaign
                    never resumes — re-running this cohort means scheduling a new
                    one.
                  </p>
                  <p className="font-medium text-gray-900">
                    The emails already sent and every answer alumni submitted are
                    kept.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    This campaign has never sent an email, so the schedule is
                    removed outright and this graduation year disappears from the
                    list. No survey email will go out for it.
                  </p>
                  <p className="font-medium text-gray-900">
                    Nothing else is deleted — any survey answers on record for
                    this graduation year stay in the database and on the alumni’s
                    profiles.
                  </p>
                </>
              )}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setConfirming(false)}
                disabled={pending}
              >
                Keep it
              </Button>
              <Button
                type="button"
                variant="destructive"
                autoFocus
                onClick={run}
                disabled={pending}
              >
                {pending
                  ? hasSent
                    ? "Cancelling…"
                    : "Deleting…"
                  : hasSent
                    ? "Cancel campaign"
                    : "Delete campaign"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
