"use client";

import { useCallback, useRef, useState } from "react";

import { clientGet } from "@/lib/api-client";
import { HoverPopover } from "./HoverPopover";
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
 * endpoint returns both lists together — and so does the "Median time to
 * complete" hover (`MedianFillTimeCount`), which reads the same payload.
 *
 * The panel itself — its positioning and open/close behaviour — is
 * `HoverPopover`, shared with the median hover so every hover in the table
 * behaves the same.
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
  const onOpen = useCallback(() => cache.load(year), [cache, year]);

  // Nobody to name: the plain number, with nothing to hover or tab to.
  if (count <= 0) return <>{count.toLocaleString()}</>;

  return (
    <HoverPopover
      label={count.toLocaleString()}
      ariaLabel={`${count.toLocaleString()} ${RESPONDER_KIND_LABEL[kind]} in ${year}, show names`}
      title={`${RESPONDER_KIND_LABEL[kind]}, class of ${year}`}
      onOpen={onOpen}
    >
      <ResponderPanelBody entry={cache.get(year)} kind={kind} count={count} />
    </HoverPopover>
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
