"use client";

import { useEffect, useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { updateUserName } from "@/app/(app)/admin/actions";
import { useToast } from "@/components/ui/Toast";

/**
 * Super-admin inline editor for a user's first/last name. A small pencil button
 * (matching the per-row icon affordance used elsewhere) opens a dialog with
 * first/last inputs that calls `updateUserName` (the `/name` sub-path) and, on
 * success, toasts and revalidates `/admin`. The whole Admin screen is
 * super_admin-gated and the backend re-enforces it.
 *
 * Works in both the desktop table row Name cell and the mobile card. Styling
 * values come from the design system (UX-UI.md): primary = `brand-blue-600`,
 * secondary = white + `gray-300` border, errors = `danger-600`.
 */

const labelCls = "mb-1 block text-[11px] font-medium text-gray-500";
const fieldCls =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-blue-600 focus:outline-none focus:ring-1 focus:ring-brand-blue-600";

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
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [first, setFirst] = useState(firstName ?? "");
  const [last, setLast] = useState(lastName ?? "");
  const [error, setError] = useState<string | null>(null);

  // Esc closes the dialog.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

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
      }
    });
  }

  return (
    <>
      <button
        type="button"
        aria-label="Edit name"
        title="Edit name"
        onClick={start}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-500 transition hover:border-brand-blue-600 hover:bg-gray-50 hover:text-brand-blue-600"
      >
        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-navy-900/40 p-0 sm:items-center sm:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-t-2xl border border-gray-300 bg-white p-5 shadow-lg sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Edit name"
          >
            <h3 className="mb-4 text-base font-semibold text-gray-900">
              Edit name
            </h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls} htmlFor="edit-name-first">
                    First name
                  </label>
                  <input
                    id="edit-name-first"
                    className={fieldCls}
                    value={first}
                    onChange={(e) => setFirst(e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelCls} htmlFor="edit-name-last">
                    Last name
                  </label>
                  <input
                    id="edit-name-last"
                    className={fieldCls}
                    value={last}
                    onChange={(e) => setLast(e.target.value)}
                  />
                </div>
              </div>
              {error ? (
                <p className="text-sm text-danger-600">{error}</p>
              ) : null}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={submit}
                className="rounded-lg bg-brand-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-blue-500 disabled:opacity-60"
              >
                {pending ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
