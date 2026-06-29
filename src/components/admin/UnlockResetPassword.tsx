"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, KeyRound, Loader2, ShieldAlert } from "lucide-react";
import { resetUserPassword } from "@/app/(app)/admin/actions";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Super-admin control to unlock a user and reset their password.
 *
 * The whole Admin screen is already super_admin-gated and the backend
 * re-enforces it, so this only issues the request and surfaces the result. On a
 * locked account it reads "Unlock & reset"; otherwise it's a plain "Reset
 * password". The backend returns a one-time temporary password, which we show in
 * a modal exactly once — it is never persisted client-side and won't be shown
 * again. The server action revalidates `/admin`, so the row's "Locked" badge
 * clears after a successful reset.
 *
 * Styling values come from the design system (UX-UI.md): destructive accent =
 * `danger-600`, secondary = white with `gray-300` border; feedback uses the
 * app-wide toast primitive.
 */
export function UnlockResetPassword({
  userId,
  locked,
  name,
}: {
  userId: number;
  locked: boolean;
  name: string;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  // Dismiss the one-time reveal AND refresh the server component so the row's
  // "Locked" badge clears. `resetUserPassword` revalidates `/admin`, but a bare
  // startTransition doesn't re-render the current route on its own (PR #138).
  function done() {
    setTempPassword(null);
    if (locked) router.refresh();
  }

  function run() {
    startTransition(async () => {
      const res = await resetUserPassword(userId);
      if ("error" in res) {
        toast.error(res.error);
      } else {
        setTempPassword(res.tempPassword);
      }
    });
  }

  async function copy() {
    if (!tempPassword) return;
    try {
      await navigator.clipboard.writeText(tempPassword);
      toast.success("Temporary password copied.");
    } catch {
      toast.error("Couldn't copy — select and copy it manually.");
    }
  }

  return (
    <>
      {pending ? (
        <Loader2
          className="h-3.5 w-3.5 animate-spin text-gray-400"
          aria-label="Working"
        />
      ) : (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={run}
          title={
            locked
              ? `Unlock ${name} and reset their password`
              : `Reset ${name}'s password`
          }
          className={cn(
            locked && "border-danger-600/40 text-danger-600 hover:bg-danger-50",
          )}
        >
          <KeyRound className="h-3 w-3" aria-hidden="true" />
          {locked ? "Unlock & reset" : "Reset password"}
        </Button>
      )}

      {tempPassword !== null ? (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="reset-pw-title"
          aria-describedby="reset-pw-desc"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-navy-900/50 p-4"
        >
          <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-card">
            <div className="mb-3 flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-blue-50 text-brand-blue-600">
                <ShieldAlert className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2
                id="reset-pw-title"
                className="text-lg font-semibold text-gray-900"
              >
                Temporary password for {name}
              </h2>
            </div>
            <p id="reset-pw-desc" className="text-sm text-gray-600">
              Give this to the user and have them change it. It won&apos;t be
              shown again.
            </p>

            <div className="mt-4 flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 p-3">
              <code className="min-w-0 flex-1 break-all font-mono text-sm text-gray-900">
                {tempPassword}
              </code>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void copy()}
                title="Copy to clipboard"
                aria-label="Copy temporary password"
              >
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                Copy
              </Button>
            </div>

            <div className="mt-5 flex justify-end">
              <Button type="button" autoFocus onClick={done}>
                Done
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
