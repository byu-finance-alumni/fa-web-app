"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

/**
 * Compact searchable multi-select for the advanced-filter panel. Shows a trigger
 * ("Label" / "N selected"), opens a searchable checkbox list, and reports the
 * selected values up via `onChange`. Selected values that aren't in `options`
 * (e.g. a deep-linked value) are still shown as checked so nothing is lost.
 *
 * Design-system styling (UX-UI.md): gray-300 borders, brand-blue focus/accent.
 */
export function MultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  // Selected-but-not-in-options first, then the (filtered) options.
  const merged = useMemo(() => {
    const extra = selected.filter((s) => !options.includes(s));
    return [...extra, ...options];
  }, [options, selected]);

  const filtered = useMemo(() => {
    const n = query.trim().toLowerCase();
    return n ? merged.filter((o) => o.toLowerCase().includes(n)) : merged;
  }, [merged, query]);

  function toggle(value: string) {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value],
    );
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {label}
        </p>
        {selected.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="inline-flex items-center gap-0.5 text-xs font-medium text-gray-400 hover:text-gray-600"
          >
            <X className="h-3 w-3" aria-hidden="true" /> clear
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-2 text-left text-sm text-gray-900 hover:bg-gray-50 focus:border-brand-blue-600 focus:outline-none focus:ring-1 focus:ring-brand-blue-600"
      >
        <span className={selected.length ? "text-gray-900" : "text-gray-400"}>
          {selected.length === 0
            ? "All"
            : selected.length === 1
              ? selected[0]
              : `${selected.length} selected`}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
      </button>

      {open && (
        <div className="mt-1 rounded-lg border border-gray-300 bg-white shadow-sm">
          {merged.length > 8 && (
            <div className="flex items-center gap-2 border-b border-gray-200 px-2.5 py-1.5">
              <Search className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden="true" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${label.toLowerCase()}…`}
                aria-label={`Search ${label}`}
                className="w-full bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
              />
            </div>
          )}
          <ul className="max-h-44 overflow-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-gray-400">No matches</li>
            ) : (
              filtered.map((o) => {
                const checked = selected.includes(o);
                return (
                  <li key={o}>
                    <button
                      type="button"
                      onClick={() => toggle(o)}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          checked
                            ? "border-brand-blue-600 bg-brand-blue-600 text-white"
                            : "border-gray-300"
                        }`}
                      >
                        {checked && <Check className="h-3 w-3" aria-hidden="true" />}
                      </span>
                      <span className="truncate">{o}</span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
