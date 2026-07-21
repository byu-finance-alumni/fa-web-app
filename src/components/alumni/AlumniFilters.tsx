"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import { MultiSelect } from "@/components/alumni/MultiSelect";
import { ExportAlumniButton } from "@/components/alumni/ExportAlumniButton";
import { toExportFilters } from "@/lib/exportFilters";
import { parseAlumniQuery } from "@/lib/alumniQueryParser";
import type { FilterOptions } from "@/types/filters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

/** Everything the backend GET /alumni supports, mirrored in the URL. */
export interface AlumniFilterState {
  q: string;
  /** Grad-year range (inclusive). Same value in both = exact year. */
  ymin: string;
  ymax: string;
  // Multi-select facets (repeated URL params; OR within a facet).
  pastEmployer: string[];
  industry: string[];
  title: string[];
  seniority: string[];
  city: string[];
  state: string[];
  tag: string[];
  statusLabel: string[];
  leadership: string[];
  surveyStatus: string[];
  /** Professional-designation filter (#404): multi-select over CFP/CFA/CPA with
   *  OR semantics (an alumnus holding ANY selected designation matches). Sent to
   *  GET /alumni as repeatable `designations=` params. Distinct from the cfa/cpa
   *  booleans below, which each AND-narrow to holders of that single designation. */
  designations: string[];
  /** Gender filter (#360): "" = all, else the single-letter code. Combinable
   *  with every other facet (e.g. females in a given industry). */
  gender: "" | "M" | "F";
  /** Industry grouping deep-link (dashboard → list): "other" = non-finance/Other
   *  bucket, "unknown" = missing industry. Mutually exclusive with picking
   *  specific industries; "" = no grouping filter. */
  industryGroup: "" | "other" | "unknown";
  // Last-contacted (derived from interactions).
  contactedAfter: string;
  contactedBefore: string;
  neverContacted: boolean;
  attended: boolean;
  donor: boolean;
  mentor: boolean;
  speaker: boolean;
  cfa: boolean;
  cpa: boolean;
  graduateDegree: boolean;
  archived: boolean;
  deceased: "" | "only" | "exclude";
  missingEmail: boolean;
  missingEmployer: boolean;
  duplicate: boolean;
  /** "Needs Surveying" view: alumni DUE for the biennial re-survey. Forced on by
   *  the /needs-surveying page (admin tier only) and never surfaced as a toggle/
   *  chip here — it's not serialized into the query string (the route, not the
   *  URL, owns it), but it DOES flow into the export filters so an export from
   *  that page covers exactly the due set. */
  needsSurvey: boolean;
  sort:
    | "name"
    | "grad_desc"
    | "grad_asc"
    | "industry"
    | "city"
    | "state"
    | "employer"
    | "gender"
    | "updated";
}

export const EMPTY_FILTERS: AlumniFilterState = {
  q: "",
  ymin: "",
  ymax: "",
  pastEmployer: [],
  industry: [],
  title: [],
  seniority: [],
  city: [],
  state: [],
  tag: [],
  statusLabel: [],
  leadership: [],
  surveyStatus: [],
  designations: [],
  gender: "",
  industryGroup: "",
  contactedAfter: "",
  contactedBefore: "",
  neverContacted: false,
  attended: false,
  donor: false,
  mentor: false,
  speaker: false,
  cfa: false,
  cpa: false,
  graduateDegree: false,
  archived: false,
  deceased: "",
  missingEmail: false,
  missingEmployer: false,
  duplicate: false,
  needsSurvey: false,
  sort: "name",
};

/**
 * Each multi-select facet: state key, display label, the URL/query param name,
 * and which FilterOptions list feeds it. Drives the panel, the chips, and
 * serialization so all three stay in sync.
 */
