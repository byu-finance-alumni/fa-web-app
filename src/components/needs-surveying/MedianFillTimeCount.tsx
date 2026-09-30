"use client";

import { useCallback } from "react";

import { HoverPopover } from "./HoverPopover";
import type { RespondersCache, ResponderEntry } from "./ResponderCount";
import { formatFillTime } from "./campaign-progress";
import { fillTimeResponders } from "./responders";

/**
 * The individual fill times behind a year's "Median time to complete" (#543
 * follow-on).
 *
 * The cell keeps showing the plain median (a dash until a reply carries a
 * usable measurement). Hovering — or focusing — it lists each replier who has a
 * recorded time as "Name — 3m 20s", longest first, so the outliers that pull
 * the median up are the ones you see. It shares the SAME per-year fetch and
 * cache as the "Replied" / "Looks good" name hovers (`ResponderCount`): the
 * responders endpoint returns the times alongside the names, so opening this
 * adds no request the name hovers have not already made.
 *
 * The hover is offered whenever the year has repliers. Until fresh timed
 * submissions arrive the list is empty — a confirmation carries no timer and
 * older replies predate the column — so that is a clean "No recorded times yet"
 * rather than an error, and matches the median reading a dash beside it.
 */
export function MedianFillTimeCount({
  year,
  medianSeconds,
  replied,
  cache,
}: {
  year: number;
  medianSeconds: number | null;
  /** The year's "Replied" count: no repliers, no times, so no hover. */
  replied: number;
  cache: RespondersCache;
}) {
  const onOpen = useCallback(() => cache.load(year), [cache, year]);
  const value = formatFillTime(medianSeconds);

  // Nobody has replied, so there is nothing to break down: the plain median
  // (a dash), with nothing to hover or tab to.
  if (replied <= 0) return <>{value}</>;

  return (
    <HoverPopover
      label={value}
      ariaLabel={`Median time to complete in ${year}, ${value}, show individual times`}
      title={`Time to complete, class of ${year}`}
      onOpen={onOpen}
    >
      <MedianFillTimePanelBody entry={cache.get(year)} />
    </HoverPopover>
  );
}

function MedianFillTimePanelBody({
  entry,
}: {
  entry: ResponderEntry | undefined;
}) {
  if (!entry || entry.state === "loading") {
    return <p className="mt-2 text-sm text-gray-500">Loading times…</p>;
  }
  if (entry.state === "error") {
    return (
      <p className="mt-2 text-sm text-danger-600">
        Couldn&rsquo;t load the times. Move away and back to try again.
      </p>
    );
  }
  const people = fillTimeResponders(entry.data);
  if (people.length === 0) {
    return <p className="mt-2 text-sm text-gray-500">No recorded times yet.</p>;
  }
  return (
    // Capped so a large cohort scrolls inside the panel rather than running off
    // the screen, exactly as the name list does.
    <ul className="mt-2 max-h-60 space-y-1 overflow-y-auto text-sm text-gray-700">
      {people.map((p) => (
        <li key={p.alumni_id}>{`${p.name} — ${formatFillTime(p.fillSeconds)}`}</li>
      ))}
    </ul>
  );
}
