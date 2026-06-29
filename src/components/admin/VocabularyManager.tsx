"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, Pencil, Plus, X } from "lucide-react";
import {
  createVocabTerm,
  renameVocabTerm,
  setVocabTermActive,
} from "@/app/(app)/vocabulary/actions";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import type { VocabTerm } from "@/app/(app)/vocabulary/page";

/**
 * Manage one vocabulary category: add a term, rename an active term, hide
 * (soft-delete) or restore one. The whole page is vocab-admin gated and the
 * backend re-enforces it. Server actions revalidate so the list + app dropdowns
 * refresh after each change.
 */
export function VocabularyManager({
  category,
  terms,
}: {
  category: string;
  terms: VocabTerm[];
}) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [newValue, setNewValue] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  // Inline rename validation: the error message (if any) for the row being
  // edited. A duplicate is rejected client-side before we ever call the action.
  const [editError, setEditError] = useState<string | null>(null);
  // The term queued for hide confirmation; null when the confirm dialog is shut.
  const [hideTarget, setHideTarget] = useState<VocabTerm | null>(null);

  const run = (fn: () => Promise<{ error?: string } | null>, ok: string) =>
    startTransition(async () => {
      const res = await fn();
      if (res?.error) toast.error(res.error);
      else toast.success(ok);
    });

  // Case-insensitive duplicate check against the existing list, ignoring `self`
  // (so a rename that only changes casing of its own value isn't flagged).
  const isDuplicate = (value: string, selfId: number | null) => {
    const needle = value.trim().toLowerCase();
    return terms.some(
      (t) => t.term_id !== selfId && t.value.trim().toLowerCase() === needle,
    );
  };

  const add = () => {
    const v = newValue.trim();
    if (!v) return;
    setNewValue("");
    run(() => createVocabTerm(category, v), `“${v}” added.`);
  };

  const saveRename = (term: VocabTerm) => {
    const v = editValue.trim();
    if (!v || v === term.value) {
      setEditingId(null);
      setEditError(null);
      return;
    }
    // Client-side duplicate guard (the backend remains the source of truth).
    if (isDuplicate(v, term.term_id)) {
      setEditError(`“${v}” already exists in this list.`);
      return;
    }
    setEditingId(null);
    setEditError(null);
    run(() => renameVocabTerm(term.term_id, v), "Renamed.");
  };

  const confirmHide = () => {
    if (!hideTarget) return;
    const t = hideTarget;
    setHideTarget(null);
    run(() => setVocabTermActive(t.term_id, false), `“${t.value}” hidden.`);
  };

  return (
    <div>
      <ul className="divide-y divide-gray-100">
        {terms.map((t) => (
          <li key={t.term_id} className="flex items-center gap-2 py-1.5">
            {editingId === t.term_id ? (
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Input
                    autoFocus
                    value={editValue}
                    disabled={pending}
                    aria-invalid={editError ? true : undefined}
                    onChange={(e) => {
                      setEditValue(e.target.value);
                      if (editError) setEditError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveRename(t);
                      if (e.key === "Escape") {
                        setEditingId(null);
                        setEditError(null);
                      }
                    }}
                    className={`h-8 flex-1 ${
                      editError ? "border-danger-600 focus-visible:ring-danger-500" : ""
                    }`}
                    style={{ colorScheme: "light" }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => saveRename(t)}
                    className="text-brand-blue-600 hover:bg-brand-blue-50 hover:text-brand-blue-600"
                  >
                    <Check className="h-3.5 w-3.5" aria-hidden /> Save
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => {
                      setEditingId(null);
                      setEditError(null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
                {editError ? (
                  <p className="mt-1 text-xs text-danger-600">{editError}</p>
                ) : null}
              </div>
            ) : (
              <>
                <span
                  className={`flex-1 text-sm ${
                    t.active ? "text-gray-900" : "text-gray-400 line-through"
                  }`}
                >
                  {t.value}
                  {t.active ? null : (
                    <span className="ml-2 text-xs not-italic text-gray-400 no-underline">
                      (hidden)
                    </span>
                  )}
                </span>
                {t.active ? (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      title="Rename"
                      onClick={() => {
                        setEditingId(t.term_id);
                        setEditValue(t.value);
                        setEditError(null);
                      }}
                      className="text-gray-500"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden /> Rename
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      title="Hide from new entries"
                      onClick={() => setHideTarget(t)}
                      className="text-danger-600 hover:bg-danger-50 hover:text-danger-600"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden /> Hide
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      run(
                        () => setVocabTermActive(t.term_id, true),
                        `“${t.value}” restored.`,
                      )
                    }
                    className="text-brand-blue-600 hover:bg-brand-blue-50 hover:text-brand-blue-600"
                  >
                    Restore
                  </Button>
                )}
              </>
            )}
          </li>
        ))}
        {terms.length === 0 ? (
          <li className="py-2 text-sm text-gray-400">No options yet.</li>
        ) : null}
      </ul>

      <div className="mt-3 flex items-center gap-2">
        <Input
          value={newValue}
          disabled={pending}
          placeholder="Add an option…"
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          className="flex-1"
          style={{ colorScheme: "light" }}
        />
        <Button
          type="button"
          disabled={pending || !newValue.trim()}
          onClick={add}
        >
          <Plus className="h-4 w-4" aria-hidden /> Add
        </Button>
        {pending ? (
          <Loader2
            className="h-4 w-4 animate-spin text-gray-400"
            aria-label="Saving"
          />
        ) : null}
      </div>

      <Dialog
        open={hideTarget !== null}
        onOpenChange={(o) => {
          if (!o) setHideTarget(null);
        }}
      >
        <DialogContent
          title="Hide this option?"
          description={
            hideTarget
              ? `“${hideTarget.value}” will no longer be offered for new entries. Existing records that already use it keep it — you can restore it later.`
              : undefined
          }
        >
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setHideTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={confirmHide}
            >
              Hide option
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
