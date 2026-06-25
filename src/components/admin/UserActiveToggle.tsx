"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { setUserActive } from "@/app/(app)/admin/actions";
import { useToast } from "@/components/ui/Toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
  const router = useRouter();
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
        // revalidatePath alone doesn't re-render this route from a bare
        // startTransition (PR #138) — refresh so the status badge flips.
        router.refresh();
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Badge variant={active ? "success" : "muted"} className="shrink-0">
        {active ? "Active" : "Disabled"}
      </Badge>

      {isSelf ? (
        <span className="text-xs text-gray-400">(you)</span>
      ) : pending ? (
        <Loader2
          className="h-3.5 w-3.5 animate-spin text-gray-400"
          aria-label="Saving"
        />
      ) : !active ? (
        <Button type="button" variant="secondary" size="sm" onClick={() => run(true)}>
          Reactivate
        </Button>
      ) : confirming ? (
        <span className="inline-flex items-center gap-1">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => run(false)}
          >
            Confirm
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setConfirming(false)}
          >
            Cancel
          </Button>
        </span>
      ) : (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setConfirming(true)}
          className="text-danger-600 hover:bg-danger-50"
        >
          Deactivate
        </Button>
      )}
    </div>
  );
}
