"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MultiSelect } from "@/components/alumni/MultiSelect";
import type { FilterOptions } from "@/types/filters";

/**
 * Dashboard search workspace — the left column's primary tool. Two tabs under
 * the page heading:
 *   1. Quick search  — identity fields (Net ID / first / last / preferred /
 *      email) + grad-year range, deep-linking into the alumni list.
 *   2. Advanced search — the same identity fields plus the full facet set
 *      (industry, title, employer, location, engagement, …).
 *
 * Searches navigate to /alumni so the existing results table, sorting,
 * pagination, and export stay the single source of truth (per the field params
 * added to GET /alumni). Empty inputs are omitted so they never narrow results.
 */

interface Identity {
  net_id: string;
  first_name: string;
  last_name: string;
  preferred_name: string;
  email: string;
}

const EMPTY_IDENTITY: Identity = {
  net_id: "",
  first_name: "",
  last_name: "",
  preferred_name: "",
  email: "",
};

const IDENTITY_FIELDS: { key: keyof Identity; label: string }[] = [
  { key: "net_id", label: "Net ID" },
  { key: "first_name", label: "First name" },
  { key: "last_name", label: "Last name" },
  { key: "preferred_name", label: "Preferred name" },
  { key: "email", label: "Email" },
];

/** Advanced multi-select facets → /alumni query param + FilterOptions list. */
const FACETS: {
  key: string;
  label: string;
  param: string;
  optKey: keyof FilterOptions;
}[] = [
  { key: "industry", label: "Industry", param: "industry", optKey: "industries" },
  { key: "title", label: "Job title", param: "title", optKey: "titles" },
  { key: "seniority", label: "Seniority", param: "seniority", optKey: "seniority_levels" },
  { key: "employer", label: "Current employer", param: "employer", optKey: "employers" },
  { key: "pastEmployer", label: "Past employer", param: "past_employer", optKey: "past_employers" },
  { key: "city", label: "City", param: "city", optKey: "cities" },
  { key: "state", label: "State", param: "state", optKey: "states" },
  { key: "tag", label: "Engagement tag", param: "tag", optKey: "tags" },
  { key: "statusLabel", label: "Status label", param: "status_label", optKey: "status_labels" },
  { key: "leadership", label: "Leadership role", param: "leadership_role", optKey: "leadership_roles" },
];

/** Advanced engagement checkboxes → /alumni boolean param (=1). */
const ENGAGEMENT: { key: string; label: string; param: string }[] = [
  { key: "attended", label: "Attended an event", param: "attended" },
  { key: "donor", label: "PIFF donor", param: "donor" },
  { key: "mentor", label: "Willing to mentor", param: "mentor" },
  { key: "speaker", label: "Willing to guest speak", param: "speaker" },
  { key: "cfa", label: "CFA designation", param: "cfa" },
  { key: "cpa", label: "CPA designation", param: "cpa" },
];

function IdentityGrid({
  value,
  onChange,
}: {
  value: Identity;
  onChange: (next: Identity) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {IDENTITY_FIELDS.map((f) => (
        <Label key={f.key} className="flex flex-col gap-1">
          <span>{f.label}</span>
          <Input
            value={value[f.key]}
            onChange={(e) => onChange({ ...value, [f.key]: e.target.value })}
            placeholder={f.label}
            autoComplete="off"
            type={f.key === "email" ? "email" : "text"}
          />
        </Label>
      ))}
    </div>
  );
}

function GradYearRange({
  ymin,
  ymax,
  onChange,
}: {
  ymin: string;
  ymax: string;
  onChange: (next: { ymin: string; ymax: string }) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Graduation year
      </p>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          value={ymin}
          onChange={(e) => onChange({ ymin: e.target.value, ymax })}
          placeholder="From"
          aria-label="Graduation year from"
          className="w-24 tabular-nums"
        />
        <span className="text-sm text-gray-500">–</span>
        <Input
          type="number"
          value={ymax}
          onChange={(e) => onChange({ ymin, ymax: e.target.value })}
          placeholder="To"
          aria-label="Graduation year to"
          className="w-24 tabular-nums"
        />
      </div>
    </div>
  );
}

interface Shortcut {
  label: string;
  href: string;
}

/** One-click shortcut tiles that fill the bottom of the Quick / Events tabs.
 *  With `fill`, the tile grid grows to occupy the remaining card height so the
 *  tab reads as intentionally full rather than a thin strip over empty space. */
