"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/Toast";
import { bulkDeleteLinks } from "@/app/(app)/links/actions";
import { useLinksSelection } from "@/components/links/LinksSelection";
import {
  MAX_LINKS_PER_BULK_DELETE,
  bulkDeleteBlockedReason,
  bulkDeleteConfirmMessage,
  bulkDeleteOutcomeMessage,
  linkCountLabel,
  selectionCountLabel,
} from "@/lib/opportunityLinks";

/**
 * The bar that appears under the toolbar while selection mode is on: what is
 * selected, a way to clear it, and the Delete action with its confirmation.
 *
 * Renders nothing outside selection mode, so the default view of the Links tab
 * is unchanged for everyone including holders of `links.delete`.
 *
 * THREE THINGS ARE LOAD-BEARING:
 *
 *  1. The CAP is enforced before the request, not by the 422. `POST
 *     /opportunity-links/bulk-delete` takes at most
 *     {@link MAX_LINKS_PER_BULK_DELETE} ids; over that, Delete is disabled and
 *     the bar says how many are selected and what to do about it.
 *  2. Deletion is CONFIRMED, and the confirmation states the count and that it
 *     cannot be undone. The backend snapshots each row to the audit trail, but
 *     the row itself is gone — there is no restore.
 *  3. The outcome is reported HONESTLY. The endpoint is best-effort: ids that
 *     no longer exist come back in `missing_ids` instead of failing the batch,
 *     so "deleted 4 of the 5 you selected" is what the user is told, never a
 *     flat success. See `bulkDeleteOutcomeMessage`.
 *
 * Text-only controls throughout, per the standing project rule.
 */
export function LinksBulkDeleteBar() {
  const selection = useLinksSelection();
  const router = useRouter();
  const { toast } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!selection?.canDelete || !selection.active) return null;

  const { selected } = selection;
  const count = selected.length;
  const blocked = bulkDeleteBlockedReason(selected);
  const overCap = count > MAX_LINKS_PER_BULK_DELETE;

  function run() {
    startTransition(async () => {
      const res = await bulkDeleteLinks(selected);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const outcome = bulkDeleteOutcomeMessage(res.result);
      if (outcome.tone === "success") {
        toast.success(outcome.message);
      } else {
        toast.info(outcome.message);
      }
      setConfirming(false);
      // Leaving selection mode clears the selection, which matters here beyond
      // tidiness: the ids we just deleted must not stay armed for a second click.
      selection?.exit();
      // The action revalidates /links; refresh so the deleted rows leave the
      // table now rather than on the next navigation.
      router.refresh();
    });
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-brand-blue-600 bg-brand-blue-50 p-3">
      <p
        className="text-sm font-semibold tabular-nums text-gray-900"
        aria-live="polite"
      >
        {selectionCountLabel(count)}
      </p>

      <p className="min-w-0 flex-1 text-sm text-gray-700">
        {overCap
          ? blocked
          : count === 0
            ? "Tick the rows you want to remove. Only the links on this page can be selected."
            : `Deleting is permanent — ${linkCountLabel(
                count,
              )} will be removed for everyone.`}
      </p>

      <Button
        type="button"
        variant="secondary"
        onClick={selection.clear}
        disabled={count === 0 || pending}
        className="h-9"
      >
        Clear selection
      </Button>

      <Button
        type="button"
        variant="destructive"
        onClick={() => setConfirming(true)}
        disabled={blocked !== null || pending}
        className="h-9"
      >
        Delete {count > 0 ? linkCountLabel(count) : "selected"}
      </Button>

      {confirming ? (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="links-bulk-delete-title"
          aria-describedby="links-bulk-delete-desc"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-navy-900/50 p-4"
        >
          <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-card">
            <h2
              id="links-bulk-delete-title"
              className="text-lg font-semibold text-gray-900"
            >
              Delete {linkCountLabel(count)}?
            </h2>
            <p id="links-bulk-delete-desc" className="mt-2 text-sm text-gray-600">
              {bulkDeleteConfirmMessage(count)}
            </p>
            <p className="mt-2 text-sm text-gray-500">
              A record of what was deleted is kept in the audit trail, but the
              {count === 1 ? " link itself cannot" : " links themselves cannot"}{" "}
              be restored.
            </p>
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
                {pending ? "Deleting…" : `Delete ${linkCountLabel(count)}`}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
