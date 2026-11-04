"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  REPORT_FILTERS,
  cleanReportFilters,
  isReportFiltered,
  withReportView,
  type ReportFilterOptions,
  type ReportFilterParam,
  type ReportFilters,
  type ReportView,
} from "@/lib/reportView";

/**
 * The filters over an Outreach people table (#918): a dropdown or a text match
 * for every column. Nothing runs until Apply (or Enter), because every list read
 * spends the contact-list budget. Applying goes to the first page of the same
 * list with the same sort. A dropdown's choices come from the list; Gender is
 * left out for someone it is hidden from (`options.gender` is null for them).
 */
export function ReportFiltersBar({
  path,
  view,
  options,
}: {
  /** This list's page URL, first page, no view. */
  path: string;
  view: ReportView;
  options: ReportFilterOptions;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<ReportFilters>(view.filters);

  function go(filters: ReportFilters) {
    startTransition(() => router.push(withReportView(path, { ...view, filters })));
  }

  function apply(e: FormEvent) {
    e.preventDefault();
    go(cleanReportFilters(draft));
  }

  const set = (param: ReportFilterParam, value: string) =>
    setDraft((d) => ({ ...d, [param]: value }));

  return (
    <form
      onSubmit={apply}
      aria-label="Filter this list"
      className="rounded-lg border border-gray-200 bg-white p-3 shadow-card"
    >
      <div className="grid grid-cols-2 gap-2 md:grid-cols-7">
        {REPORT_FILTERS.map((filter) => {
          const choices = filter.options ? options[filter.options] : undefined;
          if (filter.options && !choices) return null;
          const id = `report-filter-${filter.param}`;
          const value = draft[filter.param] ?? "";
          const listed = (choices ?? []).map(String);
          return (
            <div key={filter.param} className="min-w-0 space-y-1">
              <Label htmlFor={id}>{filter.label}</Label>
              {filter.options ? (
                <Select
                  id={id}
                  value={value}
                  onChange={(e) => set(filter.param, e.target.value)}
                >
                  <option value="">All</option>
                  {/* A value from the URL stays selectable even if the other
                      filters have since taken it off the list. */}
                  {[...(value && !listed.includes(value) ? [value] : []), ...listed].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  id={id}
                  value={value}
                  maxLength={filter.max}
                  onChange={(e) => set(filter.param, e.target.value)}
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex justify-end gap-2">
        {isReportFiltered(view) && (
          <Button type="button" variant="secondary" disabled={pending} onClick={() => go({})}>
            Clear filters
          </Button>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? "Applying…" : "Apply filters"}
        </Button>
      </div>
    </form>
  );
}
