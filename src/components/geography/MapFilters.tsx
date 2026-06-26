"use client";

import { useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { INDUSTRY_OPTIONS } from "@/constants/dropdowns";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

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
  extraParams,
}: {
  options: FilterOptions;
  values: FilterValues;
  hasFilters: boolean;
  /** Route the filters navigate to. Defaults to the 50-state map; the per-state
   * page passes `/map/state/{CODE}` so applying a filter stays on that state. */
  basePath?: string;
  /** Non-filter params to PRESERVE on apply/clear (e.g. the map's radius mode +
   * center) so changing a filter re-runs the radius search instead of bouncing
   * back to explore mode. */
  extraParams?: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

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
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {pending ? "Applying…" : "Apply"}
      </Button>
      {hasFilters ? (
        <Button variant="secondary" asChild>
          <Link
            href={(() => {
              const qs = withExtras(new URLSearchParams()).toString();
              return qs ? `${basePath}?${qs}` : basePath;
            })()}
          >
            Clear
          </Link>
        </Button>
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
    <Label className="flex w-32 flex-col gap-1">
      <span>{label}</span>
      <Select
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
