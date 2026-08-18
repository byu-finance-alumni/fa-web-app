"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { approveLink, rejectLink } from "@/app/(app)/links/actions";
import type { LinkStatus } from "@/lib/opportunityLinks";

/**
 * Approve / Reject for one pending link.
 *
 * Rendered only for holders of the surveys-management permission and only on a
 * row that is still `pending` — an already-decided link shows its status badge
 * instead, because "approve the thing you just rejected" is a correction, not a
 * routine action, and offering it inline invites a mis-click on a moderation
 * queue.
 *
 * Text-only buttons (no icons) per the standing project rule. Both are the small
 * table-row size so the row height does not grow.
 */
export function LinkReviewActions({
  opportunityLinkId,
  status,
  company,
}: {
  opportunityLinkId: number;
  status: LinkStatus;
  /** Company label, for the screen-reader-only part of each button's name. */
  company: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (status !== "pending") return null;

  const run = (
    action: (id: number) => Promise<{ ok: true } | { ok: false; error: string }>,
  ) => {
    setError(null);
    startTransition(async () => {
      const result = await action(opportunityLinkId);
      if (result.ok) {
        // The action revalidates /links; refresh so the row leaves the pending
        // view immediately rather than after the next navigation.
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          disabled={isPending}
          onClick={() => run(approveLink)}
        >
          Approve<span className="sr-only"> {company}</span>
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={isPending}
          onClick={() => run(rejectLink)}
        >
          Reject<span className="sr-only"> {company}</span>
        </Button>
      </div>
      {error ? (
        <p role="alert" className="max-w-[16rem] text-xs text-danger-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
