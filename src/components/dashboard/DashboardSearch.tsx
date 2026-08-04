"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MultiSelect } from "@/components/alumni/MultiSelect";
import { facetOptions } from "@/lib/alumniFilterParams";
import type { FilterOptions } from "@/types/filters";

/**
 * Dashboard search workspace — the left column's primary tool. Two tabs under
 * the page heading:
 *   1. Quick search  — identity fields (first / last / preferred / Net ID) +
 *      grad-year range, deep-linking into the alumni list.
 *   2. Advanced search — the same identity fields plus the full facet set
 *      (employment, industry, location, engagement, …).
 *
 * Searches navigate to /alumni so the existing results table, sorting,
 * pagination, and export stay the single source of truth (per the field params
 * added to GET /alumni). Empty inputs are omitted so they never narrow results.
 * Quick search also has a "Friends of the program" toggle that routes the same
 * params to /friends (is_alumni=false) instead — the app scopes friends by route.
 */

interface Identity {
  first_name: string;
  last_name: string;
  preferred_name: string;
  net_id: string;
}

const EMPTY_IDENTITY: Identity = {
  first_name: "",
  last_name: "",
  preferred_name: "",
  net_id: "",
};

/**
 * Identity fields, in grid order — the 2-up grid fills row-major, so this list
 * IS the layout (#584):
 *     First name       Last name
 *     Preferred name   Net ID
 * Preferred name sits under First name (it's the same question asked twice) and
 * Net ID under Last name. Email was dropped: staff search people by name, and
 * the free-text `q` box on the alumni list already matches on email.
 */
const IDENTITY_FIELDS: { key: keyof Identity; label: string }[] = [
  { key: "first_name", label: "First name" },
  { key: "last_name", label: "Last name" },
  { key: "preferred_name", label: "Preferred name" },
  { key: "net_id", label: "Net ID" },
];

/**
 * Advanced multi-select facets → /alumni query param + FilterOptions list, in
 * grid order (row-major, 2-up on sm+) — Tanya's ordering from #584:
 *     Employment Status  (full width — see below)
 *     Current Employer   Current Industry
 *     Past Employer      Secondary Industry
 *     Employment City    Employment State
 *     Job Title          Status Label
 *     FS Leadership Role Engagement Tag
 *
 * Naming notes, all deliberate:
 *  - "Employment City/State" — these bind to the EMPLOYER's address, not a home
 *    address (there is no residence data; see the work-location rebind,
 *    fa-web-api#287). The old bare "City"/"State" implied otherwise.
 *  - "FS Leadership Role" — FS = Finance Society, so it doesn't read as a job
 *    seniority level.
 *  - "Current Industry" now matches the PRIMARY industry only; it used to match
 *    primary OR secondary (fa-web-api#363). That's why "Secondary Industry" is
 *    its own facet — alumni matched by their secondary industry are found there.
 *  - Seniority is gone (#584): it duplicated Job Title in practice.
 */
const FACETS: {
  key: string;
  label: string;
  param: string;
  optKey: keyof FilterOptions;
  /** Span both grid columns instead of taking one half-row. */
  wide?: boolean;
}[] = [
  // Employment Status leads the block and spans the full width: it's the
  // broadest employment cut (Full-time / Part-time / Self-Employed / Graduate
  // Student / Military / Not in the Labor Force / Unemployed), and everything
  // below narrows *within* it. Full width also keeps it from sitting
  // shoulder-to-shoulder with Status Label, which is a different thing entirely
  // — a survey-suppression flag (Inactive / Deceased / Lost Contact / Retired /
  // Do Not Contact, fa-web-api#354). Jake's call: two rows, never merged.
  //
  // Its `optKey` is retained for the shape, but `facetOptions` short-circuits it
  // to the FIXED seven (FIXED_FACET_OPTIONS → EMPLOYMENT_STATUS_OPTIONS): the
  // data-derived `employment_statuses` only listed values alumni already held,
  // so Military / Part-time / Unemployed were missing from the dropdown until a
  // survey answer created them.
  {
    key: "employmentStatus",
    label: "Employment Status",
    param: "employment_status",
    optKey: "employment_statuses",
    wide: true,
  },
  { key: "employer", label: "Current Employer", param: "employer", optKey: "employers" },
  { key: "industry", label: "Current Industry", param: "industry", optKey: "industries" },
  { key: "pastEmployer", label: "Past Employer", param: "past_employer", optKey: "past_employers" },
  { key: "secondaryIndustry", label: "Secondary Industry", param: "secondary_industry", optKey: "secondary_industries" },
  { key: "city", label: "Employment City", param: "city", optKey: "cities" },
  { key: "state", label: "Employment State", param: "state", optKey: "states" },
  { key: "title", label: "Job Title", param: "title", optKey: "titles" },
  { key: "statusLabel", label: "Status Label", param: "status_label", optKey: "status_labels" },
  { key: "leadership", label: "FS Leadership Role", param: "leadership_role", optKey: "leadership_roles" },
  { key: "tag", label: "Engagement Tag", param: "tag", optKey: "tags" },
];

