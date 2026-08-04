"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ChevronDown, Loader2, Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";

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

  // Live navigation: debounce any state change, skip no-ops. replace() (not push)
  // so each keystroke/filter tweak doesn't stack a history entry — Back returns to
  // the previous page, not through intermediate filter states. Clearing navigates
  // immediately so the list resets without waiting out the debounce.
  useEffect(() => {
    if (serialized === lastPushedRef.current) return;
    const navigate = () => {
      lastPushedRef.current = serialized;
      startTransition(() => {
        router.replace(serialized ? `/events?${serialized}` : "/events");
      });
    };
    if (serialized === "") {
      navigate();
      return;
    }
    const timer = setTimeout(navigate, 300);
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
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white p-3 shadow-card">
      {/* Add event — desktop toolbar only (mobile: in the FAB). Points at the
          plain create form: creating ONE event is the common case and it needs
          no attendee list (#611). Bulk CSV import sits beside it as the
          clearly-labelled secondary action, never the default. */}
      {canManageEvents ? (
        <>
          <Button asChild className="hidden shrink-0 md:inline-flex">
            <Link href="/events/new">Add event</Link>
          </Button>
          <Button
            asChild
            variant="secondary"
            className="hidden shrink-0 md:inline-flex"
          >
            <Link href="/events/import">Import events from CSV</Link>
          </Button>
        </>
      ) : null}

      <div className="flex h-9 min-w-[160px] flex-1 items-center gap-2 rounded-md border border-gray-300 bg-white px-3 focus-within:border-brand-blue-600 focus-within:ring-2 focus-within:ring-brand-blue-500 focus-within:ring-offset-1 md:min-w-[220px]">
        <Search className="h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
        <input
          value={f.q}
          onChange={(e) => set("q", e.target.value)}
          placeholder="Search event name or location"
          aria-label="Search events"
          className="w-full bg-transparent text-base text-gray-900 placeholder:text-gray-400 focus:outline-none md:text-sm"
        />
        {isPending && (
          <Loader2
            className="h-4 w-4 shrink-0 animate-spin text-gray-500"
            aria-hidden="true"
          />
        )}
      </div>

      {/* Sort — desktop toolbar only (mobile: in the menu). */}
      <Select
        value={f.sort}
        onChange={(e) =>
          set("sort", e.target.value as EventsFilterState["sort"])
        }
        aria-label="Sort events"
        className="hidden w-auto shrink-0 font-semibold text-gray-700 md:block"
        style={{ colorScheme: "light" }}
      >
        <option value="date">Sort: Newest</option>
        <option value="upcoming">Sort: Upcoming</option>
        <option value="type">Sort: By type</option>
      </Select>

      <div ref={menuRef} className="relative shrink-0">
        {/* Mobile: this is the one consolidated menu (Add · Sort · Filters);
            desktop: just Filters. */}
        <Button
          type="button"
          variant="secondary"
          onClick={() => setMenuOpen((o) => !o)}
          aria-expanded={menuOpen}
          aria-haspopup="true"
          className="h-9"
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          <span className="md:hidden">Menu</span>
          <span className="hidden md:inline">Filters</span>
          {activeCount > 0 && (
            <Badge variant="solid" size="sm" className="tabular-nums">
              {activeCount}
            </Badge>
          )}
          <ChevronDown className="h-4 w-4 text-gray-500" aria-hidden="true" />
        </Button>

        {menuOpen && (
          <div className="absolute right-0 top-full z-50 mt-1 w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-gray-200 bg-white p-4 shadow-card">
            <div className="space-y-4">
              {/* Mobile only: Sort lives in this menu (desktop has it inline;
                  Add event is in the mobile FAB). */}
              <div className="md:hidden">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Sort
                </p>
                <Select
                  value={f.sort}
                  onChange={(e) =>
                    set("sort", e.target.value as EventsFilterState["sort"])
                  }
                  aria-label="Sort events"
                  style={{ colorScheme: "light" }}
                >
                  <option value="date">Newest</option>
                  <option value="upcoming">Upcoming</option>
                  <option value="type">By type</option>
                </Select>
              </div>

              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Event type
                </p>
                <Select
                  value={f.type}
                  onChange={(e) => {
                    set("type", e.target.value);
                    // A type pick is a complete selection; close the menu so the
                    // user is not left having to click outside (QA LOW-batch).
                    setMenuOpen(false);
                  }}
                  aria-label="Event type"
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
                </Select>
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
                    className="h-9 w-full min-w-0 rounded-md border border-gray-300 bg-white px-2 text-sm text-gray-900 focus-visible:border-brand-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500 focus-visible:ring-offset-1"
                    style={{ colorScheme: "light" }}
                  />
                  <input
                    type="date"
                    value={f.to}
                    onChange={(e) => set("to", e.target.value)}
                    aria-label="Date to"
                    className="h-9 w-full min-w-0 rounded-md border border-gray-300 bg-white px-2 text-sm text-gray-900 focus-visible:border-brand-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500 focus-visible:ring-offset-1"
                    style={{ colorScheme: "light" }}
                  />
                </div>
              </div>

              <Button
                type="button"
                variant="secondary"
                onClick={() => setF(EMPTY_FILTERS)}
                disabled={!isDirty}
                className="w-full"
              >
                Clear all filters
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
