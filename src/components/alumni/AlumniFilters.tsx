"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  ChevronDown,
  Loader2,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react";

/** Everything the backend GET /alumni supports, mirrored in the URL. */
export interface AlumniFilterState {
  q: string;
  /** Grad-year range (inclusive). Same value in both = exact year. */
  ymin: string;
  ymax: string;
  employer: string;
  /** Work area — current industry, primary or secondary. */
  industry: string;
  attended: boolean;
  donor: boolean;
  mentor: boolean;
  speaker: boolean;
  archived: boolean;
  deceased: "" | "only" | "exclude";
  missingEmail: boolean;
  missingEmployer: boolean;
  duplicate: boolean;
}

export const EMPTY_FILTERS: AlumniFilterState = {
  q: "",
  ymin: "",
  ymax: "",
  employer: "",
  industry: "",
  attended: false,
  donor: false,
  mentor: false,
  speaker: false,
  archived: false,
  deceased: "",
  missingEmail: false,
  missingEmployer: false,
  duplicate: false,
};

/** Serialize filter state to the canonical /alumni query string. */
function toQs(f: AlumniFilterState): string {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set("q", f.q.trim());
  if (f.ymin.trim()) p.set("ymin", f.ymin.trim());
  if (f.ymax.trim()) p.set("ymax", f.ymax.trim());
  if (f.employer) p.set("employer", f.employer);
  if (f.industry) p.set("industry", f.industry);
  if (f.attended) p.set("attended", "1");
  if (f.donor) p.set("donor", "1");
  if (f.mentor) p.set("mentor", "1");
  if (f.speaker) p.set("speaker", "1");
  if (f.archived) p.set("archived", "1");
  if (f.deceased === "only") p.set("deceased", "1");
  if (f.deceased === "exclude") p.set("deceased", "0");
  if (f.missingEmail) p.set("missing_email", "1");
  if (f.missingEmployer) p.set("missing_employer", "1");
  if (f.duplicate) p.set("duplicate", "1");
  return p.toString();
}

/**
 * Toolbar for the alumni list: Add alumni on the left, the live search
 * spanning the middle, and the Filters menu pinned far right. Filtering is
 * LIVE — typing or toggling any filter navigates (debounced) and the server
 * refetches; there is no Apply button. State is mirrored into the URL so
 * dashboard deep links and manual filtering share one source of truth; a
 * guarded re-seed keeps the inputs in sync when navigation changes the params
 * underneath us without clobbering keystrokes typed since the last push.
 */
