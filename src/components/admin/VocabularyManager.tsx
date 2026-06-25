"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, Pencil, Plus, X } from "lucide-react";
import {
  createVocabTerm,
  renameVocabTerm,
  setVocabTermActive,
} from "@/app/(app)/admin/vocabulary/actions";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { VocabTerm } from "@/app/(app)/admin/vocabulary/page";

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

  const run = (fn: () => Promise<{ error?: string } | null>, ok: string) =>
    startTransition(async () => {
      const res = await fn();
      if (res?.error) toast.error(res.error);
      else toast.success(ok);
    });

  const add = () => {
    const v = newValue.trim();
    if (!v) return;
    setNewValue("");
    run(() => createVocabTerm(category, v), `“${v}” added.`);
  };

  const saveRename = (term: VocabTerm) => {
    const v = editValue.trim();
    setEditingId(null);
    if (!v || v === term.value) return;
    run(() => renameVocabTerm(term.term_id, v), "Renamed.");
  };

  return (
    <div>
      <ul className="divide-y divide-gray-100">
        {terms.map((t) => (
          <li key={t.term_id} className="flex items-center gap-2 py-1.5">
            {editingId === t.term_id ? (
              <>
                <Input
                  autoFocus
                  value={editValue}
                  disabled={pending}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveRename(t);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  className="h-8 flex-1"
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
                  onClick={() => setEditingId(null)}
                >
                  Cancel
                </Button>
              </>
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
                      onClick={() =>
                        run(
                          () => setVocabTermActive(t.term_id, false),
                          `“${t.value}” hidden.`,
                        )
                      }
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
    </div>
  );
}
