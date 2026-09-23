"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { clientGet } from "@/lib/api-client";
import {
  RESPONDER_KIND_LABEL,
  respondersDriftNote,
  respondersFor,
  respondersRequestPath,
  type ResponderKind,
  type SurveyResponders,
} from "./responders";

/**
 * The names behind a Progress-table count (#836).
 *
 * Hover — or keyboard-focus — a year's "Replied" or "Looks good" number and a
 * small panel lists who it is. The names are fetched on first open, once per
 * year, and kept: both of a year's cells share the one request, because the
 * endpoint returns both lists together.
 */

export type ResponderEntry =
  | { state: "loading" }
  | { state: "error" }
  | { state: "ready"; data: SurveyResponders };

export type RespondersCache = {
  get: (year: number) => ResponderEntry | undefined;
  /** Fetch the year's names unless they are loaded or loading. A failed load
   *  is retried on the next open rather than cached as a permanent error. */
  load: (year: number) => void;
};

/** One cache for the whole table, so each year is fetched at most once. */
export function useRespondersCache(): RespondersCache {
  const [entries, setEntries] = useState<Record<number, ResponderEntry>>({});
  // State updates land a render late, so two cells opened in quick succession
  // would both see "nothing yet" and fire two requests. The ref is the
  // synchronous guard; `entries` is what renders.
  const started = useRef(new Set<number>());

  const load = useCallback((year: number) => {
    if (started.current.has(year)) return;
    started.current.add(year);
    setEntries((prev) => ({ ...prev, [year]: { state: "loading" } }));
    clientGet<SurveyResponders>(respondersRequestPath(year))
      .then((data) =>
        setEntries((prev) => ({ ...prev, [year]: { state: "ready", data } })),
      )
      .catch(() => {
        started.current.delete(year);
        setEntries((prev) => ({ ...prev, [year]: { state: "error" } }));
      });
  }, []);

  const get = useCallback((year: number) => entries[year], [entries]);

  return { get, load };
}

// Width of the panel in px (`w-64`), and the gap between it and the number.
const PANEL_WIDTH = 256;
const PANEL_GAP = 4;
// Below this much room under the number, the panel opens upwards instead.
const PANEL_ROOM = 280;
// Grace period for the pointer to cross the gap between number and panel.
const CLOSE_DELAY_MS = 120;

type PanelPosition = { left: number; top?: number; bottom?: number };

/**
 * Where the panel goes, in viewport pixels. It is portalled and `fixed`
 * because the table sits in an `overflow-x-auto` wrapper, which clips an
 * absolutely-positioned child in BOTH directions — a panel under the last row
 * would be cut off or scroll the table.
 */
function panelPosition(rect: DOMRect): PanelPosition {
  // Right edge under the number's right edge (the cells are right-aligned),
  // kept inside the viewport.
  const left = Math.max(
    8,
    Math.min(rect.right - PANEL_WIDTH, window.innerWidth - PANEL_WIDTH - 8),
  );
  return window.innerHeight - rect.bottom < PANEL_ROOM
    ? { left, bottom: window.innerHeight - rect.top + PANEL_GAP }
    : { left, top: rect.bottom + PANEL_GAP };
}

export function ResponderCount({
  year,
  kind,
  count,
  cache,
}: {
  year: number;
  kind: ResponderKind;
  count: number;
  cache: RespondersCache;
}) {
  const [position, setPosition] = useState<PanelPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelId = useId();
  const open = position !== null;

  const cancelClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }, []);

  const show = useCallback(() => {
    cancelClose();
    const el = triggerRef.current;
    if (!el) return;
    setPosition(panelPosition(el.getBoundingClientRect()));
    cache.load(year);
  }, [cache, cancelClose, year]);

  const hide = useCallback(() => {
    cancelClose();
    setPosition(null);
  }, [cancelClose]);

  const hideSoon = useCallback(() => {
    cancelClose();
    closeTimer.current = setTimeout(() => setPosition(null), CLOSE_DELAY_MS);
  }, [cancelClose]);

  // A `fixed` panel does not follow its number when the page scrolls, so it
  // closes instead. Capture phase, because the app scrolls `<main>`, not the
  // window, and a scroll event does not bubble. Scrolling the panel's OWN list
  // is not a page scroll and must not close it.
  useEffect(() => {
    if (!open) return;
    const onScroll = (e: Event) => {
      if (e.target instanceof Node && panelRef.current?.contains(e.target)) {
        return;
      }
      hide();
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", hide);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", hide);
    };
  }, [open, hide]);

  useEffect(() => cancelClose, [cancelClose]);

  // Nobody to name: the plain number, with nothing to hover or tab to.
  if (count <= 0) return <>{count.toLocaleString()}</>;

  const entry = cache.get(year);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="tabular-nums underline decoration-gray-300 decoration-dotted underline-offset-4 hover:text-navy-800 hover:decoration-navy-800 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500"
        aria-label={`${count.toLocaleString()} ${RESPONDER_KIND_LABEL[kind]} in ${year}, show names`}
        aria-describedby={open ? panelId : undefined}
        onMouseEnter={show}
        onMouseLeave={hideSoon}
        onFocus={show}
        onBlur={hide}
        onKeyDown={(e) => {
          if (e.key === "Escape") hide();
        }}
      >
        {count.toLocaleString()}
      </button>
      {open
        ? createPortal(
            <div
              ref={panelRef}
              id={panelId}
              role="tooltip"
              style={{ ...position, width: PANEL_WIDTH }}
              className="fixed z-50 rounded-lg border border-gray-200 bg-white p-3 text-left shadow-md"
              onMouseEnter={cancelClose}
              onMouseLeave={hideSoon}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                {RESPONDER_KIND_LABEL[kind]}, class of {year}
              </p>
              <ResponderPanelBody entry={entry} kind={kind} count={count} />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function ResponderPanelBody({
  entry,
  kind,
  count,
}: {
  entry: ResponderEntry | undefined;
  kind: ResponderKind;
  count: number;
}) {
  if (!entry || entry.state === "loading") {
    return <p className="mt-2 text-sm text-gray-500">Loading names…</p>;
  }
  if (entry.state === "error") {
    return (
      <p className="mt-2 text-sm text-danger-600">
        Couldn&rsquo;t load the names. Move away and back to try again.
      </p>
    );
  }
  const people = respondersFor(entry.data, kind);
  const drift = respondersDriftNote(people.length, count);
  return (
    <>
      {people.length > 0 ? (
        // Capped so a large cohort scrolls inside the panel rather than
        // running off the screen.
        <ul className="mt-2 max-h-60 space-y-1 overflow-y-auto text-sm text-gray-700">
          {people.map((p) => (
            <li key={p.alumni_id}>{p.name}</li>
          ))}
        </ul>
      ) : null}
      {drift ? <p className="mt-2 text-xs text-gray-500">{drift}</p> : null}
    </>
  );
}
