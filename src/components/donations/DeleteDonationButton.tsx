"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/Toast";
import { deleteDonation } from "@/app/(app)/pay-it-forward/actions";

/**
 * Delete-donation control (H4) for the alumni profile "Pay it forward" tab.
 * Calls DELETE /donations/{id} behind a confirm dialog and, on success,
 * refreshes the list and toasts. The trigger is rendered only for the admin tier
 * (full_access / super_admin / engineer) by the parent — the same gate as event
 * delete — and the backend re-enforces the permission regardless.
 */
export function DeleteDonationButton({
  donationId,
  label,
}: {
  donationId: number;
  /** Accessible label for the small text trigger (e.g. the gift's date). */
  label: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const onConfirm = () => {
    setError(null);
    start(async () => {
      const res = await deleteDonation(donationId);
      if (res.ok) {
        setOpen(false);
        toast.success("Donation deleted.");
        router.refresh();
      } else {
        setError(res.error);
        toast.error(res.error);
      }
    });
  };

  return (
    <>
      <Button
        type="button"
        variant="link"
        size="sm"
        aria-label={`Delete donation (${label})`}
        title="Delete donation"
        className="h-auto px-0 text-danger-600 hover:text-danger-600"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        Delete
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          title="Delete this donation?"
          description="This cannot be undone."
        >
          <DialogBody>
            <p className="text-sm text-gray-700">
              Delete this donation? This cannot be undone.
            </p>
            {error && (
              <p className="mt-3 rounded-md border border-danger-600/30 bg-danger-50 px-3 py-2 text-sm text-danger-600">
                {error}
              </p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={onConfirm} disabled={pending}>
              {pending ? "Deleting…" : "Delete donation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
