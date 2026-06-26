"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  ChevronDown,
  Loader2,
  Search,
  SlidersHorizontal,
  UserCheck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Select } from "@/components/ui/select";
import { humanize } from "@/lib/format";

/** Everything the backend GET /dashboard/activity supports, mirrored in the URL. */
export interface ActivityFilterState {
  q: string;
  /** Interaction type (case-insensitive exact). */
  type: string;
  /** Interaction-date range (inclusive). */
  from: string;
  to: string;
  /** Feed sort order. */
  sort: "recent" | "oldest";
  /** "Interacted by me" — restrict to rows the current user is the actor of. */
  mine: boolean;
}

export const EMPTY_FILTERS: ActivityFilterState = {
  q: "",
  type: "",
  from: "",
  to: "",
  sort: "recent",
  mine: false,
};

/** Serialize filter state to the canonical /activity query string. */
function toQs(f: ActivityFilterState): string {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set("q", f.q.trim());
  if (f.type) p.set("type", f.type);
  if (f.from.trim()) p.set("from", f.from.trim());
  if (f.to.trim()) p.set("to", f.to.trim());
  if (f.sort && f.sort !== "recent") p.set("sort", f.sort);
  if (f.mine) p.set("mine", "1");
  return p.toString();
}

/**
 * Toolbar for the activity feed: the live search spans the middle and the
 * Filters menu is pinned far right. There is no Add button — interactions are
 * logged from alumni profiles, not here. Filtering is LIVE — typing or changing
 * any filter navigates (debounced) and the server refetches; there is no Apply
 * button. State is mirrored into the URL so deep links and manual filtering
 * share one source of truth; a guarded re-seed keeps the inputs in sync when
 * navigation changes the params underneath us without clobbering keystrokes
 * typed since the last push. Mirrors the events / alumni toolbars.
 */
export function ActivityToolbar({
  initial,
  types,
}: {
  initial: ActivityFilterState;
  /** Distinct interaction-type options for the menu (from the feed response). */
  types: string[];
}) {
  const router = useRouter();
  const [f, setF] = useState<ActivityFilterState>(initial);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const menuRef = useRef<HTMLDivElement>(null);
  // Query string of the last navigation WE initiated (or were seeded with) —
  // distinguishes our own URL updates from external ones (deep links, Clear).
  const lastPushedRef = useRef(toQs(initial));

  const serialized = toQs(f);
  const initialQs = toQs(initial);

  // Live navigation: debounce any state change, skip no-ops. Changing a filter
  // resets pagination by dropping the offset (we never carry it forward here).
  useEffect(() => {
    if (serialized === lastPushedRef.current) return;
    const navigate = () => {
      lastPushedRef.current = serialized;
      startTransition(() => {
        router.replace(serialized ? `/activity?${serialized}` : "/activity");
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

  const set = <K extends keyof ActivityFilterState>(
    key: K,
    value: ActivityFilterState[K],
  ) => setF((prev) => ({ ...prev, [key]: value }));

  const activeCount =
    (f.type ? 1 : 0) + (f.from.trim() || f.to.trim() ? 1 : 0);

  const isDirty = serialized !== "";

  // Toggle a type chip: clicking the active type clears it (back to "All").
  const toggleType = (t: string) => set("type", f.type === t ? "" : t);

  return (
    <>
    <Card className="mb-4 flex flex-wrap items-center gap-2 p-3">
      <div className="flex h-9 min-w-[220px] flex-1 items-center gap-2 rounded-md border border-gray-300 bg-gray-50 px-3 focus-within:border-brand-blue-600 focus-within:ring-2 focus-within:ring-brand-blue-500 focus-within:ring-offset-1">
        <Search className="h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
        <input
          value={f.q}
          onChange={(e) => set("q", e.target.value)}
          placeholder="Search by name or interaction type"
          aria-label="Search activity"
          className="w-full bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
        />
        {isPending && (
          <Loader2
            className="h-4 w-4 shrink-0 animate-spin text-gray-500"
            aria-hidden="true"
          />
        )}
      </div>

      {/* "Interacted by me" quick toggle — a prominent pill next to the search
          box (not buried in Filters). Active = filled brand-blue; aria-pressed
          conveys state to assistive tech, not color alone. */}
      <Button
        type="button"
        variant={f.mine ? "primary" : "secondary"}
        onClick={() => set("mine", !f.mine)}
        aria-pressed={f.mine}
      >
        <UserCheck className="h-4 w-4" aria-hidden="true" />
        Interacted by me
      </Button>

      <Select
        value={f.sort}
        onChange={(e) =>
          set("sort", e.target.value as ActivityFilterState["sort"])
        }
        aria-label="Sort activity"
        className="w-auto font-semibold text-gray-700"
      >
        <option value="recent">Sort: Most recent</option>
        <option value="oldest">Sort: Oldest</option>
      </Select>

      <div ref={menuRef} className="relative shrink-0">
        <Button
          type="button"
          variant="secondary"
          onClick={() => setMenuOpen((o) => !o)}
          aria-expanded={menuOpen}
          aria-haspopup="true"
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          Filters
          {activeCount > 0 && (
            <Badge variant="solid" size="sm" className="rounded-full">
              {activeCount}
            </Badge>
          )}
          <ChevronDown className="h-4 w-4 text-gray-500" aria-hidden="true" />
        </Button>

        {menuOpen && (
          <Card className="absolute right-0 top-full z-50 mt-1 w-80 p-4">
            <div className="space-y-4">
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Interaction type
                </p>
                <Select
                  value={f.type}
                  onChange={(e) => set("type", e.target.value)}
                  aria-label="Interaction type"
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
          </Card>
        )}
      </div>
    </Card>

      {/* Type filter chips — a quick, always-visible complement to the
          Interaction-type dropdown in the Filters menu. Both write the same
          `type` state, so they stay in sync and share the URL. "All" clears it. */}
      {types.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Chip
            type="button"
            active={!f.type}
            onClick={() => set("type", "")}
          >
            All
          </Chip>
          {types.map((t) => (
            <Chip
              key={t}
              type="button"
              active={f.type === t}
              aria-pressed={f.type === t}
              onClick={() => toggleType(t)}
            >
              {humanize(t)}
            </Chip>
          ))}
        </div>
      )}
    </>
  );
}
