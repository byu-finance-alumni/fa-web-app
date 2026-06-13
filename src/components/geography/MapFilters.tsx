"use client";

import { useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { INDUSTRY_OPTIONS } from "@/constants/dropdowns";

const FILTER_KEYS = ["employer", "industry", "year", "region", "tag"] as const;

export interface FilterOptions {
  employers: string[];
  industries: string[];
  graduation_years: string[];
  regions: string[];
  tags: string[];
}

export interface FilterValues {
  employer?: string;
  industry?: string;
  year?: string;
  region?: string;
  tag?: string;
}

/**
 * Geography map filters. A GET-style form that navigates to /map with the
 * selected filters, but intercepted client-side so we can show lightweight
 * pending feedback (Bug fix: previously a bare server form gave no signal that
 * the filter ran while the page re-rendered).
 */
export function MapFilters({
  options,
  values,
  hasFilters,
  basePath = "/map",
}: {
  options: FilterOptions;
  values: FilterValues;
  hasFilters: boolean;
  /** Route the filters navigate to. Defaults to the 50-state map; the per-state
   * page passes `/map/state/{CODE}` so applying a filter stays on that state. */
  basePath?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const params = new URLSearchParams();
    for (const k of FILTER_KEYS) {
      const v = form.get(k);
      if (typeof v === "string" && v) params.set(k, v);
    }
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `${basePath}?${qs}` : basePath);
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-2">
      <Filter
        name="employer"
        label="Employer"
        value={values.employer}
        options={options.employers}
      />
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
      <Filter name="tag" label="Tag" value={values.tag} options={options.tags} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-blue-500 disabled:opacity-70"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {pending ? "Applying…" : "Apply"}
      </button>
      {hasFilters ? (
        <Link
          href={basePath}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Clear
        </Link>
      ) : null}
    </form>
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
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </span>
      <select
        name={name}
        // Keyed by the URL-derived value so navigation (Apply/Clear) remounts
        // the select and the visible label always matches the real filter
        // state (Bug fix: an uncontrolled select kept showing the old choice
        // after Clear).
        key={value ?? "all"}
        defaultValue={value ?? ""}
        // Explicit light surface + color-scheme so the native option list
        // renders on a white background (Bug fix: an unstyled native select
        // can paint a dark/black dropdown on some deployed browsers).
        style={{ colorScheme: "light" }}
        className="w-32 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-brand-blue-600"
      >
        <option value="" className="bg-white text-gray-900">
          All
        </option>
        {options.map((o) => (
          <option key={o} value={o} className="bg-white text-gray-900">
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
