"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  disableMaintenance,
  enableMaintenance,
  type MaintenanceState,
} from "@/app/(app)/engineer/maintenance/actions";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

/** Typed verbatim to arm the pause — a deliberate keystroke, not a mis-click. */
const CONFIRM_WORD = "MAINTENANCE";

/**
 * The site-wide maintenance switch.
 *
 * The two directions are deliberately asymmetric, and the asymmetry is the whole
 * design:
 *
 *   ON  — two steps plus typing MAINTENANCE, matching `StopAllSurveys`. The
 *         house rule is that ceremony is reserved for irreversible actions, and
 *         maintenance mode itself IS reversible — but the force-logout inside it
 *         is not. Every signed-in user loses their session the instant this
 *         fires, and no amount of turning it back off gives those sessions back.
 *         That is what earns the type-to-confirm.
 *   OFF — one light confirm. This is the RECOVERY direction. Making it as
 *         ceremonious as the ON direction would add friction to exactly the
 *         action someone will be performing under pressure. It still confirms
 *         once so it can't fire on a stray click mid-maintenance.
 *
 * When maintenance is on, the OFF control is the loudest thing on the screen —
 * the engineer arrives here to end it, not to admire the state.
 *
 * Text-only: no icons anywhere in the engineer console.
 *
 * The backend re-enforces RequireEngineer on both endpoints; this only drives
 * the request and reports what actually came back.
 */
export function MaintenanceModeControl({ state }: { state: MaintenanceState }) {
  const { toast } = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<null | "confirm" | "type">(null);
  const [confirmOff, setConfirmOff] = useState(false);
  const [typed, setTyped] = useState("");
  const [message, setMessage] = useState("");

  const matches = typed.trim().toUpperCase() === CONFIRM_WORD;

  function closeOn() {
    setStep(null);
    setTyped("");
  }

  function turnOn() {
    startTransition(async () => {
      const res = await enableMaintenance(message);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      const { sessions_ended } = res.result;
      toast.success(
        sessions_ended === 0
          ? "Maintenance mode is on. Nobody was signed in."
          : `Maintenance mode is on. Signed out ${sessions_ended} ` +
              `${sessions_ended === 1 ? "person" : "people"}. ` +
              "Your session is unaffected.",
      );
      closeOn();
      setMessage("");
      // The action revalidates the route, but a bare `startTransition` doesn't
      // re-render the current server component (see PR #138) — force it so the
      // banner flips immediately.
      router.refresh();
    });
  }

  function turnOff() {
    startTransition(async () => {
      const res = await disableMaintenance();
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(
        "Maintenance mode is off. Everyone can sign in again, and they will need " +
          "to, since their sessions were ended.",
      );
      setConfirmOff(false);
      router.refresh();
    });
  }

  if (state.enabled) {
    return (
      <>
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Status
            </p>
            <p className="text-2xl font-semibold tracking-tight text-danger-600">
              Maintenance mode is ON
            </p>
            <p className="mt-2 text-sm text-gray-500">
              Nobody except engineers can sign in or use the site. Everyone else
              sees the maintenance page. You are still signed in because
              engineers are exempt, which is what lets you turn this off.
            </p>
            <p className="mt-3 text-sm text-gray-500">
              Visitors are being shown:{" "}
              <span className="font-medium text-gray-700">
                “{state.message}”
              </span>
            </p>
          </div>
          <Button type="button" onClick={() => setConfirmOff(true)}>
            Turn off maintenance mode
          </Button>
        </div>

        {confirmOff ? (
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="maint-off-title"
            aria-describedby="maint-off-desc"
            className="fixed inset-0 z-[100] flex items-center justify-center bg-navy-900/50 p-4"
          >
            <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-card">
              <h2
                id="maint-off-title"
                className="mb-3 text-lg font-semibold text-gray-900"
              >
                Turn off maintenance mode?
              </h2>
              <p id="maint-off-desc" className="text-sm text-gray-600">
                The site comes back for everyone and normal sign-in resumes.
                Sessions ended when maintenance started are{" "}
                <span className="font-medium text-gray-900">not</span> restored.
                Everyone signs in again.
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setConfirmOff(false)}
                  disabled={pending}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  autoFocus
                  onClick={turnOff}
                  disabled={pending}
                >
                  {pending ? "Turning off…" : "Turn off maintenance mode"}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Status
          </p>
          <p className="text-2xl font-semibold tracking-tight text-navy-800">
            Maintenance mode is off
          </p>
          <p className="mt-2 text-sm text-gray-500">
            The site is running normally. Turning maintenance on signs out
            everyone who is currently using the site and blocks them from signing
            back in until you turn it off.
          </p>
        </div>
        <Button
          type="button"
          variant="destructive"
          onClick={() => setStep("confirm")}
        >
          Turn on maintenance mode
        </Button>
      </div>

      {step ? (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="maint-on-title"
          aria-describedby="maint-on-desc"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-navy-900/50 p-4"
        >
          <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-card">
            <h2
              id="maint-on-title"
              className="mb-3 text-lg font-semibold text-gray-900"
            >
              {step === "confirm"
                ? "Turn on maintenance mode?"
                : "Confirm turning the site off"}
            </h2>

            {step === "confirm" ? (
              <>
                <p id="maint-on-desc" className="text-sm text-gray-600">
                  Everyone currently signed in is signed out immediately, and
                  nobody but an engineer can sign back in until you turn this
                  off. Unsaved work in someone&rsquo;s open form will be lost.{" "}
                  <span className="font-medium text-gray-900">
                    Your own session is not affected
                  </span>
                  : engineers are exempt, so you can always turn it back off
                  from this page.
                </p>
                <label
                  htmlFor="maint-message"
                  className="mt-5 block text-xs font-medium uppercase tracking-wide text-gray-500"
                >
                  Message shown to visitors (optional)
                </label>
                <Textarea
                  id="maint-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder="Leave blank to use the default message."
                  className="mt-1"
                />
                <p className="mt-1 text-xs text-gray-500">
                  This is shown publicly to anyone who visits the site. Keep it
                  general, with no system detail.
                </p>
                <div className="mt-5 flex justify-end gap-2">
                  <Button type="button" variant="secondary" onClick={closeOn}>
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
                <p id="maint-on-desc" className="text-sm text-gray-600">
                  Type{" "}
                  <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-xs text-gray-900">
                    {CONFIRM_WORD}
                  </code>{" "}
                  to sign everyone out and close the site.
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
                    if (e.key === "Enter" && matches && !pending) turnOn();
                  }}
                  className="mt-3 focus-visible:border-danger-600 focus-visible:ring-danger-600"
                />
                <div className="mt-5 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={closeOn}
                    disabled={pending}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={turnOn}
                    disabled={!matches || pending}
                  >
                    {pending ? "Turning on…" : "Turn on maintenance mode"}
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
