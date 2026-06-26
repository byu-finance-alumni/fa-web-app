"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { updateUserName } from "@/app/(app)/admin/actions";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";

/**
 * Super-admin inline editor for a user's first/last name. A small pencil button
 * (matching the per-row icon affordance used elsewhere) opens a dialog with
 * first/last inputs that calls `updateUserName` (the `/name` sub-path) and, on
 * success, toasts and revalidates `/admin`. The whole Admin screen is
 * super_admin-gated and the backend re-enforces it.
 *
 * Works in both the desktop table row Name cell and the mobile card. Styling
 * values come from the design system (UX-UI.md): primary = `brand-blue-600`,
 * secondary = white + `gray-300` border, errors = `danger-600`. The modal is the
 * shared <Dialog> primitive (Radix: focus-trap, Esc-to-close, scroll-lock).
 */

export function UserNameEditor({
  userId,
  firstName,
  lastName,
}: {
  userId: number;
  firstName: string | null;
  lastName: string | null;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [first, setFirst] = useState(firstName ?? "");
  const [last, setLast] = useState(lastName ?? "");
  const [error, setError] = useState<string | null>(null);

  function start() {
    // Reset to the latest props each time the dialog opens.
    setFirst(firstName ?? "");
    setLast(lastName ?? "");
    setError(null);
    setOpen(true);
  }

  function submit() {
    if (first.trim().length > 100 || last.trim().length > 100) {
      setError("Names must be 100 characters or fewer.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await updateUserName(userId, first.trim(), last.trim());
      if (res?.error) {
        setError(res.error);
        toast.error(res.error);
      } else {
        setOpen(false);
        toast.success("Name updated.");
        // revalidatePath alone doesn't re-render from a bare startTransition
        // (PR #138) — refresh so the row's display name updates immediately.
        router.refresh();
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="icon"
        aria-label="Edit name"
        title="Edit name"
        onClick={start}
        className="h-7 w-7 shrink-0 text-gray-500 hover:border-brand-blue-600 hover:text-brand-blue-600"
      >
        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Edit name" className="max-w-md">
          <DialogBody>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1" htmlFor="edit-name-first">
                    First name
                  </Label>
                  <Input
                    id="edit-name-first"
                    value={first}
                    onChange={(e) => setFirst(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submit()}
                  />
                </div>
                <div>
                  <Label className="mb-1" htmlFor="edit-name-last">
                    Last name
                  </Label>
                  <Input
                    id="edit-name-last"
                    value={last}
                    onChange={(e) => setLast(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submit()}
                  />
                </div>
              </div>
              {error ? (
                <p className="text-sm text-danger-600">{error}</p>
              ) : null}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" disabled={pending} onClick={submit}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