export function AlumniFilters({
  initial,
  employers,
  industries,
}: {
  initial: AlumniFilterState;
  /** Distinct employer options for the menu (from geography summary). */
  employers: string[];
  /** Distinct industry / work-area options for the menu. */
  industries: string[];
}) {
  const router = useRouter();
  const [f, setF] = useState<AlumniFilterState>(initial);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const menuRef = useRef<HTMLDivElement>(null);
  // Query string of the last navigation WE initiated (or were seeded with) —
  // distinguishes our own URL updates from external ones (deep links, Clear).
  const lastPushedRef = useRef(toQs(initial));

  const serialized = toQs(f);
  const initialQs = toQs(initial);

  // Live navigation: debounce any state change, skip no-ops.
  useEffect(() => {
    if (serialized === lastPushedRef.current) return;
    const timer = setTimeout(() => {
      lastPushedRef.current = serialized;
      startTransition(() => {
        router.push(serialized ? `/alumni?${serialized}` : "/alumni");
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [serialized, router]);

  // Re-seed only when the URL changed from outside (e.g. a dashboard
  // deep-link) — never in response to our own pushes mid-typing.
  useEffect(() => {
    if (initialQs !== lastPushedRef.current) {
      lastPushedRef.current = initialQs;
      setF(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQs]);

  // Close the menu on any click outside it.
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const set = <K extends keyof AlumniFilterState>(
    key: K,
    value: AlumniFilterState[K],
  ) => setF((prev) => ({ ...prev, [key]: value }));

  const activeCount =
    (f.ymin.trim() || f.ymax.trim() ? 1 : 0) +
    (f.employer ? 1 : 0) +
    (f.industry ? 1 : 0) +
    (f.attended ? 1 : 0) +
    (f.donor ? 1 : 0) +
    (f.mentor ? 1 : 0) +
    (f.speaker ? 1 : 0) +
    (f.archived ? 1 : 0) +
    (f.deceased ? 1 : 0) +
    (f.missingEmail ? 1 : 0) +
    (f.missingEmployer ? 1 : 0) +
    (f.duplicate ? 1 : 0);

  const isDirty = serialized !== "";

  const checkboxRow = (
    key:
      | "attended"
      | "donor"
      | "mentor"
      | "speaker"
      | "archived"
      | "missingEmail"
      | "missingEmployer"
      | "duplicate",
    label: string,
  ) => (
    <label className="flex items-center gap-2 text-sm text-gray-700">
      <input
        type="checkbox"
        checked={f[key]}
        onChange={(e) => set(key, e.target.checked)}
      />
      {label}
    </label>
  );

  const selectRow = (
    key: "employer" | "industry",
    label: string,
    options: string[],
  ) => (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <select
        value={f[key]}
        onChange={(e) => set(key, e.target.value)}
        aria-label={label}
        className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:outline-none"
        style={{ colorScheme: "light" }}
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
        {/* Keep a deep-linked value selectable even if it isn't in options. */}
        {f[key] && !options.includes(f[key]) && (
          <option value={f[key]}>{f[key]}</option>
        )}
      </select>
    </div>
  );

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-gray-300 bg-white p-3">
      <Link
        href="/alumni/new"
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-blue-500"
      >
        <Plus className="h-4 w-4" /> Add alumni
      </Link>

      <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 focus-within:border-brand-blue-600 focus-within:ring-1 focus-within:ring-brand-blue-600">
        <Search className="h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
        <input
          value={f.q}
          onChange={(e) => set("q", e.target.value)}
          placeholder="Search name, BYU ID, or Net ID"
          aria-label="Search alumni"
          className="w-full bg-transparent text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none"
        />
        {isPending && (
          <Loader2
            className="h-4 w-4 shrink-0 animate-spin text-gray-500"
            aria-hidden="true"
          />
        )}
      </div>

      <div ref={menuRef} className="relative shrink-0">
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          aria-expanded={menuOpen}
          aria-haspopup="true"
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          Filters
          {activeCount > 0 && (
            <span className="rounded-full bg-brand-blue-600 px-1.5 py-0.5 text-xs font-semibold leading-none text-white">
              {activeCount}
            </span>
          )}
          <ChevronDown className="h-4 w-4 text-gray-500" aria-hidden="true" />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full z-50 mt-1 w-80 rounded-lg border border-gray-300 bg-white p-4 shadow-lg">
            <div className="space-y-4">
              {selectRow("industry", "Work area", industries)}
              {selectRow("employer", "Employer", employers)}

              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Engagement
                </p>
                <div className="space-y-2">
                  {checkboxRow("attended", "Attended an event")}
                  {checkboxRow("donor", "PIFF donor")}
                  {checkboxRow("mentor", "Willing to mentor")}
                  {checkboxRow("speaker", "Willing to guest speak")}
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Graduation year
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={f.ymin}
                    onChange={(e) => set("ymin", e.target.value)}
                    placeholder="From"
                    aria-label="Graduation year from"
                    className="w-24 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none"
                  />
                  <span className="text-sm text-gray-500">–</span>
                  <input
                    type="number"
                    value={f.ymax}
                    onChange={(e) => set("ymax", e.target.value)}
                    placeholder="To"
                    aria-label="Graduation year to"
                    className="w-24 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none"
                  />
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
                    <select
                      value={f.deceased}
                      onChange={(e) =>
                        set(
                          "deceased",
                          e.target.value as AlumniFilterState["deceased"],
                        )
                      }
                      className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:outline-none"
                      style={{ colorScheme: "light" }}
                    >
                      <option value="">Any</option>
                      <option value="exclude">Exclude</option>
                      <option value="only">Only</option>
                    </select>
                  </label>
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Data quality
                </p>
                <div className="space-y-2">
                  {checkboxRow("missingEmail", "Missing email")}
                  {checkboxRow("missingEmployer", "Missing employer")}
                  {checkboxRow("duplicate", "Duplicate candidates")}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setF(EMPTY_FILTERS)}
                disabled={!isDirty}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 enabled:hover:bg-gray-50 disabled:text-gray-300"
              >
                Clear all filters
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
