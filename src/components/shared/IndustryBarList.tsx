import Link from "next/link";
import { sortIndustryRows } from "@/lib/industryBreakdown";

/*
 * Shared by the dashboard's Industry breakdown and the Alumni Mentors page
 * (Outreach), so the two bar lists look and order identically. A Server
 * Component: no hooks, safe to import from either.
 */

/** Industry breakdown as a vertical list of per-industry coloured bars, ONE ROW
 *  PER INDUSTRY — name, bar and count on a single line (#375 replaced the old
 *  donut wheel so long industry names are legible; the name moved from above the
 *  bar to beside it on 2026-08-11 so the full list fits a laptop — see the
 *  layout note in the body). Rows run BIGGEST FIRST, descending by count, ties
 *  broken on the label A→Z — including the "Other", "Unknown" and "Graduate
 *  Student" buckets, which are no longer pinned to the end: the panel answers
 *  "who do we have the most of", and a bucket that outranks a real industry
 *  should say so. Zero-count industries land at the bottom by that same rule
 *  and are never filtered out (#397).
 *
 *  Every bar is the SAME brand blue on the same grey track (2026-08-19 mockup):
 *  the length is the datum, and one colour per industry was decoration that
 *  invited the reader to look for meaning in a hue that carried none. The
 *  semantic tones that DO mean something stay on the text — the "Unknown"
 *  data-gap row in danger red, zero-count rows muted grey. Each row links to
 *  the filtered alumni list. */
export function IndustryBarList({
  rows,
  emptyLabel,
  linkLabel = (r) => `View ${r.label} (${r.count}) in alumni list`,
}: {
  rows: {
    label: string;
    count: number;
    href?: string;
  }[];
  emptyLabel: string;
  /** The accessible name of a row's link. Defaults to the dashboard's. */
  linkLabel?: (row: { label: string; count: number }) => string;
}) {
  if (rows.length === 0)
    return <p className="py-4 text-sm text-gray-400">{emptyLabel}</p>;

  // Biggest first, always — see `sortIndustryRows`. The order is decided HERE
  // and not taken from the API response, so it holds whatever order the backend
  // happens to send. Zero-count industries fall to the bottom by the same rule
  // rather than being filtered out.
  const ordered = sortIndustryRows(rows);
  // Bars are proportional to the largest count in the list, read off the data —
  // so re-ordering can never desynchronise the fills from the numbers.
  const max = Math.max(1, ...ordered.map((r) => r.count));

  // ONE ROW PER INDUSTRY, single column (Jake, 2026-08-11): name, bar and count
  // share a single horizontal line rather than the name sitting stacked ABOVE
  // its bar. That is what makes the whole list fit.
  //
  // The stacked form cost ~30px a row and grew its bar vertically to fill the
  // leftover height, so 18 industries needed ~540px — more than the ~380px a
  // laptop leaves under the KPI strip. The rows past the fold were then silently
  // CLIPPED by the panel's `overflow-hidden`, with no scrollbar to hint at it,
  // so "Graduate Student" was simply invisible. It only ever fit on a tall
  // desktop monitor. A one-line row is ~20px and its bar is a fixed-height
  // horizontal track, so 18 rows come in around 360px and the list fits.
  //
  // Rows still stretch to fill the panel when there IS spare height (flex-1) but
  // are never squeezed below their natural height; on a window too short for
  // that, the dashboard's <main> scrolls (see the note there) rather than
  // hiding rows again.
  //
  // The label column is a fixed width so every bar starts at the same x — the
  // bars are only comparable to each other if they share a baseline. Long names
  // truncate there (the full text stays in the `title` and the aria-label).
  return (
    // ⚠️ `lg:h-full` AND NOT `lg:min-h-full`, which was tried and is worse. At
    // exactly the scroll box's height the rows COMPRESS to fit — each is
    // `flex-1` with a 20px floor — so the panel shows a scrollbar only once
    // there is genuinely no room left, rather than the moment the natural
    // heights sum past the box. `min-h-full` lets the list grow instead of
    // shrink, which puts a scrollbar on a panel whose rows are all visible.
    // `gap-0` at lg: sixteen 2px gaps is 32px of the very height the list is
    // short of, and the rows already read as separate lines without it.
    <ul className="flex flex-col gap-0.5 lg:h-full lg:gap-0">
      {ordered.map((r) => {
        const muted = r.count === 0;
        // "Unknown" is a data-gap bucket: always drawn in danger red (label +
        // count), even at 0, so it never blends into the muted zero rows.
        const isUnknown = r.label === "Unknown";
        const toneClass = isUnknown
          ? "text-danger-600"
          : muted
            ? "text-gray-400"
            : "text-gray-700";
        const countToneClass = isUnknown
          ? "text-danger-600"
          : muted
            ? "text-gray-400"
            : "text-gray-900";
        const body = (
          <>
            <span
              className={`w-40 shrink-0 truncate text-xs font-medium ${toneClass}`}
            >
              {r.label}
            </span>
            {/* Fixed-height horizontal track — it no longer grows with the row,
                which is exactly what frees the vertical space. A zero-count row
                draws no fill but keeps its muted label + 0. Only the WIDTH is
                inline (it's a per-row percentage); the track and fill colours
                are tokens. */}
            <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-gray-100">
              <span
                className="block h-full rounded-full bg-brand-blue-600"
                style={{ width: `${Math.round((r.count / max) * 100)}%` }}
              />
            </span>
            <span
              className={`w-10 shrink-0 text-right text-xs font-semibold tabular-nums ${countToneClass}`}
            >
              {r.count}
            </span>
          </>
        );
        // Floor drops 20px -> 14px at `lg` (2026-08-20). 20px was the row's
        // NATURAL height — 12px text on a 16px line plus 2px of padding either
        // side — so it was not a floor at all, it was the point the list
        // stopped shrinking and started overflowing. 14px with the vertical
        // padding removed lets the rows genuinely compress before anything can
        // clip.
        return (
          <li key={r.label} className="flex flex-col lg:min-h-[14px] lg:flex-1">
            {r.href ? (
              <Link
                href={r.href}
                aria-label={linkLabel(r)}
                title={`${r.label}: ${r.count}`}
                className="flex items-center gap-3 rounded-lg px-1.5 py-0.5 transition hover:bg-brand-blue-50/40 lg:h-full lg:py-0"
              >
                {body}
              </Link>
            ) : (
              <div
                className="flex items-center gap-3 px-1.5 py-0.5 lg:h-full lg:py-0"
                title={`${r.label}: ${r.count}`}
              >
                {body}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
