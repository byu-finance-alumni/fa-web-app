"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { INDUSTRY_OPTIONS } from "@/constants/dropdowns";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

const FILTER_KEYS = ["industry", "year", "region", "tag"] as const;

export interface FilterOptions {
  industries: string[];
  graduation_years: string[];
  regions: string[];
  tags: string[];
}

export interface FilterValues {
  industry?: string;
  year?: string;
  region?: string;
  tag?: string;
}

/**
 * Geography map filters — grouped behind a single "Filters" button that opens a
 * popover with all the dropdowns (industry / grad year / region / tag), so the
 * controls don't crowd the map header. Applies via a client-side
 * navigation to keep the map's radius center + radius preserved (`extraParams`).
 */
export function MapFilters({
  options,
  values,
  hasFilters,
  basePath = "/map",
  extraParams,
}: {
  options: FilterOptions;
  values: FilterValues;
  hasFilters: boolean;
  basePath?: string;
  /** Non-filter params to PRESERVE on apply/clear (the map's radius center). */
  extraParams?: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const activeCount = FILTER_KEYS.filter((k) => values[k]).length;

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node))
        setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function withExtras(params: URLSearchParams): URLSearchParams {
    if (extraParams) {
      for (const [k, v] of Object.entries(extraParams)) if (v) params.set(k, v);
    }
    return params;
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const params = new URLSearchParams();
    for (const k of FILTER_KEYS) {
      const v = form.get(k);
      if (typeof v === "string" && v) params.set(k, v);
    }
    withExtras(params);
    const qs = params.toString();
    setOpen(false);
    startTransition(() => router.push(qs ? `${basePath}?${qs}` : basePath));
  }

  const clearHref = (() => {
    const qs = withExtras(new URLSearchParams()).toString();
    return qs ? `${basePath}?${qs}` : basePath;
  })();

  return (
    <div ref={rootRef} className="relative shrink-0">
      <Button
        type="button"
        variant="secondary"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Filters
        {activeCount ? (
          <Badge variant="solid" size="sm" className="ml-1 tabular-nums">
            {activeCount}
          </Badge>
        ) : null}
      </Button>

      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-72 rounded-lg border border-gray-200 bg-white p-4 shadow-md">
          <form onSubmit={onSubmit} className="space-y-3">
            <Filter
              name="industry"
              label="Industry"
              value={values.industry}
              options={INDUSTRY_OPTIONS}
            />
            <Filter
              name="year"
              label="Grad year"
              value={values.year}
              options={options.graduation_years}
            />
            <Filter
              name="region"
              label="Region"
              value={values.region}
              options={options.regions}
            />
            <Filter
              name="tag"
              label="Tag"
              value={values.tag}
              options={options.tags}
            />
            <div className="flex gap-2 pt-1">
              <Button type="submit" disabled={pending} className="flex-1">
                Apply
              </Button>
              {hasFilters ? (
                <Button variant="secondary" asChild>
                  <Link href={clearHref}>Clear</Link>
                </Button>
              ) : null}
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function Filter({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value?: string;
  options: readonly string[];
}) {
  return (
    <Label className="flex flex-col gap-1">
      <span>{label}</span>
      <Select
        name={name}
        key={value ?? "all"}
        defaultValue={value ?? ""}
        style={{ colorScheme: "light" }}
      >
        <option value="" className="bg-white text-gray-900">
          All
        </option>
        {options.map((o) => (
          <option key={o} value={o} className="bg-white text-gray-900">
            {o}
          </option>
        ))}
      </Select>
    </Label>
  );
}
