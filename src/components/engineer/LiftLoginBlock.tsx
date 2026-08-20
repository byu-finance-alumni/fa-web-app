"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { liftLoginIpBlock } from "@/app/(app)/engineer/maintenance/actions";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/button";

/**
 * Per-row "lift" control for the automatic login blocks.
 *
 * ONE CONFIRM STEP, no type-to-confirm. The depth is matched to consequence, the
 * same way `RevokeSession` matches its two flows: lifting is the SAFE direction.
 * It lets someone sign in again — the worst case is that an attacker gets their
 * hour back and is re-blocked the moment they cross the threshold again a day
 * later. The confirm exists only because the decision is sticky, which is the
 * one thing the panel says: the source will not be automatically re-blocked for
 * 24 hours. Without that grace the block would snap back on the next failed
 * sign-in and this button would be decorative, so the stickiness is the feature
 * and it is what the reader needs to know before clicking.
 *
 * Text-only, per the project's icon-free control convention. The button only
 * drives the request; the backend re-enforces RequireEngineer and answers 404 if
 * the block already lapsed, which the toast reports rather than assuming a
 * success.
 */
export function LiftLoginBlock({
  blockId,
  ipAddress,
}: {
  blockId: number;
  ipAddress: string;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function run() {
    startTransition(async () => {
      const res = await liftLoginIpBlock(blockId);
      if (!res.ok) {
        toast.error(res.error);
        setConfirming(false);
        // Even a failure is news: a 404 means the row on screen is stale.
        router.refresh();
        return;
      }
      toast.success(
        `${res.ipAddress} can sign in again. It will not be blocked automatically for 24 hours.`,
      );
      setConfirming(false);
      // The action revalidates the route, but a bare `startTransition` does not
      // re-render the current server component (see PR #138) — force it so the
      // row updates immediately.
      router.refresh();
    });
  }

  if (!confirming) {
    return (
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setConfirming(true)}
        aria-label={`Lift the block on ${ipAddress}`}
      >
        Lift
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <p className="text-xs text-gray-500">
        Let {ipAddress} sign in again? It will not be blocked automatically for
        24 hours, even if it keeps failing.
      </p>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setConfirming(false)}
          disabled={pending}
        >
          Cancel
        </Button>
        <Button size="sm" onClick={run} disabled={pending}>
          {pending ? "Lifting…" : "Lift block"}
        </Button>
      </div>
    </div>
  );
}