const FACETS: {
  key: keyof AlumniFilterState;
  label: string;
  param: string;
  optKey: keyof FilterOptions;
}[] = [
  { key: "pastEmployer", label: "Past employer", param: "past_employer", optKey: "past_employers" },
  { key: "industry", label: "Industry", param: "industry", optKey: "industries" },
  { key: "title", label: "Job title", param: "title", optKey: "titles" },
  { key: "seniority", label: "Seniority", param: "seniority", optKey: "seniority_levels" },
  { key: "city", label: "City", param: "city", optKey: "cities" },
  { key: "state", label: "State", param: "state", optKey: "states" },
  { key: "tag", label: "Engagement tag", param: "tag", optKey: "tags" },
  { key: "statusLabel", label: "Status label", param: "status_label", optKey: "status_labels" },
  { key: "leadership", label: "Leadership role", param: "leadership_role", optKey: "leadership_roles" },
  { key: "surveyStatus", label: "Survey status", param: "survey_status", optKey: "survey_statuses" },
];

/** Fixed professional-designation vocabulary for the #404 filter. Static (not
 *  drawn from FilterOptions) — the backend validates values against exactly
 *  CFP|CFA|CPA (case-insensitive) and 422s anything else. */
const DESIGNATION_OPTIONS = ["CFP", "CFA", "CPA"];

/** Serialize filter state to the canonical /alumni query string. */
function toQs(f: AlumniFilterState): string {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set("q", f.q.trim());
  if (f.ymin.trim()) p.set("ymin", f.ymin.trim());
  if (f.ymax.trim()) p.set("ymax", f.ymax.trim());
  for (const facet of FACETS) {
    for (const v of f[facet.key] as string[]) p.append(facet.param, v);
  }
  // Designations (#404): repeated param, OR semantics server-side.
  for (const v of f.designations) p.append("designations", v);
  if (f.gender) p.set("gender", f.gender);
  if (f.industryGroup) p.set("industry_group", f.industryGroup);
  if (f.contactedAfter) p.set("contacted_after", f.contactedAfter);
  if (f.contactedBefore) p.set("contacted_before", f.contactedBefore);
  if (f.neverContacted) p.set("never_contacted", "1");
  if (f.attended) p.set("attended", "1");
  if (f.donor) p.set("donor", "1");
  if (f.mentor) p.set("mentor", "1");
  if (f.speaker) p.set("speaker", "1");
  if (f.cfa) p.set("cfa", "1");
  if (f.cpa) p.set("cpa", "1");
  if (f.graduateDegree) p.set("graduate_degree", "1");
  if (f.archived) p.set("archived", "1");
  if (f.deceased === "only") p.set("deceased", "1");
  if (f.deceased === "exclude") p.set("deceased", "0");
  if (f.missingEmail) p.set("missing_email", "1");
  if (f.missingEmployer) p.set("missing_employer", "1");
  if (f.duplicate) p.set("duplicate", "1");
  if (f.sort && f.sort !== "name") p.set("sort", f.sort);
  return p.toString();
}

const EMPTY_OPTIONS: FilterOptions = {
  employers: [],
  past_employers: [],
  titles: [],
  seniority_levels: [],
  industries: [],
  cities: [],
  states: [],
  tags: [],
  status_labels: [],
  leadership_roles: [],
  survey_statuses: [],
  graduation_years: [],
  graduation_classes: [],
};

/**
 * Alumni list toolbar + advanced filter panel. The toolbar has Add / live search
 * / sort / a Filters button (with an active count). The Filters button opens a
 * right-side slide-over with every PRD facet as a multi-select, plus grad-year
 * range, last-contacted, engagement, and status. Active filters also render as
 * removable chips below the toolbar. Filtering is LIVE (debounced) and mirrored
 * into the URL so dashboard deep-links and manual filtering share one source of
 * truth.
 */
