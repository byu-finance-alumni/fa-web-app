"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { INDUSTRY_OPTIONS } from "@/constants/dropdowns";

/**
 * Dashboard "find alumni fast" bar: a free-text search plus five facet
 * dropdowns that deep-link straight into the alumni list (or, where the list
 * doesn't support a facet yet, the closest surface that does). It owns no list
 * state of its own — picking a value just navigates with the matching query
 * param so the alumni list (the single source of truth for filtering) renders
 * the result. Kept a tiny client island so the dashboard page stays a server
 * component.
 *
 * Param wiring (mirrors what GET /alumni + the alumni list page accept):
 *   - search box → /alumni?q=<term>      (names + external ids)
 *   - Industry   → /alumni?industry=<v>  (exact, INDUSTRY_OPTIONS)
 *   - Employer   → /alumni?employer=<v>  (exact, distinct employers)
 *   - Grad year  → /alumni?ymin=<y>&ymax=<y>
 *   - Tag        → engagement flags the list supports (mentor/speaker/donor);
 *                  tags without a list filter degrade to a plain /alumni link.
 *   - City       → NOT a list facet yet → routes to the geography explorer
 *                  (/map), which is where city-level filtering lives today.
 */

/** Tag → alumni-list query string. Only the engagement tags the list supports
 *  map to a real filter; the rest degrade to the unfiltered list. */
const TAG_TO_QUERY: { label: string; query: string }[] = [
  { label: "Mentor", query: "mentor=1" },
  { label: "Speaker", query: "speaker=1" },
  { label: "Donor", query: "donor=1" },
  // No list filter for these yet — degrade gracefully to the full list.
  { label: "Highly Engaged", query: "" },
  { label: "Recruiter", query: "" },
];

const selectClass =
  "appearance-none rounded-lg border border-gray-300 bg-white py-2 pl-3 pr-9 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500";

function FacetSelect({
  label,
  ariaLabel,
  options,
  onPick,
}: {
  label: string;
  ariaLabel: string;
  options: { value: string; label: string }[];
  onPick: (value: string) => void;
}) {
  return (
    <div className="relative">
      <select
        aria-label={ariaLabel}
        value=""
        onChange={(e) => {
          if (e.target.value) onPick(e.target.value);
        }}
        className={selectClass}
        style={{ colorScheme: "light" }}
      >
        <option value="">{label}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
        aria-hidden="true"
      />
    </div>
  );
}

export function DashboardSearchBar({
  employers,
  gradYears,
  cities,
}: {
  /** Distinct employer values (from geography summary options). */
  employers: string[];
  /** Distinct graduation years, newest first. */
  gradYears: number[];
  /** Distinct "City, ST" labels for the City facet (geography explorer). */
  cities: { label: string; state: string; city: string }[];
}) {
  const router = useRouter();
  const [q, setQ] = useState("");

  const go = (path: string) => router.push(path);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    go(term ? `/alumni?q=${encodeURIComponent(term)}` : "/alumni");
  };

  return (
    <form
      onSubmit={submitSearch}
      role="search"
      aria-label="Find alumni"
      className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-300 bg-white p-3"
    >
      <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 focus-within:border-brand-blue-600 focus-within:ring-1 focus-within:ring-brand-blue-600">
        <Search className="h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search alumni by name, employer, title, city…"
          aria-label="Search alumni"
          autoComplete="off"
          className="w-full bg-transparent text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none"
        />
      </div>

      <FacetSelect
        label="Industry"
        ariaLabel="Filter alumni by industry"
        options={INDUSTRY_OPTIONS.map((i) => ({ value: i, label: i }))}
        onPick={(v) => go(`/alumni?industry=${encodeURIComponent(v)}`)}
      />

      <FacetSelect
        label="Employer"
        ariaLabel="Filter alumni by employer"
        options={employers.map((e) => ({ value: e, label: e }))}
        onPick={(v) => go(`/alumni?employer=${encodeURIComponent(v)}`)}
      />

      <FacetSelect
        label="City"
        ariaLabel="Explore alumni by city on the map"
        options={cities.map((c) => ({ value: c.label, label: c.label }))}
        // The alumni list has no city facet yet; the geography explorer (/map)
        // is where city-level filtering lives, so route there.
        onPick={() => go("/map")}
      />

      <FacetSelect
        label="Grad year"
        ariaLabel="Filter alumni by graduation year"
        options={gradYears.map((y) => ({
          value: String(y),
          label: String(y),
        }))}
        onPick={(v) => go(`/alumni?ymin=${v}&ymax=${v}`)}
      />

      <FacetSelect
        label="Tag"
        ariaLabel="Filter alumni by tag"
        options={TAG_TO_QUERY.map((t) => ({ value: t.label, label: t.label }))}
        onPick={(label) => {
          const match = TAG_TO_QUERY.find((t) => t.label === label);
          go(match?.query ? `/alumni?${match.query}` : "/alumni");
        }}
      />
    </form>
  );
}
