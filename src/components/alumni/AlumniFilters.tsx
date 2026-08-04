"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import { MultiSelect } from "@/components/alumni/MultiSelect";
import { ExportAlumniButton } from "@/components/alumni/ExportAlumniButton";
import { exportParityGaps, toExportFilters } from "@/lib/exportFilters";
import { parseAlumniQuery } from "@/lib/alumniQueryParser";
import {
  EMPTY_FILTERS,
  EMPTY_PASS_THROUGH,
  FACETS,
  countActiveFilters,
  hasPassThroughFilters,
  facetOptions,
  toAlumniFilterQs as toQs,
  type AlumniFilterState,
  type PassThroughFilters,
} from "@/lib/alumniFilterParams";
import type { FilterOptions } from "@/types/filters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

/**
 * The filter model, its URL parser, its serializer and the facet table all live
 * in `@/lib/alumniFilterParams` — this panel re-serializes its whole state into
 * the querystring on every interaction, so anything the model doesn't carry is
 * destroyed. Keeping the three in one module (with a test that round-trips them)
 * is what stops a newly shipped filter param from silently vanishing here.
 * Re-exported for the existing import sites.
 */
export type { AlumniFilterState };
export { EMPTY_FILTERS };

/** Fixed professional-designation vocabulary for the #404 filter. Static (not
 *  drawn from FilterOptions) — the backend validates values against exactly
 *  CFP|CFA|CPA (case-insensitive) and 422s anything else. */
const DESIGNATION_OPTIONS = ["CFP", "CFA", "CPA"];

/** Sort options, shared by the desktop <Select> and the mobile consolidated
 *  menu so both stay in sync. */
const SORT_OPTIONS: { value: AlumniFilterState["sort"]; label: string }[] = [
  { value: "name", label: "Name (A–Z)" },
  { value: "grad_desc", label: "Grad year (newest)" },
  { value: "grad_asc", label: "Grad year (oldest)" },
  { value: "industry", label: "Industry (A–Z)" },
  { value: "city", label: "City (A–Z)" },
  { value: "state", label: "State (A–Z)" },
];

