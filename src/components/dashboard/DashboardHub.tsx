"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";

/**
 * Dashboard "find alumni fast" hub: a prominent search box (the page's visual
 * focal point) plus one-click preset filter chips. Nothing renders results
 * here — the dashboard is a launchpad. Submitting the search or clicking a
 * preset NAVIGATES to the alumni list with the matching query params
 * pre-applied; the alumni list stays the single source of truth for filtering.
 *
 * Param wiring (mirrors AlumniFilters' toQs() + GET /alumni — see
 * src/components/alumni/AlumniFilters.tsx):
 *   - search box → /alumni?q=<term>                 (names + external ids)
 *   - Location   → /alumni?city=<v>  or  ?state=<v> (existing city/state facets)
 *   - Industry   → /alumni?industry=<v>             (exact INDUSTRY_OPTIONS value)
 *   - Grad year  → /alumni?ymin=<y>&ymax=<y>        (inclusive grad-year range)
 *   - Employer   → /alumni?employer=<v>             (exact distinct employer)
 *
 * State values follow the geography map's 2-letter convention (e.g. UT); city
 * values are exact city strings. These are the closest existing alumni facets
 * — no new backend params are introduced.
 */

/** A single preset → its destination alumni-list href (filters pre-applied). */
type Preset = { label: string; href: string };

function chipHref(params: Record<string, string>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) p.set(k, v);
  return `/alumni?${p.toString()}`;
}

/** Current year, for the "recent grads" rolling window. */
const THIS_YEAR = new Date().getFullYear();

/** Location presets — major alumni regions. City presets match the exact city
 *  facet value; the Utah preset uses the state facet (2-letter code). */
const LOCATION_PRESETS: Preset[] = [
  { label: "Seattle", href: chipHref({ city: "Seattle" }) },
  { label: "New York City", href: chipHref({ city: "New York" }) },
  { label: "San Francisco", href: chipHref({ city: "San Francisco" }) },
  { label: "Utah", href: chipHref({ state: "UT" }) },
];

/** Industry presets — exact INDUSTRY_OPTIONS values so the facet matches. */
const INDUSTRY_PRESETS: Preset[] = [
  { label: "Investment Banking", href: chipHref({ industry: "Investment Banking" }) },
  { label: "Private Equity", href: chipHref({ industry: "Private Equity" }) },
  { label: "Venture Capital", href: chipHref({ industry: "Venture Capital" }) },
  { label: "Consulting", href: chipHref({ industry: "Consulting" }) },
  { label: "Asset Management", href: chipHref({ industry: "Asset Management" }) },
];

/** Grad-year / recency presets — inclusive grad-year ranges (ymin/ymax). */
const GRAD_YEAR_PRESETS: Preset[] = [
  {
    label: "Last 5 years",
    href: chipHref({ ymin: String(THIS_YEAR - 5), ymax: String(THIS_YEAR) }),
  },
  {
    label: "Last 10 years",
    href: chipHref({ ymin: String(THIS_YEAR - 10), ymax: String(THIS_YEAR) }),
  },
  {
    label: `Class of ${THIS_YEAR}`,
    href: chipHref({ ymin: String(THIS_YEAR), ymax: String(THIS_YEAR) }),
  },
];

function ChipRow({ label, presets }: { label: string; presets: Preset[] }) {
  if (presets.length === 0) return null;
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <Link
            key={p.label}
            href={p.href}
            className="inline-flex items-center rounded-full border border-gray-300 bg-white px-3.5 py-1.5 text-sm font-medium text-gray-700 transition hover:border-brand-blue-300 hover:bg-brand-blue-50 hover:text-brand-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500"
          >
            {p.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function DashboardHub({
  /** Top employers (from the dashboard summary) → quick employer-filter chips. */
  topEmployers,
}: {
  topEmployers: string[];
}) {
  const router = useRouter();
  const [q, setQ] = useState("");

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    router.push(term ? `/alumni?q=${encodeURIComponent(term)}` : "/alumni");
  };

  const employerPresets: Preset[] = topEmployers
    .slice(0, 5)
    .map((employer) => ({
      label: employer,
      href: chipHref({ employer }),
    }));

  return (
    <section className="rounded-xl border border-gray-300 bg-white p-8">
      <h2 className="text-center text-xl font-semibold text-navy-800">
        Find alumni fast
      </h2>
      <p className="mt-1 text-center text-sm text-gray-500">
        Search by name, employer, or title — or jump straight to a saved view.
      </p>

      {/* Search — the focal point. Submitting deep-links into the alumni list. */}
      <form
        onSubmit={submitSearch}
        role="search"
        aria-label="Find alumni"
        className="mx-auto mt-5 flex max-w-2xl items-center gap-2 rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 focus-within:border-brand-blue-600 focus-within:ring-1 focus-within:ring-brand-blue-600"
      >
        <Search className="h-5 w-5 shrink-0 text-gray-500" aria-hidden="true" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search alumni by name, employer, title…"
          aria-label="Search alumni"
          autoComplete="off"
          className="w-full bg-transparent text-base text-gray-900 placeholder:text-gray-500 focus:outline-none"
        />
        <button
          type="submit"
          className="shrink-0 rounded-lg bg-brand-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500"
        >
          Search
        </button>
      </form>

      {/* Preset filter chips — one click deep-links with the filter pre-applied. */}
      <div className="mx-auto mt-7 grid max-w-3xl gap-5 sm:grid-cols-2">
        <ChipRow label="Location" presets={LOCATION_PRESETS} />
        <ChipRow label="Industry" presets={INDUSTRY_PRESETS} />
        <ChipRow label="Grad year" presets={GRAD_YEAR_PRESETS} />
        <ChipRow label="Top employer" presets={employerPresets} />
      </div>
    </section>
  );
}