export function AlumniFilters({
  initial,
  options = EMPTY_OPTIONS,
  canCreate = false,
  canExport = false,
  total,
  basePath = "/alumni",
  isFriend = false,
}: {
  initial: AlumniFilterState;
  options?: FilterOptions;
  canCreate?: boolean;
  canExport?: boolean;
  /** Filtered alumni total (= export row count, since exports reuse these filters). */
  total?: number;
  /** Route the live filtering navigates within. Defaults to the main alumni list;
   *  /friends and /needs-surveying pass their own path so filtering stays on that
   *  route (and keeps any route-owned scope in effect). */
  basePath?: string;
  /** Friends roster (#218): switches the Add control to create a friend. The
   *  roster scope itself is fixed by the route (basePath), not a query param. */
  isFriend?: boolean;
}) {
  const router = useRouter();
  const [f, setF] = useState<AlumniFilterState>(initial);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const lastPushedRef = useRef(toQs(initial));

  const serialized = toQs(f);
  const initialQs = toQs(initial);

  // "Clear all" resets every user-facing filter but PRESERVES the route-owned
  // needs_survey flag (true only on /needs-surveying) so clearing within the due
  // set keeps both the listing AND the export scoped to the due set.
  const clearedFilters: AlumniFilterState = {
    ...EMPTY_FILTERS,
    needsSurvey: initial.needsSurvey,
  };

  // Live navigation: debounce any change, skip no-ops. Use replace() (not push)
  // so live filtering doesn't stack a history entry per keystroke — that lets
  // Back return to the previous page instead of stepping through filter states,
  // and keeps the filtered URL shareable. Clearing to empty navigates at once so
  // the list (and the ?q= param) reset immediately rather than after the debounce.
  useEffect(() => {
    if (serialized === lastPushedRef.current) return;
    const navigate = () => {
      lastPushedRef.current = serialized;
      startTransition(() => {
        router.replace(serialized ? `${basePath}?${serialized}` : basePath);
      });
    };
    if (serialized === "") {
      navigate();
      return;
    }
    const timer = setTimeout(navigate, 300);
    return () => clearTimeout(timer);
  }, [serialized, router, basePath]);

  // Re-seed only when the URL changed from outside (deep-link / Clear).
  useEffect(() => {
    if (initialQs !== lastPushedRef.current) {
      lastPushedRef.current = initialQs;
      setF(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQs]);

  // Close the slide-over on Escape.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const set = <K extends keyof AlumniFilterState>(
    key: K,
    value: AlumniFilterState[K],
  ) => setF((prev) => ({ ...prev, [key]: value }));

  // Natural-language submit: on Enter / the search button, map a full sentence
  // (e.g. "alumni in investment banking near Seattle") onto the real filter
  // params via the same parser the dashboard search hero uses, then deep-link to
  // the parsed /alumni URL. Live keystroke URL-sync (set("q", …)) stays intact;
  // this only fires on explicit submit. Guarded to the main list so the
  // /needs-surveying view (its own basePath) keeps its route-owned scoping and
  // never bounces over to /alumni mid-search.
  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (basePath === "/alumni") {
      startTransition(() => {
        router.push(parseAlumniQuery(f.q));
      });
    }
  };

  const facetCount = FACETS.reduce(
    (n, facet) => n + (f[facet.key] as string[]).length,
    0,
  );
  const activeCount =
    facetCount +
    f.designations.length +
    (f.gender ? 1 : 0) +
    (f.industryGroup ? 1 : 0) +
    (f.ymin.trim() || f.ymax.trim() ? 1 : 0) +
    (f.contactedAfter ? 1 : 0) +
    (f.contactedBefore ? 1 : 0) +
    (f.neverContacted ? 1 : 0) +
    (f.attended ? 1 : 0) +
    (f.donor ? 1 : 0) +
    (f.mentor ? 1 : 0) +
    (f.speaker ? 1 : 0) +
    (f.cfa ? 1 : 0) +
    (f.cpa ? 1 : 0) +
    (f.graduateDegree ? 1 : 0) +
    (f.archived ? 1 : 0) +
    (f.deceased ? 1 : 0) +
    (f.missingEmail ? 1 : 0) +
    (f.missingEmployer ? 1 : 0) +
    (f.duplicate ? 1 : 0);

  const isDirty = serialized !== "";

  // Flat list of removable chips across every active filter.
  const chips: { label: string; remove: () => void }[] = [];
  for (const facet of FACETS) {
    for (const v of f[facet.key] as string[]) {
      chips.push({
        label: `${facet.label}: ${v}`,
        remove: () =>
          set(
            facet.key,
            (f[facet.key] as string[]).filter((x) => x !== v) as never,
          ),
      });
    }
  }
  for (const v of f.designations) {
    chips.push({
      label: `Designation: ${v}`,
      remove: () =>
        set(
          "designations",
          f.designations.filter((x) => x !== v),
        ),
    });
  }
  if (f.gender) {
    chips.push({
      label: `Gender: ${f.gender === "F" ? "Female (F)" : "Male (M)"}`,
      remove: () => set("gender", ""),
    });
  }
  if (f.industryGroup) {
    chips.push({
      label:
        f.industryGroup === "other"
          ? "Industry: Other (non-finance)"
          : "Industry: Missing",
      remove: () => set("industryGroup", ""),
    });
  }
  if (f.ymin || f.ymax) {
    chips.push({
      label: `Grad year: ${f.ymin || "…"}–${f.ymax || "…"}`,
      remove: () => setF((p) => ({ ...p, ymin: "", ymax: "" })),
    });
  }
  if (f.contactedAfter)
    chips.push({ label: `Contacted after ${f.contactedAfter}`, remove: () => set("contactedAfter", "") });
  if (f.contactedBefore)
    chips.push({ label: `Not contacted since ${f.contactedBefore}`, remove: () => set("contactedBefore", "") });
  if (f.neverContacted)
    chips.push({ label: "Never contacted", remove: () => set("neverContacted", false) });
  if (f.attended) chips.push({ label: "Attended an event", remove: () => set("attended", false) });
  if (f.donor) chips.push({ label: "PIFF donor", remove: () => set("donor", false) });
  if (f.mentor) chips.push({ label: "Willing to mentor", remove: () => set("mentor", false) });
  if (f.speaker) chips.push({ label: "Willing to guest speak", remove: () => set("speaker", false) });
  if (f.cfa) chips.push({ label: "CFA", remove: () => set("cfa", false) });
  if (f.cpa) chips.push({ label: "CPA", remove: () => set("cpa", false) });
  if (f.graduateDegree)
    chips.push({
      label: "Graduate degree",
      remove: () => set("graduateDegree", false),
    });
  if (f.missingEmail) chips.push({ label: "Missing email", remove: () => set("missingEmail", false) });
  if (f.missingEmployer) chips.push({ label: "Missing employer", remove: () => set("missingEmployer", false) });
  if (f.duplicate) chips.push({ label: "Duplicate", remove: () => set("duplicate", false) });
  if (f.archived) chips.push({ label: "Including archived", remove: () => set("archived", false) });
  if (f.deceased)
    chips.push({
      label: f.deceased === "only" ? "Deceased only" : "Excluding deceased",
      remove: () => set("deceased", ""),
    });

  const checkboxRow = (
    key: "attended" | "donor" | "mentor" | "speaker" | "cfa" | "cpa" | "graduateDegree" | "archived" | "neverContacted" | "missingEmail" | "missingEmployer" | "duplicate",
    label: string,
  ) => (
    <label className="flex items-center gap-2 text-sm text-gray-700">
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-gray-300 accent-brand-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500 focus-visible:ring-offset-1"
        checked={f[key]}
        onChange={(e) => set(key, e.target.checked)}
      />
      {label}
    </label>
  );

  return (
    <>
      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white p-3 shadow-card">
        {canCreate ? (
          <Button asChild>
            <Link href={isFriend ? "/alumni/new?kind=friend" : "/alumni/new"}>
              <Plus className="h-4 w-4" /> {isFriend ? "Add friend" : "Add alumni"}
            </Link>
          </Button>
        ) : null}

        {/* Friends CSV bulk import (#294) — text-only, mirrors the alumni import
            entry point under Admin. Full access only, and the backend re-enforces
            it on the import endpoints. */}
        {isFriend && canCreate ? (
          <Button asChild variant="secondary">
            <Link href="/friends/import">Import CSV</Link>
          </Button>
        ) : null}

        <form
          onSubmit={onSearchSubmit}
          role="search"
          aria-label="Search alumni"
          className="flex min-w-[220px] flex-1 items-center gap-2 rounded-md border border-gray-300 bg-white px-3 focus-within:border-brand-blue-600 focus-within:ring-2 focus-within:ring-brand-blue-500 focus-within:ring-offset-1"
        >
          <Search className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
          <input
            value={f.q}
            onChange={(e) => set("q", e.target.value)}
            placeholder="Search a name (incl. maiden name), BYU ID, or a plain-English question"
            aria-label="Search alumni"
            className="h-9 w-full bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
          />
          {isPending && (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-gray-400" aria-hidden="true" />
          )}
          {f.q && !isPending && (
            <button
              type="button"
              onClick={() => set("q", "")}
              aria-label="Clear search"
              className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-gray-400 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500 focus-visible:ring-offset-1"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </form>

        <Select
          value={f.sort}
          onChange={(e) => set("sort", e.target.value as AlumniFilterState["sort"])}
          aria-label="Sort alumni"
          className="w-auto shrink-0 font-semibold text-gray-700"
        >
          <option value="name">Sort: Name (A–Z)</option>
          <option value="grad_desc">Sort: Grad year (newest)</option>
          <option value="grad_asc">Sort: Grad year (oldest)</option>
          <option value="industry">Sort: Industry (A–Z)</option>
          <option value="employer">Sort: Company (A–Z)</option>
          <option value="city">Sort: City (A–Z)</option>
          <option value="state">Sort: State (A–Z)</option>
          <option value="gender">Sort: Gender</option>
          <option value="updated">Sort: Recently updated</option>
        </Select>

        <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          Filters
          {activeCount > 0 && (
            <Badge variant="solid" size="sm" className="tabular-nums">
              {activeCount}
            </Badge>
          )}
        </Button>

        {canExport ? (
          <ExportAlumniButton
            filters={toExportFilters(f)}
            filtersActive={isDirty}
            total={total}
          />
        ) : null}
      </div>

      {/* Active-filter chips — squared, text-style controls (#225) rather than
          rounded-full pills, for a cleaner look consistent with the toolbar. */}
      {chips.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {chips.map((chip, i) => (
            <span
              key={`${chip.label}-${i}`}
              className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-gray-200 bg-gray-50 py-1 pl-2.5 pr-1 text-xs font-medium text-gray-700"
            >
              {chip.label}
              <button
                type="button"
                onClick={chip.remove}
                aria-label={`Remove ${chip.label}`}
                className="flex h-4 w-4 items-center justify-center rounded text-gray-400 hover:bg-gray-200 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500 focus-visible:ring-offset-1"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </span>
          ))}
          <Button
            type="button"
            variant="link"
            size="sm"
            className="px-1"
            onClick={() => setF(clearedFilters)}
          >
            Clear all
          </Button>
        </div>
      )}

      {/* Slide-over panel */}
      {open && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div
            className="absolute inset-0 bg-navy-900/40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Advanced filters"
            className="relative flex h-full w-full max-w-md flex-col bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <h2 className="text-base font-semibold text-gray-900">Filters</h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                aria-label="Close filters"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </Button>
            </div>

            <div className="flex-1 space-y-4 overflow-auto px-5 py-4">
              {FACETS.map((facet) => (
                <MultiSelect
                  key={facet.key as string}
                  label={facet.label}
                  options={options[facet.optKey] as string[]}
                  selected={f[facet.key] as string[]}
                  onChange={(next) => set(facet.key, next as never)}
                />
              ))}

              {/* Professional designations (#404): static CFP/CFA/CPA vocabulary,
                  OR semantics — an alumnus holding ANY selected designation matches. */}
              <MultiSelect
                label="Designations"
                options={DESIGNATION_OPTIONS}
                selected={f.designations}
                onChange={(next) => set("designations", next)}
              />

              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Gender
                </p>
                <Select
                  value={f.gender}
                  onChange={(e) =>
                    set("gender", e.target.value as AlumniFilterState["gender"])
                  }
                  aria-label="Filter by gender"
                >
                  <option value="">All</option>
                  <option value="F">Female (F)</option>
                  <option value="M">Male (M)</option>
                </Select>
              </div>

              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Industry group
                </p>
                <Select
                  value={f.industryGroup}
                  onChange={(e) =>
                    set(
                      "industryGroup",
                      e.target.value as AlumniFilterState["industryGroup"],
                    )
                  }
                  aria-label="Filter by industry group"
                >
                  <option value="">Any</option>
                  <option value="other">Other (non-finance)</option>
                  <option value="unknown">Missing industry</option>
                </Select>
              </div>

              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Graduation year
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={f.ymin}
                    onChange={(e) => set("ymin", e.target.value)}
                    placeholder="From"
                    aria-label="Graduation year from"
                    className="w-24 tabular-nums"
                  />
                  <span className="text-sm text-gray-500">–</span>
                  <Input
                    type="number"
                    value={f.ymax}
                    onChange={(e) => set("ymax", e.target.value)}
                    placeholder="To"
                    aria-label="Graduation year to"
                    className="w-24 tabular-nums"
                  />
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Last contacted
                </p>
                <div className="space-y-2">
                  <label className="flex items-center justify-between gap-2 text-sm text-gray-700">
                    Contacted after
                    <Input
                      type="date"
                      value={f.contactedAfter}
                      onChange={(e) => set("contactedAfter", e.target.value)}
                      className="w-auto"
                      style={{ colorScheme: "light" }}
                    />
                  </label>
                  <label className="flex items-center justify-between gap-2 text-sm text-gray-700">
                    Not contacted since
                    <Input
                      type="date"
                      value={f.contactedBefore}
                      onChange={(e) => set("contactedBefore", e.target.value)}
                      className="w-auto"
                      style={{ colorScheme: "light" }}
                    />
                  </label>
                  {checkboxRow("neverContacted", "Never contacted")}
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Engagement
                </p>
                <div className="space-y-2">
                  {checkboxRow("attended", "Attended an event")}
                  {checkboxRow("donor", "PIFF donor")}
                  {checkboxRow("mentor", "Willing to mentor")}
                  {checkboxRow("speaker", "Willing to guest speak")}
                  {checkboxRow("cfa", "CFA designation")}
                  {checkboxRow("cpa", "CPA designation")}
                  {checkboxRow("graduateDegree", "Graduate degree")}
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Data quality
                </p>
                <div className="space-y-2">
                  {checkboxRow("missingEmail", "Missing email")}
                  {checkboxRow("missingEmployer", "Missing employer")}
                  {checkboxRow("duplicate", "Possible duplicate")}
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Status
                </p>
                <div className="space-y-2">
                  {checkboxRow("archived", "Include archived")}
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    Deceased
                    <Select
                      value={f.deceased}
                      onChange={(e) =>
                        set("deceased", e.target.value as AlumniFilterState["deceased"])
                      }
                      className="w-auto"
                    >
                      <option value="">Any</option>
                      <option value="exclude">Exclude</option>
                      <option value="only">Only</option>
                    </Select>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-gray-200 px-5 py-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setF(clearedFilters)}
                disabled={!isDirty}
              >
                Clear all
              </Button>
              <Button type="button" onClick={() => setOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
