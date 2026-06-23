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

/** Everything the backend GET /events supports, mirrored in the URL. */
export interface EventsFilterState {
  q: string;
  /** Event type (case-insensitive exact). */
  type: string;
  /** Event-date range (inclusive). */
  from: string;
  to: string;
  /** List sort order. */
  sort: "date" | "upcoming" | "type";
}

export const EMPTY_FILTERS: EventsFilterState = {
  q: "",
  type: "",
  from: "",
  to: "",
  sort: "date",
};

/** Serialize filter state to the canonical /events query string. */
function toQs(f: EventsFilterState): string {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set("q", f.q.trim());
  if (f.type) p.set("type", f.type);
  if (f.from.trim()) p.set("from", f.from.trim());
  if (f.to.trim()) p.set("to", f.to.trim());
  if (f.sort && f.sort !== "date") p.set("sort", f.sort);
  return p.toString();
}

/**
 * Toolbar for the events list: Add event on the left, the live search spanning
 * the middle, and the Filters menu pinned far right. Filtering is LIVE — typing
 * or changing any filter navigates (debounced) and the server refetches; there
 * is no Apply button. State is mirrored into the URL so deep links and manual
 * filtering share one source of truth; a guarded re-seed keeps the inputs in
 * sync when navigation changes the params underneath us without clobbering
 * keystrokes typed since the last push. Mirrors the alumni toolbar.
 */
export function EventsToolbar({
  initial,
  types,
  canManageEvents = false,
}: {
  initial: EventsFilterState;
  /** Distinct event-type options for the menu (from GET /events/options). */
  types: string[];
  /** full_access tier — gates the "Add event" entry point. view_only
   *  ("Professor") never sees it; the backend re-enforces every write. */
  canManageEvents?: boolean;
}) {
  const router = useRouter();
  const [f, setF] = useState<EventsFilterState>(initial);
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
        router.push(serialized ? `/events?${serialized}` : "/events");
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [serialized, router]);

  // Re-seed only when the URL changed from outside (e.g. a deep link) — never
  // in response to our own pushes mid-typing.
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

  const set = <K extends keyof EventsFilterState>(
    key: K,
    value: EventsFilterState[K],
  ) => setF((prev) => ({ ...prev, [key]: value }));

  const activeCount =
    (f.type ? 1 : 0) + (f.from.trim() || f.to.trim() ? 1 : 0);

  const isDirty = serialized !== "";

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-gray-300 bg-white p-3">
      {canManageEvents ? (
        <Link
          href="/events/new"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-blue-500"
        >
          <Plus className="h-4 w-4" /> Add event
        </Link>
      ) : null}

      <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 focus-within:border-brand-blue-600 focus-within:ring-1 focus-within:ring-brand-blue-600">
        <Search className="h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
        <input
          value={f.q}
          onChange={(e) => set("q", e.target.value)}
          placeholder="Search event name or location"
          aria-label="Search events"
          className="w-full bg-transparent text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none"
        />
        {isPending && (
          <Loader2
            className="h-4 w-4 shrink-0 animate-spin text-gray-500"
            aria-hidden="true"
          />
        )}
      </div>

      <div className="relative shrink-0">
        <select
          value={f.sort}
          onChange={(e) =>
            set("sort", e.target.value as EventsFilterState["sort"])
          }
          aria-label="Sort events"
          className="appearance-none rounded-lg border border-gray-300 bg-white py-2 pl-3 pr-9 text-sm font-semibold text-gray-700 hover:bg-gray-50 focus:outline-none"
          style={{ colorScheme: "light" }}
        >
          <option value="date">Sort: Newest</option>
          <option value="upcoming">Sort: Upcoming</option>
          <option value="type">Sort: By type</option>
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
          aria-hidden="true"
        />
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
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Event type
                </p>
                <select
                  value={f.type}
                  onChange={(e) => set("type", e.target.value)}
                  aria-label="Event type"
                  className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:outline-none"
                  style={{ colorScheme: "light" }}
                >
                  <option value="">All</option>
                  {types.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                  {/* Keep a deep-linked value selectable even if it isn't in options. */}
                  {f.type && !types.includes(f.type) && (
                    <option value={f.type}>{f.type}</option>
                  )}
                </select>
              </div>

              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Date range
                </p>
                {/* grid + min-w-0 so the date inputs (large intrinsic min
                    width) can't overflow the w-80 panel */}
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={f.from}
                    onChange={(e) => set("from", e.target.value)}
                    aria-label="Date from"
                    className="w-full min-w-0 rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900 focus:outline-none"
                    style={{ colorScheme: "light" }}
                  />
                  <input
                    type="date"
                    value={f.to}
                    onChange={(e) => set("to", e.target.value)}
                    aria-label="Date to"
                    className="w-full min-w-0 rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900 focus:outline-none"
                    style={{ colorScheme: "light" }}
                  />
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
