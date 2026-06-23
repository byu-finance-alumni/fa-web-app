"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import {
  addProfileNote,
  deleteProfileNote,
  updateProfileNote,
} from "@/app/(app)/alumni/actions";
import { useToast } from "@/components/ui/Toast";
import type { Note } from "@/types/notes";

/**
 * Unified-notes card for an alumni profile (#39). Read is open to every role;
 * writing (add / edit / delete) is gated to `canWrite` (full_access) AND
 * re-enforced + audit-logged by the backend. Notes arrive newest-first from the
 * server; after a mutation we `router.refresh()` so the list and the Audit tab
 * reflect the change.
 *
 * Styling follows the design system (UX-UI.md): inputs + buttons mirror
 * `CreateUserDialog`; brand-blue primary, white/gray-300 secondary, danger-600
 * for delete.
 */

const fieldCls =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-blue-600 focus:outline-none focus:ring-1 focus:ring-brand-blue-500";

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Denver",
  });
}

export function ProfileNotes({
  alumniId,
  notes,
  canWrite,
}: {
  alumniId: number;
  notes: Note[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editBody, setEditBody] = useState("");
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  function add() {
    const body = draft.trim();
    if (!body) return;
    startTransition(async () => {
      const res = await addProfileNote(alumniId, body);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setDraft("");
      toast.success("Note added.");
      router.refresh();
    });
  }

  function saveEdit(noteId: number) {
    const body = editBody.trim();
    if (!body) return;
    startTransition(async () => {
      const res = await updateProfileNote(alumniId, noteId, body);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setEditingId(null);
      toast.success("Note updated.");
      router.refresh();
    });
  }

  function remove(noteId: number) {
    startTransition(async () => {
      const res = await deleteProfileNote(alumniId, noteId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setConfirmingId(null);
      toast.success("Note deleted.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {canWrite ? (
        <div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            placeholder="Add a note about this alumnus…"
            aria-label="New note"
            className={fieldCls}
          />
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={add}
              disabled={pending || !draft.trim()}
              className="rounded-lg bg-brand-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-blue-500 disabled:opacity-60"
            >
              {pending ? "Saving…" : "Add note"}
            </button>
          </div>
        </div>
      ) : null}

      {notes.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-500">
          No notes yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {notes.map((n) => (
            <li
              key={n.note_id}
              className="rounded-lg border border-gray-300 bg-gray-50 p-3"
            >
              {editingId === n.note_id ? (
                <div>
                  <textarea
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    rows={3}
                    aria-label="Edit note"
                    className={`${fieldCls} bg-white`}
                  />
                  <div className="mt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => saveEdit(n.note_id)}
                      disabled={pending || !editBody.trim()}
                      className="rounded-lg bg-brand-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-blue-500 disabled:opacity-60"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="whitespace-pre-wrap text-sm text-gray-900">
                    {n.body}
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="text-xs text-gray-500">
                      {n.author ?? "—"} · {fmt(n.created_at)}
                      {n.updated_at !== n.created_at ? " · edited" : ""}
                    </p>
                    {canWrite ? (
                      confirmingId === n.note_id ? (
                        <span className="flex shrink-0 items-center gap-2 text-xs">
                          <span className="text-gray-500">Delete?</span>
                          <button
                            type="button"
                            onClick={() => remove(n.note_id)}
                            disabled={pending}
                            className="font-semibold text-danger-600 hover:text-danger-500 disabled:opacity-60"
                          >
                            Yes
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmingId(null)}
                            className="font-medium text-gray-700 hover:text-gray-900"
                          >
                            No
                          </button>
                        </span>
                      ) : (
                        <span className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(n.note_id);
                              setEditBody(n.body);
                            }}
                            aria-label="Edit note"
                            className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmingId(n.note_id)}
                            aria-label="Delete note"
                            className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-danger-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </span>
                      )
                    ) : null}
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
