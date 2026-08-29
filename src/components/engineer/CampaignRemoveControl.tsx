"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  cancelSurveyCampaign,
  deleteSurveyCampaign,
} from "@/app/(app)/engineer/surveys/actions";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/button";
import {
  campaignRemoveActions,
  campaignRemoveConfirm,
  type CampaignRemoveMode,
} from "./campaign-remove-mode";

/**
 * Remove or stop one graduation year's campaign, next to Pause/Resume (#398).
 *
 * TWO SEPARATE ACTIONS, not one control picking a verb for you:
 *
 *   Delete — always available, whatever the status. The campaign goes; the
 *            emails it sent and the answers alumni submitted stay.
 *   Cancel — only while there is something to stop (scheduled / active /
 *            paused). It ends the sending and KEEPS the campaign listed with its
 *            counts, which is a different thing to want.
 *
 * Delete used to be offered only for a campaign that had never emailed anyone,
 * with `cancel` in its place otherwise and NOTHING at all for an already
 * cancelled one — so nobody could actually delete a real campaign (Jake: "it
 * still won't let me delete a campaign in the engineer dashboard"). The
 * restriction had a real cause: `survey_schedule` is the only holder of the
 * year's cycle number, so removing it used to leave the send-log rows reading as
 * the current cycle's and the next campaign for that year would find everyone
 * already emailed and send to nobody. The backend now RETIRES that cycle on
 * delete, so the next campaign starts above the old sends and reaches those
 * alumni again — see `campaign-remove-mode.ts`.
 *
 * The confirm has to be literal about that, because "delete campaign" reads like
 * the emails and the answers go with it and they do not. It says what is
 * removed, what is kept, and what creating a new campaign for the year will do.
 * It must never say "permanently deletes" — that would simply be false.
 *
 * Both confirms' WORDING lives in `campaign-remove-mode.ts` (#659), so the facts
 * they promise — chiefly that answering holds someone out for a year whatever
 * happens to the campaign — are pinned by tests instead of living only in JSX.
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
  const [confirming, setConfirming] = useState<CampaignRemoveMode | null>(null);

  const { canDelete, canCancel } = campaignRemoveActions(status);
  const hasSent = emailsSentAllTime > 0;
  const emailCount = `${emailsSentAllTime} email${
    emailsSentAllTime === 1 ? "" : "s"
  }`;
  const confirm = confirming
    ? campaignRemoveConfirm(confirming, { graduationYear, emailsSentAllTime })
    : null;

  function run(action: CampaignRemoveMode) {
    startTransition(async () => {
      const res =
        action === "cancel"
          ? await cancelSurveyCampaign(graduationYear)
          : await deleteSurveyCampaign(graduationYear);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(
        action === "cancel"
          ? `Class of ${graduationYear} cancelled. It will not send again, and it stays listed with its counts.`
          : hasSent
            ? `Class of ${graduationYear} campaign deleted. The ${emailCount} it sent and every submitted answer are kept, and you can schedule this year again.`
            : `Class of ${graduationYear} campaign deleted. It never sent anything, and no survey answers were touched.`,
      );
      setConfirming(null);
      // The action revalidates the route, but a bare `startTransition` doesn't
      // re-render the current server component (see PR #138) — force it so the
      // row disappears (or flips to cancelled) immediately.
      router.refresh();
    });
  }

  return (
    <>
      {canCancel ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setConfirming("cancel")}
          disabled={pending}
          title={`Cancel the ${graduationYear} campaign: it stops sending but stays listed`}
        >
          Cancel
        </Button>
      ) : null}

      {canDelete ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setConfirming("delete")}
          disabled={pending}
          title={`Delete the ${graduationYear} campaign: the emails already sent are kept`}
        >
          Delete
        </Button>
      ) : null}

      {confirming && confirm ? (
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
              {confirm.title}
            </h2>
            <div
              id={`remove-desc-${graduationYear}`}
              className="space-y-3 text-sm text-gray-600"
            >
              {confirm.paragraphs.map((para) => (
                <p
                  key={para.text}
                  className={para.emphasis ? "font-medium text-gray-900" : undefined}
                >
                  {para.text}
                </p>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setConfirming(null)}
                disabled={pending}
              >
                Keep it
              </Button>
              <Button
                type="button"
                variant="destructive"
                autoFocus
                onClick={() => run(confirming)}
                disabled={pending}
              >
                {pending
                  ? confirming === "cancel"
                    ? "Cancelling…"
                    : "Deleting…"
                  : confirming === "cancel"
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
