"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { setUserActive } from "@/app/(app)/admin/actions";
import { useToast } from "@/components/ui/Toast";

/**
 * Status badge + super_admin deactivate/reactivate control for one user row.
 *
 * The whole Admin screen is already super_admin-gated and the backend
 * re-enforces it (and the deactivation itself), so this only reflects state and
 * issues the request. Deactivating asks for an inline confirm first (it blocks
 * the user from every authenticated route); reactivating is a single click.
 * A super_admin cannot deactivate their own account, so the control is hidden on
 * the current user's own row — matching the backend's self-deactivation guard.
 *
 * Styling values come from the design system (UX-UI.md): destructive =
 * `danger-600`, secondary = white with `gray-300` border; feedback uses the
 * app-wide toast primitive.
 */
export function UserActiveToggle({
  userId,
  active,
  isSelf,
  name,
}: {
  userId: number;
  active: boolean;
  isSelf: boolean;
  name: string;
}) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function run(next: boolean) {
    setConfirming(false);
    startTransition(async () => {
      const res = await setUserActive(userId, next);
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success(
          next ? `${name} reactivated.` : `${name} deactivated.`,
        );
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <span
        className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${
          active
            ? "bg-success-50 text-success-600"
            : "bg-gray-100 text-gray-400"
        }`}
      >
        {active ? "Active" : "Disabled"}
      </span>

      {isSelf ? (
        <span className="text-xs text-gray-400">(you)</span>
      ) : pending ? (
        <Loader2
          className="h-3.5 w-3.5 animate-spin text-gray-400"
          aria-label="Saving"
        />
      ) : !active ? (
        <button
          type="button"
          onClick={() => run(true)}
          className="rounded-md border border-gray-300 bg-white px-2 py-0.5 text-xs font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-brand-blue-600"
        >
          Reactivate
        </button>
      ) : confirming ? (
        <span className="inline-flex items-center gap-1">
          <button
            type="button"
            onClick={() => run(false)}
            className="rounded-md bg-danger-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-danger-600/90 focus:outline-none focus:ring-1 focus:ring-danger-600"
          >
            Confirm
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="rounded-md border border-gray-300 bg-white px-2 py-0.5 text-xs font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-brand-blue-600"
          >
            Cancel
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="rounded-md border border-gray-300 bg-white px-2 py-0.5 text-xs font-medium text-danger-600 hover:bg-danger-50 focus:outline-none focus:ring-1 focus:ring-danger-600"
        >
          Deactivate
        </button>
      )}
    </div>
  );
}