const EMPTY_OPTIONS: FilterOptions = {
  employers: [],
  past_employers: [],
  titles: [],
  seniority_levels: [],
  industries: [],
  secondary_industries: [],
  employment_statuses: [],
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
  passThrough = EMPTY_PASS_THROUGH,
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
   *  roster scope itself is fixed by the route (basePath), not a query param —
   *  and it is a POPULATION predicate, so the export carries it as
   *  `is_alumni=false` (#592). */
  isFriend?: boolean;
  /** URL-only narrowing params the roster honoured on this request (employer,
   *  identity fields, location search, guest-speaker dates). The panel has no
   *  control for them, but an export has to cover the same people the list
   *  does, so they travel into the export body (#592). */
  passThrough?: PassThroughFilters;
}) {
  const router = useRouter();
  const [f, setF] = useState<AlumniFilterState>(initial);
  const [open, setOpen] = useState(false);
  // Opens the Export dialog from the consolidated mobile menu (the dialog itself
  // lives in a hidden-trigger ExportAlumniButton below the toolbar).
  const [mobileExportOpen, setMobileExportOpen] = useState(false);
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

  // Counted from the shared FACETS / BOOLEAN_FLAGS tables, so a facet added to
  // the model is counted here without a second edit (the old hand-written sum
  // is exactly what let three new filters go uncounted).
  const activeCount = countActiveFilters(f);

  const isDirty = serialized !== "";

  /* The CSV export covers THIS view (#592). All three inputs matter: the panel's
     state, the route's scope (alumni vs friends of the program) and the URL-only
     params the roster applied. `exportGaps` lists any active filter the export
     API cannot express — non-empty means the file would contain people the list
     is excluding, so the dialog refuses instead of over-disclosing. */
  const scope = isFriend ? "friend" : "alumni";
  const exportFilters = toExportFilters(f, scope, passThrough);
  const exportGaps = exportParityGaps(f, scope, passThrough);
  const exportFiltersActive = isDirty || hasPassThroughFilters(passThrough);

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
  if (f.cfp) chips.push({ label: "CFP", remove: () => set("cfp", false) });
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
    key: "attended" | "donor" | "mentor" | "speaker" | "cfa" | "cfp" | "cpa" | "graduateDegree" | "archived" | "neverContacted" | "missingEmail" | "missingEmployer" | "duplicate",
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
      {/* Toolbar. Desktop shows every control inline; on mobile the search bar
          stays and Add / Sort / Filters / Export collapse into one menu. */}
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white p-3 shadow-card">
        {/* Add — desktop toolbar only (mobile: in the menu). */}
        {canCreate ? (
          <Button asChild className="hidden md:inline-flex">
            <Link href={isFriend ? "/alumni/new?kind=friend" : "/alumni/new"}>
              <Plus className="h-4 w-4" /> {isFriend ? "Add friend" : "Add alumni"}
            </Link>
          </Button>
        ) : null}

        {/* Friends CSV bulk import (#294) — desktop toolbar only (mobile: menu).
            Full access only, and the backend re-enforces it on the import
            endpoints. */}
        {isFriend && canCreate ? (
          <Button asChild variant="secondary" className="hidden md:inline-flex">
            <Link href="/friends/import">Import CSV</Link>
          </Button>
        ) : null}

        <form
          onSubmit={onSearchSubmit}
          role="search"
          aria-label="Search alumni"
          className="flex min-w-[160px] flex-1 items-center gap-2 rounded-md border border-gray-300 bg-white px-3 focus-within:border-brand-blue-600 focus-within:ring-2 focus-within:ring-brand-blue-500 focus-within:ring-offset-1 md:min-w-[220px]"
        >
          <Search className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
          <input
            value={f.q}
            onChange={(e) => set("q", e.target.value)}
            placeholder="Search a name"
            aria-label="Search alumni by name, BYU ID, or a plain-English question"
            // text-base on mobile matches the dashboard search bar and prevents
            // the iOS focus-zoom; text-sm on desktop keeps the dense toolbar.
            className="h-9 w-full bg-transparent text-base text-gray-900 placeholder:text-gray-400 focus:outline-none md:text-sm"
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

        {/* Sort — desktop toolbar only (mobile: in the menu). */}
        <Select
          value={f.sort}
          onChange={(e) => set("sort", e.target.value as AlumniFilterState["sort"])}
          aria-label="Sort alumni"
          className="hidden w-auto shrink-0 font-semibold text-gray-700 md:block"
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

        {/* Filters — desktop toolbar only (mobile: in the menu). */}
        <Button
          type="button"
          variant="secondary"
          onClick={() => setOpen(true)}
          className="hidden md:inline-flex"
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          Filters
          {activeCount > 0 && (
            <Badge variant="solid" size="sm" className="tabular-nums">
              {activeCount}
            </Badge>
          )}
        </Button>

        {/* Export — desktop toolbar only (mobile: in the menu). */}
        {canExport ? (
          <span className="hidden md:inline-flex">
            <ExportAlumniButton
              filters={exportFilters}
              filtersActive={exportFiltersActive}
              unsupportedFilters={exportGaps}
              noun={isFriend ? "friends of the program" : "alumni"}
              total={total}
            />
          </span>
        ) : null}

        {/* Mobile: one consolidated menu — Add · Sort · Filters · Export.
            modal={false}: a modal dropdown locks `pointer-events:none` on <body>
            while open; picking Sort/Filters re-navigates via a query-string
            change (same path), which interrupts Radix's close cleanup and leaves
            that lock stuck — freezing the page so alumni cards can't be tapped.
            PointerEventsGuard only heals on PATH changes, not query changes, so a
            non-modal menu (no body lock) is the correct fix here. */}
        <div className="md:hidden">
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="secondary" className="h-9 shrink-0">
                Menu
                {activeCount > 0 && (
                  <Badge variant="solid" size="sm" className="tabular-nums">
                    {activeCount}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            {/* Add / Import live in the mobile FAB now — this menu is just the
                list controls (Sort · Filters · Export). */}
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Sort by</DropdownMenuLabel>
              {SORT_OPTIONS.map((o) => (
                <DropdownMenuItem
                  key={o.value}
                  onSelect={() => set("sort", o.value)}
                >
                  <span className="w-4 text-brand-blue-600">
                    {f.sort === o.value ? "✓" : ""}
                  </span>
                  {o.label}
                </DropdownMenuItem>
              ))}

              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setOpen(true)}>
                Filters{activeCount > 0 ? ` (${activeCount})` : ""}
              </DropdownMenuItem>
              {canExport ? (
                <DropdownMenuItem onSelect={() => setMobileExportOpen(true)}>
                  Export CSV
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Export dialog opened from the mobile menu (renders no trigger of its
          own; the mobile menu drives its open state). */}
      {canExport ? (
        <ExportAlumniButton
          filters={exportFilters}
          filtersActive={exportFiltersActive}
          unsupportedFilters={exportGaps}
          noun={isFriend ? "friends of the program" : "alumni"}
          total={total}
          open={mobileExportOpen}
          onOpenChange={setMobileExportOpen}
          hideTrigger
        />
      ) : null}

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
              {/* `facetOptions` resolves each facet's list: the data-derived
                  one from /alumni/filter-options, EXCEPT where the facet has a
                  fixed vocabulary (Employment status — see FIXED_FACET_OPTIONS).
                  Shared with the dashboard's Advanced search so the two panels
                  can't offer different options for the same facet. */}
              {FACETS.map((facet) => (
                <MultiSelect
                  key={facet.key as string}
                  label={facet.label}
                  options={facetOptions(facet.optKey, options)}
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
                  {/* All three finance designations the survey collects (#529).
                      These are the BOOLEAN cfa/cfp/cpa params — each AND-narrows
                      to holders of that one designation — which is a different
                      question from the "Designations" multi-select above (OR
                      across the picked ones). Both mechanisms are intentional;
                      don't merge them. */}
                  {checkboxRow("cfa", "CFA designation")}
                  {checkboxRow("cfp", "CFP designation")}
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
