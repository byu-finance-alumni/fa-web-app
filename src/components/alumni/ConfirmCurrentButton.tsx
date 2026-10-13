"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { confirmAlumniCurrent } from "@/app/(app)/alumni/actions";
import { useToast } from "@/components/ui/Toast";

/**
 * "Mark info confirmed" under the profile's Last updated date.
 *
 * For the call where someone checks a profile, finds it still right, and has
 * nothing to edit: without this the record kept its old date and looked stale
 * even though it had just been verified. One click stamps it checked today
 * (`POST /alumni/{id}/confirm-current`) and the tile re-renders with today's
 * date and the clicker's name.
 *
 * Only rendered for the alumni-edit tier; the backend re-checks. Text only, per
 * the no-icons rule, in the same link style as the table Export links. A
 * failure is a toast — there is no room for an inline sentence in the tile.
 */
export function ConfirmCurrentButton({ alumniId }: { alumniId: number }) {
  const { toast } = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      const res = await confirmAlumniCurrent(alumniId);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Marked as confirmed today.");
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={pending}
      className="mt-1 text-xs font-semibold text-brand-blue-600 underline-offset-4 hover:text-brand-blue-500 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500 disabled:opacity-50"
    >
      {pending ? "Saving…" : "Mark info confirmed"}
    </button>
  );
}
