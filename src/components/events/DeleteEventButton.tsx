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
import { deleteEvent } from "@/app/(app)/events/actions";

/**
 * Delete-event control for the edit page (full_access). Opens a confirm dialog
 * — deleting an event also removes its attendance rows server-side — and on
 * success returns to the events list. The backend re-enforces the permission.
 */
export function DeleteEventButton({
  eventId,
  eventName,
}: {
  eventId: number;
  eventName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const onConfirm = () => {
    setError(null);
    start(async () => {
      const res = await deleteEvent(eventId);
      if (res.ok) {
        setOpen(false);
        router.push("/events");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  };

  return (
    <>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        Delete event
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          title="Delete this event?"
          description="This also removes its attendance records. This can't be undone."
        >
          <DialogBody>
            <p className="text-sm text-gray-700">
              You&apos;re about to delete{" "}
              <span className="font-semibold text-gray-900">{eventName}</span>.
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
              {pending ? "Deleting…" : "Delete event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