/** Advanced engagement checkboxes → /alumni boolean param (=1). */
const ENGAGEMENT: { key: string; label: string; param: string }[] = [
  { key: "attended", label: "Attended an event", param: "attended" },
  { key: "donor", label: "PIFF donor", param: "donor" },
  { key: "mentor", label: "Willing to mentor", param: "mentor" },
  { key: "speaker", label: "Willing to guest speak", param: "speaker" },
  // The finance designations worth searching on. CFP joined CFA once the
  // backend grew a `cfp` param (fa-web-api#363).
  //
  // CPA is NOT offered (#605): no alumni hold one, so the tickbox could only
  // ever return zero rows. Search-only — CPA is still collected by the survey
  // (#529), still stored, still shown on a profile, and the backend still
  // accepts the `cpa` param, so an existing deep link keeps working.
  { key: "cfa", label: "CFA designation", param: "cfa" },
  { key: "cfp", label: "CFP designation", param: "cfp" },
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
            type="text"
            // Compact 36px fields on mobile to match the slim search bar; 16px
            // text is preserved (no iOS zoom). Desktop is already h-9.
            className="h-9"
          />
        </Label>
      ))}
    </div>
  );
}

// Plausible graduation-year window for the From/To inputs (min/max attrs +
// submit validation). Upper bound allows next year's graduating class.
const GRAD_YEAR_MIN = 1900;
const GRAD_YEAR_MAX = new Date().getFullYear() + 1;

/** Validate a grad-year From/To range. Returns an error message when From > To
 *  (an inverted range that would return nothing), else null. Blank bounds are
 *  fine — they just leave that side open. */
function gradRangeError(y: { ymin: string; ymax: string }): string | null {
  const from = y.ymin.trim();
  const to = y.ymax.trim();
  if (from && to && Number(from) > Number(to)) {
    return "“From” year must be the same as or before the “To” year.";
  }
  return null;
}

