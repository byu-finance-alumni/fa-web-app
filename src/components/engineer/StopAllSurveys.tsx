"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { stopAllSurveys } from "@/app/(app)/engineer/surveys/actions";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Typed verbatim to arm the stop — a deliberate keystroke, not a mis-click. */
const CONFIRM_WORD = "STOP";

/**
 * Engineer kill switch: cancel EVERY running survey campaign at once.
 *
 * Two-step guard, matching the permanent-delete-user flow (`admin/DeleteUser`):
 * (1) an "are you sure?" panel naming exactly which graduation years stop, then
 * (2) the engineer types STOP before the button enables. A cancelled campaign
 * does not resume — it has to be re-scheduled by hand — so this must never fire
 * on one click. Disabled outright when nothing is running.
 *
 * The button only drives the request; the backend re-enforces RequireEngineer
 * on POST /survey/schedules/cancel-all and returns what it actually cancelled,
 * which is what the toast reports (never an assumed success).
 */
export function StopAllSurveys({ activeYears }: { activeYears: number[] }) {
  const { toast } = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // null = closed; "confirm" = "are you sure?"; "type" = type-STOP-to-confirm.
  const [step, setStep] = useState<null | "confirm" | "type">(null);
  const [typed, setTyped] = useState("");

  const count = activeYears.length;
  const matches = typed.trim().toUpperCase() === CONFIRM_WORD;

  function close() {
    setStep(null);
    setTyped("");
  }

  function run() {
    if (!matches) return;
    startTransition(async () => {
      const res = await stopAllSurveys();
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      const { cancelled, graduation_years } = res.result;
      if (cancelled === 0) {
        // Someone else stopped them between the page render and the click.
        toast.success("No campaigns were running — nothing to stop.");
      } else {
        toast.success(
          `Stopped ${cancelled} campaign${cancelled === 1 ? "" : "s"} — ` +
            `graduation year${cancelled === 1 ? "" : "s"} ${graduation_years.join(", ")}. No further emails will send.`,
        );
      }
      close();
      // `stopAllSurveys` revalidates the route, but a bare `startTransition`
      // doesn't re-render the current server component (see PR #138) — force it
      // so the campaign table drops to zero active immediately.
      router.refresh();
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        onClick={() => setStep("confirm")}
        disabled={count === 0}
        title={
          count === 0
            ? "No campaigns are currently running"
            : `Cancel all ${count} running campaigns`
        }
      >
        Stop all active surveys
      </Button>

      {step !== null ? (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="stop-surveys-title"
          aria-describedby="stop-surveys-desc"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-navy-900/50 p-4"
        >
          <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-card">
            <h2
              id="stop-surveys-title"
              className="mb-3 text-lg font-semibold text-gray-900"
            >
              {step === "confirm"
                ? `Stop ${count} running campaign${count === 1 ? "" : "s"}?`
                : "Confirm stopping every campaign"}
            </h2>

            {step === "confirm" ? (
              <>
                <p id="stop-surveys-desc" className="text-sm text-gray-600">
                  This cancels the survey campaign for graduation year
                  {count === 1 ? " " : "s "}
                  <span className="font-medium text-gray-900">
                    {activeYears.join(", ")}
                  </span>
                  . No further survey emails — initial or reminder — will be
                  sent for {count === 1 ? "it" : "them"}. Cancelled campaigns do
                  not resume; each one has to be re-scheduled by hand. Emails
                  already delivered and replies already collected are kept.
                </p>
                <div className="mt-5 flex justify-end gap-2">
                  <Button type="button" variant="secondary" onClick={close}>
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    autoFocus
                    onClick={() => setStep("type")}
                  >
                    Yes, continue
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p id="stop-surveys-desc" className="text-sm text-gray-600">
                  Type{" "}
                  <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-xs text-gray-900">
                    {CONFIRM_WORD}
                  </code>{" "}
                  to stop every running campaign.
                </p>
                <Input
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  autoFocus
                  autoComplete="off"
                  spellCheck={false}
                  aria-label={`Type ${CONFIRM_WORD} to confirm`}
                  placeholder={CONFIRM_WORD}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && matches && !pending) run();
                  }}
                  className="mt-3 focus-visible:border-danger-600 focus-visible:ring-danger-600"
                />
                <div className="mt-5 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={close}
                    disabled={pending}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={run}
                    disabled={!matches || pending}
                  >
                    {pending ? "Stopping…" : "Stop all surveys"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
