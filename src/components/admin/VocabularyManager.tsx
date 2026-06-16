"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, Pencil, Plus, X } from "lucide-react";
import {
  createVocabTerm,
  renameVocabTerm,
  setVocabTermActive,
} from "@/app/(app)/admin/vocabulary/actions";
import { useToast } from "@/components/ui/Toast";
import type { VocabTerm } from "@/app/(app)/admin/vocabulary/page";

const btn =
  "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium disabled:opacity-50";
const field =
  "rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-brand-blue-600";

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
                <input
                  autoFocus
                  value={editValue}
                  disabled={pending}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveRename(t);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  className={`${field} flex-1`}
                  style={{ colorScheme: "light" }}
                />
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => saveRename(t)}
                  className={`${btn} text-brand-blue-600 hover:bg-brand-blue-50`}
                >
                  <Check className="h-3.5 w-3.5" aria-hidden /> Save
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setEditingId(null)}
                  className={`${btn} text-gray-500 hover:bg-gray-100`}
                >
                  Cancel
                </button>
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
                    <button
                      type="button"
                      disabled={pending}
                      title="Rename"
                      onClick={() => {
                        setEditingId(t.term_id);
                        setEditValue(t.value);
                      }}
                      className={`${btn} text-gray-500 hover:bg-gray-100`}
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden /> Rename
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      title="Hide from new entries"
                      onClick={() =>
                        run(
                          () => setVocabTermActive(t.term_id, false),
                          `“${t.value}” hidden.`,
                        )
                      }
                      className={`${btn} text-danger-600 hover:bg-danger-50`}
                    >
                      <X className="h-3.5 w-3.5" aria-hidden /> Hide
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      run(
                        () => setVocabTermActive(t.term_id, true),
                        `“${t.value}” restored.`,
                      )
                    }
                    className={`${btn} text-brand-blue-600 hover:bg-brand-blue-50`}
                  >
                    Restore
                  </button>
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
        <input
          value={newValue}
          disabled={pending}
          placeholder="Add an option…"
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          className={`${field} flex-1`}
          style={{ colorScheme: "light" }}
        />
        <button
          type="button"
          disabled={pending || !newValue.trim()}
          onClick={add}
          className="inline-flex items-center gap-1 rounded-lg bg-brand-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-blue-500 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" aria-hidden /> Add
        </button>
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
