"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  revokeSession,
  revokeUserSessions,
} from "@/app/(app)/engineer/sessions/actions";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { describeSession } from "@/lib/sessionAge";

/** Typed verbatim to arm a self-sign-out — a deliberate keystroke, not a click. */
const CONFIRM_WORD = "SIGN OUT";

type Props = {
  /** `session` ends this one session; `user` ends every session on the account. */
  scope: "session" | "user";
  sessionId: string;
  userId: number | null;
  email: string | null;
  ageSeconds: number;
  /** This is the session the engineer is signed in with right now. */
  isCurrent: boolean;
  /** The account is the engineer's own (so "revoke all" includes this device). */
  isOwnAccount: boolean;
};

/**
 * Per-row revoke control for the engineer Sessions screen.
 *
 * CONFIRMATION DEPTH IS MATCHED TO CONSEQUENCE, following the app's existing
 * destructive-admin pattern (`admin/DeleteUser`, `engineer/StopAllSurveys`)
 * rather than a fixed ceremony:
 *
 *   * Ending SOMEONE ELSE'S session gets step one only — the "are you sure?"
 *     panel that names who is affected and what happens. It is destructive but
 *     recoverable: they sign in again. Making an engineer type a word per row
 *     during an incident, when the point is to sign several people out quickly,
 *     would push them toward the database instead of this screen.
 *
 *   * Ending YOUR OWN current session — or every session on your own account —
 *     gets the full two-step, type-to-confirm flow, exactly like permanently
 *     deleting a user. It is the one action here with an immediate "oh no"
 *     moment: the console goes away mid-task. Only that branch passes
 *     `confirm_self`, which the backend REQUIRES before it will end the caller's
 *     own session, so a self sign-out cannot happen as a side effect of a
 *     mis-aimed click on a neighbouring row.
 *
 * Text-only, per the project's icon-free control convention. The button only
 * drives the request; the backend re-enforces RequireEngineer and the
 * self-revocation rule, and the toast reports what it actually did rather than
 * an assumed success.
 */
export function RevokeSession({
  scope,
  sessionId,
  userId,
  email,
  ageSeconds,
  isCurrent,
  isOwnAccount,
}: Props) {
  const { toast } = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // null = closed; "confirm" = "are you sure?"; "type" = type-to-confirm.
  const [step, setStep] = useState<null | "confirm" | "type">(null);
  const [typed, setTyped] = useState("");

  // Does this act end the session the engineer is operating from?
  const endsThisDevice = scope === "session" ? isCurrent : isOwnAccount;
  const matches = typed.trim().toUpperCase() === CONFIRM_WORD;
  const who = email ?? "this account";
  const label = scope === "session" ? "Revoke" : "Revoke all";
  const id = `revoke-${scope}-${sessionId}`;

  // "Revoke all" needs a user id; a session with no matching application user
  // (an orphaned Supabase identity) can only be revoked one session at a time.
  if (scope === "user" && userId === null) return null;

  function close() {
    setStep(null);
    setTyped("");
  }

  function run() {
    if (endsThisDevice && !matches) return;
    startTransition(async () => {
      const res =
        scope === "session"
          ? await revokeSession(sessionId, endsThisDevice)
          : await revokeUserSessions(userId as number, endsThisDevice);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const { sessions_deleted, self_revoked } = res.result;
      if (self_revoked) {
        toast.success(
          "You have been signed out everywhere. Sign in again to continue.",
        );
      } else {
        toast.success(
          `Signed ${who} out of ${sessions_deleted} session${
            sessions_deleted === 1 ? "" : "s"
          }.`,
        );
      }
      close();
      // The action revalidates the route, but a bare `startTransition` doesn't
      // re-render the current server component (see PR #138) — force it so the
      // revoked row disappears immediately.
      router.refresh();
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => setStep("confirm")}
        title={
          scope === "session"
            ? `Sign ${who} out of this session`
            : `Sign ${who} out of every session`
        }
        className="border-danger-600/40 text-danger-600 hover:bg-danger-50"
      >
        {label}
      </Button>

      {step !== null ? (
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
              {step === "type"
                ? "Confirm signing yourself out"
                : endsThisDevice
                  ? "Sign yourself out?"
                  : scope === "session"
                    ? "End this session?"
                    : `Sign ${who} out everywhere?`}
            </h2>

            {step === "confirm" ? (
              <>
                <p id={`${id}-desc`} className="text-sm text-gray-600">
                  {scope === "session" ? (
                    <>
                      Ends one session:{" "}
                      <span className="font-medium text-gray-900">
                        {describeSession(email, ageSeconds)}
                      </span>
                      .
                    </>
                  ) : (
                    <>
                      Ends{" "}
                      <span className="font-medium text-gray-900">every</span>{" "}
                      session on{" "}
                      <span className="font-medium text-gray-900">{who}</span>,
                      on every device.
                    </>
                  )}{" "}
                  Their sign-in is deleted so it can never be refreshed, and the
                  token already in their browser stops working immediately, so
                  they are signed out within seconds and have to sign in again.
                  Nothing about the account itself changes: the password still
                  works and no data is touched.
                  {endsThisDevice ? (
                    <>
                      {" "}
                      <span className="font-medium text-danger-600">
                        This includes the session you are using right now.
                      </span>{" "}
                      You will be signed out of the console and will need to
                      sign in again.
                    </>
                  ) : null}
                </p>
                <div className="mt-5 flex justify-end gap-2">
                  <Button type="button" variant="secondary" onClick={close}>
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    autoFocus
                    disabled={pending}
                    onClick={() => (endsThisDevice ? setStep("type") : run())}
                  >
                    {endsThisDevice
                      ? "Yes, continue"
                      : pending
                        ? "Revoking…"
                        : scope === "session"
                          ? "Yes, end it"
                          : "Yes, sign them out"}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p id={`${id}-desc`} className="text-sm text-gray-600">
                  Type{" "}
                  <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-xs text-gray-900">
                    {CONFIRM_WORD}
                  </code>{" "}
                  to sign yourself out. You can sign straight back in: your
                  password is unchanged and the account is not locked.
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
                    {pending ? "Signing out…" : "Sign me out"}
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