function Shortcuts({ items }: { items: Shortcut[] }) {
  if (items.length === 0) return null;
  return (
    <div className="border-t border-gray-100 pt-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Quick filters
      </p>
      {/* One preset per line — each is a common compound search. */}
      <div className="flex flex-col gap-2">
        {items.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="flex items-center rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:border-brand-blue-300 hover:bg-brand-blue-50/40 hover:text-brand-blue-600"
          >
            {s.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

/** "Friends of the program" — placeholder; the feature isn't built yet. */
function FriendsPlaceholder() {
  return (
    <label className="flex items-center gap-2 text-sm text-gray-400">
      <input
        type="checkbox"
        disabled
        className="h-4 w-4 rounded border-gray-300"
      />
      Friends of the program
      <span className="text-xs italic text-gray-400">(coming soon)</span>
    </label>
  );
}

export function DashboardSearch({
  options,
  alumniShortcuts = [],
}: {
  options: FilterOptions;
  alumniShortcuts?: Shortcut[];
}) {
  const router = useRouter();

  // --- Quick search ----------------------------------------------------------
  const [quick, setQuick] = useState<Identity>(EMPTY_IDENTITY);
  const [quickYear, setQuickYear] = useState({ ymin: "", ymax: "" });

  // --- Advanced search -------------------------------------------------------
  const [adv, setAdv] = useState<Identity>(EMPTY_IDENTITY);
  const [advYear, setAdvYear] = useState({ ymin: "", ymax: "" });
  const [facets, setFacets] = useState<Record<string, string[]>>({});
  const [flags, setFlags] = useState<Record<string, boolean>>({});

  function identityParams(p: URLSearchParams, id: Identity) {
    for (const f of IDENTITY_FIELDS) {
      const v = id[f.key].trim();
      if (v) p.set(f.key, v);
    }
  }

  function yearParams(p: URLSearchParams, y: { ymin: string; ymax: string }) {
    if (y.ymin.trim()) p.set("ymin", y.ymin.trim());
    if (y.ymax.trim()) p.set("ymax", y.ymax.trim());
  }

  function runQuick() {
    const p = new URLSearchParams();
    identityParams(p, quick);
    yearParams(p, quickYear);
    router.push(p.toString() ? `/alumni?${p.toString()}` : "/alumni");
  }
  function resetQuick() {
    setQuick(EMPTY_IDENTITY);
    setQuickYear({ ymin: "", ymax: "" });
  }

  function runAdvanced() {
    const p = new URLSearchParams();
    identityParams(p, adv);
    yearParams(p, advYear);
    for (const facet of FACETS) {
      for (const v of facets[facet.key] ?? []) p.append(facet.param, v);
    }
    for (const e of ENGAGEMENT) {
      if (flags[e.key]) p.set(e.param, "1");
    }
    router.push(p.toString() ? `/alumni?${p.toString()}` : "/alumni");
  }
  function resetAdvanced() {
    setAdv(EMPTY_IDENTITY);
    setAdvYear({ ymin: "", ymax: "" });
    setFacets({});
    setFlags({});
  }

  return (
    <Card className="flex min-h-0 flex-1 flex-col p-5">
      <Tabs defaultValue="quick" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="w-full">
          <TabsTrigger value="quick">Quick search</TabsTrigger>
          <TabsTrigger value="advanced">Advanced search</TabsTrigger>
        </TabsList>

        {/* ---------------------------------------------------------- Quick -- */}
        <TabsContent
          value="quick"
          className="flex min-h-0 flex-1 flex-col space-y-4"
        >
          <IdentityGrid value={quick} onChange={setQuick} />
          <div className="flex flex-wrap items-end justify-between gap-4">
            <GradYearRange
              ymin={quickYear.ymin}
              ymax={quickYear.ymax}
              onChange={setQuickYear}
            />
            <FriendsPlaceholder />
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="button" onClick={runQuick}>
              Search
            </Button>
            <Button type="button" variant="secondary" onClick={resetQuick}>
              Reset
            </Button>
          </div>
          <Shortcuts items={alumniShortcuts} />
        </TabsContent>

        {/* ------------------------------------------------------- Advanced -- */}
        {/* Definite height = the box (matches the flex-1 card), so the inner
            scroll resolves a height and the fields fill from the TOP. The card
            itself stays flex-1, so the right-column graphs are unaffected. */}
        <TabsContent
          value="advanced"
          className="flex h-[calc(100vh-22rem)] min-h-[20rem] flex-col space-y-4"
        >
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            <IdentityGrid value={adv} onChange={setAdv} />
            <GradYearRange
              ymin={advYear.ymin}
              ymax={advYear.ymax}
              onChange={setAdvYear}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {FACETS.map((facet) => (
                <MultiSelect
                  key={facet.key}
                  label={facet.label}
                  options={(options[facet.optKey] as string[]) ?? []}
                  selected={facets[facet.key] ?? []}
                  onChange={(next) =>
                    setFacets((prev) => ({ ...prev, [facet.key]: next }))
                  }
                />
              ))}
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Engagement
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {ENGAGEMENT.map((e) => (
                  <label
                    key={e.key}
                    className="flex items-center gap-2 text-sm text-gray-700"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 accent-brand-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500 focus-visible:ring-offset-1"
                      checked={!!flags[e.key]}
                      onChange={(ev) =>
                        setFlags((prev) => ({
                          ...prev,
                          [e.key]: ev.target.checked,
                        }))
                      }
                    />
                    {e.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-2 border-t border-gray-100 pt-3">
            <Button type="button" onClick={runAdvanced}>
              Search
            </Button>
            <Button type="button" variant="secondary" onClick={resetAdvanced}>
              Reset
            </Button>
          </div>
        </TabsContent>

      </Tabs>
    </Card>
  );
}
