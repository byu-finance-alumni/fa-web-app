"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ChevronDown, Loader2, Search, SlidersHorizontal } from "lucide-react";

/** Everything the audit list route supports, mirrored in the URL. The param
 *  names match what the page has always sent so existing deep links keep
 *  working. */
export interface AuditFilterState {
  /** Acting user's email (case-insensitive substring). */
  user: string;
  /** Exact action type, e.g. "update". */
  action_type: string;
  /** Exact entity type, e.g. "alumni". */
  entity_type: string;
  /** Created-at date range (inclusive). */
  date_from: string;
  date_to: string;
}

export const EMPTY_FILTERS: AuditFilterState = {
  user: "",
  action_type: "",
  entity_type: "",
  date_from: "",
  date_to: "",
};

/** Serialize filter state to the canonical /audit query string. */
function toQs(f: AuditFilterState): string {
  const p = new URLSearchParams();
  if (f.user.trim()) p.set("user", f.user.trim());
  if (f.action_type) p.set("action_type", f.action_type);
  if (f.entity_type) p.set("entity_type", f.entity_type);
  if (f.date_from.trim()) p.set("date_from", f.date_from.trim());
  if (f.date_to.trim()) p.set("date_to", f.date_to.trim());
  return p.toString();
}

/**
 * Toolbar for the audit log: the live user-email search spanning the middle and
 * the Filters menu pinned far right. Filtering is LIVE — typing or changing any
 * filter navigates (debounced) and the server refetches; there is no Apply
 * button. State is mirrored into the URL so deep links and manual filtering
 * share one source of truth; a guarded re-seed keeps the inputs in sync when
 * navigation changes the params underneath us without clobbering keystrokes
 * typed since the last push. Mirrors the alumni / events toolbars.
 */
export function AuditToolbar({
  initial,
  actionTypes,
  entityTypes,
}: {
  initial: AuditFilterState;
  /** Distinct action-type options for the menu (from GET /audit/options). */
  actionTypes: string[];
  /** Distinct entity-type options for the menu (from GET /audit/options). */
  entityTypes: string[];
}) {
  const router = useRouter();
  const [f, setF] = useState<AuditFilterState>(initial);
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
        router.push(serialized ? `/audit?${serialized}` : "/audit");
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

  const set = <K extends keyof AuditFilterState>(
    key: K,
    value: AuditFilterState[K],
  ) => setF((prev) => ({ ...prev, [key]: value }));

  const activeCount =
    (f.action_type ? 1 : 0) +
    (f.entity_type ? 1 : 0) +
    (f.date_from.trim() || f.date_to.trim() ? 1 : 0);

  const isDirty = serialized !== "";

  const selectRow = (
    key: "action_type" | "entity_type",
    label: string,
    anyLabel: string,
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
        <option value="">{anyLabel}</option>
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
      <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 focus-within:border-brand-blue-600 focus-within:ring-1 focus-within:ring-brand-blue-600">
        <Search className="h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
        <input
          value={f.user}
          onChange={(e) => set("user", e.target.value)}
          placeholder="Filter by user email"
          aria-label="Filter by user email"
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
              {selectRow("action_type", "Action type", "Any action", actionTypes)}
              {selectRow("entity_type", "Entity type", "Any entity", entityTypes)}

              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Date range
                </p>
                {/* grid + min-w-0 so the date inputs (large intrinsic min
                    width) can't overflow the w-80 panel */}
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={f.date_from}
                    onChange={(e) => set("date_from", e.target.value)}
                    aria-label="From date"
                    className="w-full min-w-0 rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900 focus:outline-none"
                    style={{ colorScheme: "light" }}
                  />
                  <input
                    type="date"
                    value={f.date_to}
                    onChange={(e) => set("date_to", e.target.value)}
                    aria-label="To date"
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
