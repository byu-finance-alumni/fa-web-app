"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { addNote, deleteNote, updateNote } from "@/app/(app)/alumni/actions";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Note, NoteEntityType } from "@/types/notes";

/**
 * Reusable unified-notes thread for any supported entity (alumni / interaction
 * / event) — generalized from `ProfileNotes` (#39). Read is open to every role;
 * writing (add / edit / delete) is gated to `canWrite` (full_access) AND
 * re-enforced + audit-logged by the backend. Notes arrive newest-first from the
 * caller; after a mutation we call `onChanged?.()` (so the caller can re-fetch)
 * AND `router.refresh()` so any server-rendered view reflects the change.
 *
 * Styling follows the design system (UX-UI.md): inputs + buttons mirror
 * `CreateUserDialog`; brand-blue primary, white/gray-300 secondary, danger-600
 * for delete.
 */

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

export function EntityNotes({
  entityType,
  entityId,
  notes,
  canWrite,
  onChanged,
}: {
  entityType: NoteEntityType;
  entityId: number;
  notes: Note[];
  canWrite: boolean;
  onChanged?: () => void;
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
      const res = await addNote(entityType, entityId, body);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setDraft("");
      toast.success("Note added.");
      onChanged?.();
      router.refresh();
    });
  }

  function saveEdit(noteId: number) {
    const body = editBody.trim();
    if (!body) return;
    startTransition(async () => {
      const res = await updateNote(noteId, body);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setEditingId(null);
      toast.success("Note updated.");
      onChanged?.();
      router.refresh();
    });
  }

  function remove(noteId: number) {
    startTransition(async () => {
      const res = await deleteNote(noteId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setConfirmingId(null);
      toast.success("Note deleted.");
      onChanged?.();
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {canWrite ? (
        <div>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            placeholder="Add a note…"
            aria-label="New note"
          />
          <div className="mt-2 flex justify-end">
            <Button
              type="button"
              variant="primary"
              onClick={add}
              disabled={pending || !draft.trim()}
            >
              {pending ? "Saving…" : "Add note"}
            </Button>
          </div>
        </div>
      ) : null}

      {notes.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-500">No notes yet.</p>
      ) : (
        <ul className="space-y-3">
          {notes.map((n) => (
            <li
              key={n.note_id}
              className="rounded-lg border border-gray-200 bg-gray-50 p-3"
            >
              {editingId === n.note_id ? (
                <div>
                  <Textarea
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    rows={3}
                    aria-label="Edit note"
                    className="bg-white"
                  />
                  <div className="mt-2 flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => saveEdit(n.note_id)}
                      disabled={pending || !editBody.trim()}
                    >
                      Save
                    </Button>
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
                          <Button
                            type="button"
                            variant="link"
                            size="sm"
                            onClick={() => remove(n.note_id)}
                            disabled={pending}
                            className="text-danger-600"
                          >
                            Yes
                          </Button>
                          <Button
                            type="button"
                            variant="link"
                            size="sm"
                            onClick={() => setConfirmingId(null)}
                            className="text-gray-700"
                          >
                            No
                          </Button>
                        </span>
                      ) : (
                        <span className="flex shrink-0 items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingId(n.note_id);
                              setEditBody(n.body);
                            }}
                            aria-label="Edit note"
                            className="h-7 w-7"
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setConfirmingId(n.note_id)}
                            aria-label="Delete note"
                            className="h-7 w-7"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </Button>
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
