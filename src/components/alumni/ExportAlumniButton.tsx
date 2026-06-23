"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Download } from "lucide-react";
import { exportAlumni, getExportColumns } from "@/app/(app)/alumni/actions";
import { useToast } from "@/components/ui/Toast";
import type {
  AlumniExportFilters,
  ExportColumn,
  ExportColumnCatalog,
} from "@/types/export";

/**
 * "Export CSV" toolbar action (full_access). Opens a column picker seeded with a
 * FERPA-light default selection; the export covers exactly the alumni matching
 * the list's current filters (passed in from `AlumniFilters`). On confirm the
 * server action returns the CSV text and we trigger a Blob download.
 *
 * Styling follows the design system (UX-UI.md): secondary button = white +
 * `gray-300` border; primary = `brand-blue-600`; overlay = `navy-900/40`;
 * dialog panel mirrors `CreateUserDialog`.
 */
export function ExportAlumniButton({
  filters,
  filtersActive,
  total,
}: {
  filters: AlumniExportFilters;
  filtersActive: boolean;
  /** Number of alumni the export will cover (= the list's filtered total). */
  total?: number;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [catalog, setCatalog] = useState<ExportColumnCatalog | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();

  // Esc closes the dialog.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  async function openDialog() {
    setOpen(true);
    if (catalog) return; // already loaded
    setLoading(true);
    const res = await getExportColumns();
    setLoading(false);
    if (res.ok) {
      setCatalog(res.catalog);
      setSelected(new Set(res.catalog.default_selected));
    } else {
      toast.error(res.error);
      setOpen(false);
    }
  }

  // Group the catalog columns by their `group`, preserving catalog order.
  const groups = useMemo(() => {
    const out: { name: string; columns: ExportColumn[] }[] = [];
    for (const col of catalog?.columns ?? []) {
      let g = out.find((x) => x.name === col.group);
      if (!g) {
        g = { name: col.group, columns: [] };
        out.push(g);
      }
      g.columns.push(col);
    }
    return out;
  }, [catalog]);

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleGroup(cols: ExportColumn[], on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const c of cols) {
        if (on) next.add(c.key);
        else next.delete(c.key);
      }
      return next;
    });
  }

  function resetDefaults() {
    if (catalog) setSelected(new Set(catalog.default_selected));
  }

  function runExport() {
    if (selected.size === 0) {
      toast.error("Pick at least one column to export.");
      return;
    }
    // Emit columns in catalog order (matches the CSV the backend builds).
    const columns = (catalog?.columns ?? [])
      .map((c) => c.key)
      .filter((k) => selected.has(k));
    startTransition(async () => {
      const res = await exportAlumni({ columns, filters });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `alumni_export_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Export downloaded.");
      setOpen(false);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void openDialog()}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        <Download className="h-4 w-4" aria-hidden="true" /> Export CSV
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-navy-900/40 p-0 sm:items-center sm:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-t-2xl border border-gray-300 bg-white shadow-lg sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Export alumni to CSV"
          >
            <div className="border-b border-gray-300 p-5">
              <h3 className="text-base font-semibold text-gray-900">
                Export alumni to CSV
              </h3>
              <p className="mt-1 text-sm tabular-nums text-gray-500">
                {(() => {
                  const count =
                    typeof total === "number" && Number.isFinite(total)
                      ? `${total.toLocaleString()} `
                      : "";
                  return filtersActive
                    ? `Exports the ${count}alumni matching your current filters.`
                    : `Exports all ${count}alumni.`;
                })()}{" "}
                Choose the columns to include.
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-5">
              {loading ? (
                <p className="py-8 text-center text-sm text-gray-500">
                  Loading columns…
                </p>
              ) : (
                <div className="space-y-5">
                  {groups.map((g) => {
                    const allOn = g.columns.every((c) => selected.has(c.key));
                    return (
                      <div key={g.name}>
                        <div className="mb-2 flex items-center justify-between">
                          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                            {g.name}
                          </h4>
                          <button
                            type="button"
                            onClick={() => toggleGroup(g.columns, !allOn)}
                            className="text-xs font-medium text-brand-blue-600 hover:text-brand-blue-500"
                          >
                            {allOn ? "Clear" : "Select all"}
                          </button>
                        </div>
                        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                          {g.columns.map((c) => (
                            <label
                              key={c.key}
                              className="flex items-center gap-2 text-sm text-gray-700"
                            >
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-gray-300 accent-brand-blue-600"
                                checked={selected.has(c.key)}
                                onChange={() => toggle(c.key)}
                              />
                              {c.label}
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-gray-300 p-5">
              <button
                type="button"
                onClick={resetDefaults}
                className="text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                Reset to defaults
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={pending || loading || selected.size === 0}
                  onClick={runExport}
                  className="rounded-lg bg-brand-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-blue-500 disabled:opacity-60"
                >
                  {pending
                    ? "Exporting…"
                    : `Export ${selected.size} column${selected.size === 1 ? "" : "s"}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
