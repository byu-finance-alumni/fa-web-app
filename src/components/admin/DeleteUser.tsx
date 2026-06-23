"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2, TriangleAlert } from "lucide-react";
import { deleteUser } from "@/app/(app)/admin/actions";
import { useToast } from "@/components/ui/Toast";

/**
 * Super-admin / engineer control to PERMANENTLY delete a user.
 *
 * Two-step guard so a destructive, irreversible action can't be a single
 * mis-click: (1) an "Are you sure?" confirmation explaining what delete does,
 * then (2) the admin must type the user's exact email before the Delete button
 * enables. The whole Admin screen is already super_admin/engineer-gated and the
 * backend re-enforces every rule (self-delete, engineer ceiling, last-admin),
 * so this only drives the request and surfaces the result via the toast.
 *
 * Hidden on the current admin's own row and (for non-engineers) on engineer
 * rows — `canDelete` is decided by the parent, matching the backend guards.
 *
 * Styling comes from the design system (UX-UI.md): destructive = `danger-600`,
 * secondary = white with `gray-300` border; modal mirrors UnlockResetPassword.
 */
export function DeleteUser({
  userId,
  email,
  name,
}: {
  userId: number;
  email: string;
  name: string;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // null = closed; "confirm" = "are you sure?"; "type" = type-email-to-confirm.
  const [step, setStep] = useState<null | "confirm" | "type">(null);
  const [typed, setTyped] = useState("");

  const matches = typed.trim().toLowerCase() === email.toLowerCase();

  function close() {
    setStep(null);
    setTyped("");
  }

  function run() {
    if (!matches) return;
    startTransition(async () => {
      const res = await deleteUser(userId);
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success(`${name} permanently deleted.`);
        close();
        // `deleteUser` calls `revalidatePath("/admin")`, which refreshes the
        // server cache but does NOT re-render the current route when the action
        // is invoked from a bare `startTransition` (see PR #138). Without this,
        // the deleted row stays on screen ("the user remains") and a second
        // click 404s the now-gone id. Force the server component to re-fetch so
        // the row disappears immediately.
        router.refresh();
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setStep("confirm")}
        title={`Permanently delete ${name}`}
        className="inline-flex items-center gap-1 rounded-md border border-danger-600/40 bg-white px-2 py-0.5 text-xs font-medium text-danger-600 hover:bg-danger-50 focus:outline-none focus:ring-1 focus:ring-danger-600"
      >
        <Trash2 className="h-3 w-3" aria-hidden="true" />
        Remove
      </button>

      {step !== null ? (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="del-user-title"
          aria-describedby="del-user-desc"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-navy-900/50 p-4"
        >
          <div className="w-full max-w-md rounded-xl border border-gray-300 bg-white p-6 shadow-lg">
            <div className="mb-3 flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger-50 text-danger-600">
                <TriangleAlert className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2
                id="del-user-title"
                className="text-lg font-semibold text-gray-900"
              >
                {step === "confirm"
                  ? `Delete ${name}?`
                  : `Confirm deleting ${name}`}
              </h2>
            </div>

            {step === "confirm" ? (
              <>
                <p id="del-user-desc" className="text-sm text-gray-600">
                  This <strong>permanently</strong> removes the account and its
                  login — it cannot be undone. To suspend access reversibly,
                  deactivate the user instead. Activity history and audit records
                  are kept.
                </p>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={close}
                    className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-brand-blue-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    autoFocus
                    onClick={() => setStep("type")}
                    className="inline-flex items-center justify-center rounded-md bg-danger-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-danger-600/90 focus:outline-none focus:ring-1 focus:ring-danger-600"
                  >
                    Yes, continue
                  </button>
                </div>
              </>
            ) : (
              <>
                <p id="del-user-desc" className="text-sm text-gray-600">
                  Type{" "}
                  <code className="break-all rounded bg-gray-100 px-1 py-0.5 font-mono text-[13px] text-gray-900">
                    {email}
                  </code>{" "}
                  to confirm permanent deletion.
                </p>
                <input
                  type="email"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  autoFocus
                  autoComplete="off"
                  spellCheck={false}
                  aria-label={`Type ${email} to confirm`}
                  placeholder={email}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && matches && !pending) run();
                  }}
                  className="mt-3 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-danger-600 focus:outline-none focus:ring-1 focus:ring-danger-600"
                />
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={close}
                    disabled={pending}
                    className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-brand-blue-600 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={run}
                    disabled={!matches || pending}
                    className="inline-flex items-center justify-center gap-1.5 rounded-md bg-danger-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-danger-600/90 focus:outline-none focus:ring-1 focus:ring-danger-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {pending ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    )}
                    Delete user
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