function GradYearRange({
  ymin,
  ymax,
  onChange,
  error,
}: {
  ymin: string;
  ymax: string;
  onChange: (next: { ymin: string; ymax: string }) => void;
  error?: string | null;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Graduation year
      </p>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={GRAD_YEAR_MIN}
          max={GRAD_YEAR_MAX}
          value={ymin}
          onChange={(e) => onChange({ ymin: e.target.value, ymax })}
          placeholder="From"
          aria-label="Graduation year from"
          aria-invalid={error ? true : undefined}
          className="h-9 w-24 tabular-nums"
        />
        <span className="text-sm text-gray-500">–</span>
        <Input
          type="number"
          min={GRAD_YEAR_MIN}
          max={GRAD_YEAR_MAX}
          value={ymax}
          onChange={(e) => onChange({ ymin, ymax: e.target.value })}
          placeholder="To"
          aria-label="Graduation year to"
          aria-invalid={error ? true : undefined}
          className="h-9 w-24 tabular-nums"
        />
      </div>
      {error ? (
        <p role="alert" className="mt-1.5 text-xs text-danger-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** "Friends of the program" toggle. When checked, the Quick search targets the
 *  Friends roster (/friends — is_alumni=false via the backend `kind=friend`
 *  param) instead of Alumni. This mirrors how the rest of the app scopes to
 *  friends: by route, carrying the same identity + grad-year query params. */
function FriendsToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-gray-700">
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-gray-300 accent-brand-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500 focus-visible:ring-offset-1"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      Friends of the program
    </label>
  );
}

export function DashboardSearch({ options }: { options: FilterOptions }) {
  const router = useRouter();

  // --- Quick search ----------------------------------------------------------
  const [quick, setQuick] = useState<Identity>(EMPTY_IDENTITY);
  const [quickYear, setQuickYear] = useState({ ymin: "", ymax: "" });
  const [quickYearError, setQuickYearError] = useState<string | null>(null);
  // When true, Quick search targets the Friends roster (/friends) instead of
  // Alumni — same params, different route (the app scopes friends by route).
  const [quickFriends, setQuickFriends] = useState(false);

  // --- Advanced search -------------------------------------------------------
  const [adv, setAdv] = useState<Identity>(EMPTY_IDENTITY);
  const [advYear, setAdvYear] = useState({ ymin: "", ymax: "" });
  const [advYearError, setAdvYearError] = useState<string | null>(null);
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
    // Block an inverted grad-year range before navigating (it would return
    // nothing) and surface a clear inline message instead (L5).
    const err = gradRangeError(quickYear);
    setQuickYearError(err);
    if (err) return;
    const p = new URLSearchParams();
    identityParams(p, quick);
    yearParams(p, quickYear);
    // Same identity + grad-year params, but route to the Friends roster when the
    // toggle is on (both routes read these params identically).
    const base = quickFriends ? "/friends" : "/alumni";
    router.push(p.toString() ? `${base}?${p.toString()}` : base);
  }
  function resetQuick() {
    setQuick(EMPTY_IDENTITY);
    setQuickYear({ ymin: "", ymax: "" });
    setQuickYearError(null);
    setQuickFriends(false);
  }

  function runAdvanced() {
    const err = gradRangeError(advYear);
    setAdvYearError(err);
    if (err) return;
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
    setAdvYearError(null);
    setFacets({});
    setFlags({});
  }

  return (
    <Card className="flex flex-col p-4 md:p-5 lg:min-h-0 lg:flex-1">
      <Tabs defaultValue="quick" className="flex flex-col lg:min-h-0 lg:flex-1">
        <TabsList className="w-full">
          <TabsTrigger value="quick">Quick search</TabsTrigger>
          <TabsTrigger value="advanced">Advanced search</TabsTrigger>
        </TabsList>

        {/* ---------------------------------------------------------- Quick -- */}
        <TabsContent
          value="quick"
          className="flex flex-col space-y-4 lg:min-h-0 lg:flex-1"
        >
          <IdentityGrid value={quick} onChange={setQuick} />
          <div className="flex flex-wrap items-end justify-between gap-4">
            <GradYearRange
              ymin={quickYear.ymin}
              ymax={quickYear.ymax}
              onChange={(next) => {
                setQuickYear(next);
                if (quickYearError) setQuickYearError(null);
              }}
              error={quickYearError}
            />
            <FriendsToggle checked={quickFriends} onChange={setQuickFriends} />
          </div>
          {/* Compact action buttons on mobile (h-9) to match the slim search
              bar; desktop keeps its default h-9 too, so it's unchanged. */}
          <div className="flex gap-2 pt-1">
            <Button type="button" onClick={runQuick} className="h-9">
              Search
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={resetQuick}
              className="h-9"
            >
              Reset
            </Button>
          </div>
        </TabsContent>

        {/* ------------------------------------------------------- Advanced -- */}
        {/* Definite height = the box (matches the flex-1 card), so the inner
            scroll resolves a height and the fields fill from the TOP. The card
            itself stays flex-1, so the right-column graphs are unaffected. */}
        {/* Desktop bounds the tab to the viewport and scrolls the fields inside
            it (so the right-column charts stay put). Mobile drops the fixed
            height and inner scroll entirely — the fields flow and the whole page
            scrolls, the native pattern. */}
        <TabsContent
          value="advanced"
          className="flex flex-col space-y-4 lg:h-[calc(100dvh-22rem)] lg:min-h-[20rem]"
        >
          {/* overflow-y:auto forces overflow-x to compute to auto too, which
              clips a focused field's ring/offset at the flush left edge (the
              scroll-free Quick tab doesn't clip). Give the scroll box inline
              padding so the ring has room, and cancel it with -mx so the fields
              stay aligned with the Quick tab (no shift on tab switch). */}
          <div className="space-y-4 lg:-mx-2 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:px-2">
            <IdentityGrid value={adv} onChange={setAdv} />
            <GradYearRange
              ymin={advYear.ymin}
              ymax={advYear.ymax}
              onChange={(next) => {
                setAdvYear(next);
                if (advYearError) setAdvYearError(null);
              }}
              error={advYearError}
            />
            {/* Single column on mobile, so the pairings above collapse to the
                same top-to-bottom reading order. `wide` facets span both columns
                on sm+ and are simply full-width on mobile like everything else. */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {FACETS.map((facet) => (
                <div key={facet.key} className={facet.wide ? "sm:col-span-2" : undefined}>
                  <MultiSelect
                    label={facet.label}
                    options={facetOptions(facet.optKey, options)}
                    selected={facets[facet.key] ?? []}
                    onChange={(next) =>
                      setFacets((prev) => ({ ...prev, [facet.key]: next }))
                    }
                  />
                </div>
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
            <Button type="button" onClick={runAdvanced} className="h-9">
              Search
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={resetAdvanced}
              className="h-9"
            >
              Reset
            </Button>
          </div>
        </TabsContent>

      </Tabs>
    </Card>
  );
}
