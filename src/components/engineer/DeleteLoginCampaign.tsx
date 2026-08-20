"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteLoginCampaign } from "@/app/(app)/engineer/login-failures/actions";
import {
  loginCampaignConfirm,
  loginCampaignSummary,
} from "@/app/(app)/engineer/login-failures/campaign-delete";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/button";

/**
 * Per-source "delete campaign" control on the engineer Login-failures table.
 *
 * It removes EVERYTHING recorded for one source IP: the per-attempt
 * `login_failures` rows, the abuse incident opened for it, and any block on it.
 * The button sits on a row of the attempt list because that is the screen an
 * engineer is on when they decide a campaign is finished with, but the act is
 * per SOURCE, not per row — which is the first thing the confirm says.
 *
 * A FULL CONFIRM PANEL, not the one-line inline confirm `LiftLoginBlock` uses,
 * because the consequences run the opposite way. Lifting is the safe direction:
 * the worst case is an attacker gets their hour back and is re-blocked when they
 * cross the threshold again. This is irreversible, it destroys a security log,
 * and it can un-block someone as a side effect. So it gets the modal that names
 * the address and states all three consequences — the same panel shape
 * `RevokeSession` shows before it ends someone else's session.
 *
 * NO TYPE-TO-CONFIRM. Matched to consequence, following the depth ladder
 * `RevokeSession` documents rather than a fixed ceremony: the typed word there
 * is reserved for the one act with an immediate "oh no" moment — signing
 * YOURSELF out, so the console disappears mid-task. Nothing here can lock the
 * engineer out or touch an alumni record; what is destroyed is telemetry about
 * an attacker, and the forensic trail of the deletion itself survives in the
 * append-only engineer action log, which is not deletable from this or any other
 * screen. A word to type per source during an incident cleanup is the kind of
 * friction that sends someone to psql instead, which is the thing this control
 * exists to replace.
 *
 * Text-only, per the project's icon-free control convention. The button only
 * drives the request; the backend re-enforces the engineer gate, rate limits it,
 * and returns the counts it actually deleted — which the toast reports rather
 * than assuming a success.
 */
export function DeleteLoginCampaign({
  ipAddress,
  attemptsOnPage,
}: {
  ipAddress: string;
  /** How many rows on the page in front of the reader share this address. */
  attemptsOnPage: number;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  const confirm = loginCampaignConfirm({ ipAddress, attemptsOnPage });
  const id = `delete-campaign-${ipAddress}`;

  function run() {
    startTransition(async () => {
      const res = await deleteLoginCampaign(ipAddress);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(loginCampaignSummary(res.result));
      setConfirming(false);
      // The action revalidates the route, but a bare `startTransition` does not
      // re-render the current server component (see PR #138) — force it so the
      // deleted rows disappear immediately.
      router.refresh();
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => setConfirming(true)}
        title={`Delete everything recorded for ${ipAddress}`}
        className="border-danger-600/40 text-danger-600 hover:bg-danger-50"
      >
        Delete campaign
      </Button>

      {confirming ? (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={`${id}-title`}
          aria-describedby={`${id}-desc`}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-navy-900/50 p-4"
        >
          <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 text-left shadow-card">
            <h2
              id={`${id}-title`}
              className="mb-3 text-lg font-semibold text-gray-900"
            >
              {confirm.title}
            </h2>
            <div id={`${id}-desc`} className="space-y-3">
              {confirm.paragraphs.map((p, i) => (
                <p
                  key={i}
                  className={
                    p.emphasis
                      ? "text-sm font-medium text-danger-600"
                      : "text-sm text-gray-600"
                  }
                >
                  {p.text}
                </p>
              ))}
            </div>
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
                variant="destructive"
                autoFocus
                onClick={run}
                disabled={pending}
              >
                {pending ? "Deleting…" : confirm.confirmLabel}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
