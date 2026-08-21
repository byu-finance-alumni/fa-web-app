import Link from "next/link";
import { apiGet, ApiError } from "@/lib/api";
import { getAuthContext } from "@/lib/auth-context";
import { MetricCard } from "@/components/shared/MetricCard";
import { SearchHero } from "@/components/dashboard/SearchHero";
// `DashboardHero` is no longer imported — the shell renders the masthead now.
// HERO_OVERLAP_CLASS still is, and is empty on this branch: the tiles cannot
// straddle the photo any more, because the photo lives above <main> and <main>
// clips at `lg` to stop the page scrolling. A negative margin here would slide
// the tiles under that clip and cut their tops off.
import { HERO_OVERLAP_CLASS } from "@/components/dashboard/DashboardHero";
import { DashboardSearch } from "@/components/dashboard/DashboardSearch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Fab } from "@/components/shared/Fab";
import { LoadError } from "@/components/shared/LoadError";
import { QuickLogButton } from "@/components/dashboard/QuickLogButton";
import {
  canAddInteraction,
  canCreateAlumni,
  canCreateEvents,
  canImportEvents,
  canWriteNotes,
} from "@/constants/capabilities";
import type { UserContext } from "@/types/alumni";
import type { FilterOptions } from "@/types/filters";
import { EMPTY_FILTER_OPTIONS } from "@/lib/emptyFilterOptions";
import { sortIndustryRows } from "@/lib/industryBreakdown";

/**
 * Hand-written shape for `/dashboard/summary` — keep it in sync with the API
 * (the redesigned launchpad reads everything it charts from here, including the
 * industry breakdown list).
 */
interface Summary {
  total_alumni: number;
  archived: number;
  deceased: number;
  missing_email: number;
  missing_employer: number;
  /**
   * How many DIFFERENT firms the active alumni currently work for. Names are
   * folded (lower + trim) and the Top-employers chart's non-employer
   * placeholders excluded before counting, so this number and that panel
   * describe one set of companies.
   *
   * Optional for the same reason as the edit counts below: the field only
   * exists on a backend carrying the 2026-08-20 change, and the tile falls back
   * to "—" rather than rendering `undefined` against an older API.
   */
  distinct_employers?: number;
  /** How many states those companies are in — the Companies tile's sub-line. */
  employer_states?: number;
  contacted_this_month: number;
  /**
   * #606: active alumni whose `updated_at` falls in the CURRENT CALENDAR month
   * (1st 00:00 UTC through now) — deliberately NOT the rolling 30-day window
   * `contacted_this_month` uses, so the two tiles legitimately disagree.
   * Optional here because the field only exists on a backend that has the #606
   * change deployed; the tile falls back to "—" until then.
   *
   * Counts alumni ROWS, not edits: the backend filters the `alumni` table on
   * `updated_at`, so ten changes to one person is inherently one (Amy, #645).
   */
  alumni_edited_this_month?: number;
  /**
   * #645: the same population and the same `updated_at` column as
   * `alumni_edited_this_month`, widened to the CURRENT CALENDAR YEAR to date
   * (Jan 1 00:00 UTC through now) — Amy's "running total for the entire year".
   * Calendar year-to-date is the decided call, NOT a trailing 12 months, so it
   * legitimately drops to near zero every January. Optional for the same reason
   * as the month field above: the tile shows "—" until a backend returning it
   * is deployed, so this file never has to wait on the API change.
   */
  alumni_edited_this_year?: number;
  upcoming_follow_ups: number;
  duplicate_count: number;
  upcoming_events: number;
  willing_mentors: number;
  events_this_month: number;
  guest_speakers_this_month: number;
  by_graduation_year: { year: number; count: number }[];
  top_employers: { employer: string; count: number }[];
  by_state: { state: string; count: number }[];
  /**
   * Industry breakdown (#351/#352/#353). `industries` covers EVERY canonical
   * finance industry — including zero-count ones — so the legend can list them
   * all. `other` (the catch-all "Other" value) and `unknown` (no industry on
   * file) are separate, distinct buckets. `graduate_student` (#294) is its own
   * bucket, split out of `other`, so it can be shown as its own bar.
   */
  industry_breakdown: {
    industries: { industry: string; count: number }[];
    other: number;
    unknown: number;
    graduate_student: number;
  };
}

/* ------------------------------------------------------------- date helpers -- */

/* -------------------------------------------------------------- presentation -- */

function Panel({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  /** Extra classes on the Card (e.g. `flex-1` to grow, else natural height). */
  className?: string;
}) {
  return (
    <Card className={`flex flex-col ${className ?? ""}`}>
      {/* Panel titles run at the 18–20px section-heading size from UX-UI.md's
          type scale — CardTitle's own 14px is sized for the dense in-page cards
          elsewhere, not for a top-level dashboard panel. */}
      <CardHeader className="px-6 pt-6">
        <CardTitle className="text-xl">{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col px-6 pb-6">
        {children}
      </CardContent>
    </Card>
  );
}

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
function IndustryBarList({
  rows,
  emptyLabel,
}: {
  rows: {
    label: string;
    count: number;
    href?: string;
  }[];
  emptyLabel: string;
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
  // can never be squeezed below `min-h-[20px]`; past that the panel scrolls (see
  // the caller's `overflow-y-auto`) rather than hiding rows again.
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
                aria-label={`View ${r.label} (${r.count}) in alumni list`}
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

/* --------------------------------------------------------------------- page -- */

export default async function DashboardPage() {
  let s: Summary | null = null;
  let ctx: UserContext | null = null;
  let notProvisioned = false;
  // A failed summary is NOT a dashboard of zeroes (#688). Every KPI on this page
  // falls back to an em dash and the industry breakdown to an empty list, so a
  // 5xx used to render as a real-looking dashboard for an institution with no
  // alumni. Only a 403 is an answer about the account; everything else is a
  // fault and gets said out loud.
  let error: ApiError | null = null;
  try {
    [s, ctx] = await Promise.all([
      apiGet<Summary>("/dashboard/summary", {
        revalidate: 60,
        tags: ["dashboard"],
      }),
      // Per-user, not cacheable — used only to greet the signed-in user by name.
      // Tolerated separately below so a context hiccup never blanks the page.
      // Deduped with the layout's own context read for this request (#254).
      getAuthContext().catch(() => null),
    ]);
  } catch (e) {
    if (e instanceof ApiError && e.status === 403) notProvisioned = true;
    else
      error =
        e instanceof ApiError
          ? e
          : new ApiError(0, "Failed to load the dashboard.");
  }

  // Search workspace data (alumni filter options for the Advanced tab). Fetched
  // tolerantly so a hiccup just leaves the facets empty rather than blanking the
  // dashboard.
  let filterOptions: FilterOptions | null = null;
  let industryVocab: string[] | null = null;
  if (!notProvisioned && !error) {
    [filterOptions, industryVocab] = await Promise.all([
      apiGet<FilterOptions>("/alumni/filter-options", {
        revalidate: 300,
        tags: ["alumni-filter-options"],
      }).catch(() => null),
      // Advanced-search Industry facet offers the admin-curated vocabulary
      // (Admin → Vocabulary), same as the alumni list filter — so a vocab edit
      // shows up here instead of only the industries already present in data.
      apiGet<{ category: string; values: string[] }>("/vocabulary/industry", {
        revalidate: 300,
        tags: ["vocabulary"],
      })
        .then((r) => r.values)
        .catch(() => null),
    ]);
    // Overlay the vocabulary onto the industry facet (mirrors AlumniRoster).
    if (
      filterOptions &&
      Array.isArray(industryVocab) &&
      industryVocab.length > 0
    ) {
      filterOptions = { ...filterOptions, industries: industryVocab };
    }
  }

  // "Welcome back, Marcus" — name from the auth context (or a first name derived
  // from the email), with a no-name fallback. A static greeting avoids the wrong
  // time-of-day (the server renders in UTC, not the viewer's local hour).
  // The greeting itself moved to the shell with the photo it sits on; this
  // helper stays because the file still documents the naming rule and a future
  // per-page masthead would want it.

  // Quick-add FAB (mobile) gating. Each shortcut asks for the capability its
  // destination actually needs (fa-web-api #379 replaced the one blanket
  // `alumni.full` check that used to stand in for all of them), read from the
  // effective capability list so an engineer's grant shows up here. Events keep
  // TWO separate entries: creating one event needs no attendee list (#611) and
  // is not the same grant as the bulk CSV upload.
  const dashCaps = ctx?.capabilities ?? null;
  const canLogInteraction = canAddInteraction(dashCaps);
  const canAddNote = canWriteNotes(dashCaps);
  const canCreateEvent = canCreateEvents(dashCaps);
  const canImportEvent = canImportEvents(dashCaps);
  const canCreate = canCreateAlumni(dashCaps);
  const showFab =
    canLogInteraction ||
    canAddNote ||
    canCreateEvent ||
    canImportEvent ||
    canCreate;

  // Industry breakdown (#351/#352/#353, listed per #375): the backend returns
  // EVERY canonical finance industry (incl. zero-count) plus separate "Other"
  // (catch-all value) and "Unknown" (no industry on file) buckets. The list
  // shows them all (zero-count ones muted). Every bar is the same brand blue —
  // see IndustryBarList. Each row is clickable — finance industries deep-link to
  // `?industry=<name>`, "Other" to `?industry_group=other`, and "Unknown" to
  // `?industry_group=unknown` so staff can open and fix the profiles that are
  // missing an industry.
  //
  // #397 ("Financial Services" as its own bar): this list is intentionally
  // backend-driven — it renders exactly the industries the API surfaces in
  // `industry_breakdown.industries` (the backend's WHEEL_INDUSTRIES set), each
  // as its own distinctly-coloured, deep-linked bar. So the moment a new
  // industry (e.g. "Financial Services") is present in that set it shows up here
  // automatically with no further frontend change. We deliberately do NOT
  // overlay the full `/vocabulary/industry` list onto this chart: that vocab
  // includes the non-wheel values (Law, Corporate Banking, FP&A, Sales and
  // Trading, Credit Risk) the backend purposely folds into "Other" (Tanya,
  // 2026-07-11), so overlaying would resurrect them as misleading zero bars and
  // double-count against "Other". Making "Financial Services" its own bar
  // therefore requires the human/backend change of adding it to the industry
  // vocabulary AND to INDUSTRIES + WHEEL_INDUSTRIES in fa-web-api — it is
  // genuinely absent today (it exists only as the "Financial Services
  // Conference" event type, never as an industry vocab value).
  const breakdown = s?.industry_breakdown;
  const industryRows: {
    label: string;
    count: number;
    href?: string;
  }[] = breakdown
    ? [
        ...breakdown.industries.map((i) => ({
          label: i.industry,
          count: i.count,
          href: `/alumni?industry=${encodeURIComponent(i.industry)}`,
        })),
        {
          label: "Other",
          count: breakdown.other,
          href: `/alumni?industry_group=other`,
        },
        // Unknown = alumni with no industry on file: a "needs fixing" bucket,
        // labelled in danger red so the data gap is impossible to miss wherever
        // its count lands it in the list. Always shown, even at 0.
        {
          label: "Unknown",
          count: breakdown.unknown,
          href: `/alumni?industry_group=unknown`,
        },
        // Graduate Student (#294): its own counted bar, split out of the "Other"
        // bucket by the backend. Ranked by its count like every other row, and
        // deep-links via the same `?industry=<name>` mechanism the finance bars
        // use.
        {
          label: "Graduate Student",
          count: breakdown.graduate_student,
          href: `/alumni?industry=${encodeURIComponent("Graduate Student")}`,
        },
      ]
    : [];

  /* ----------------------------------------------------------- KPI sub-lines --
     Every sub-line is DERIVED from a figure `/dashboard/summary` already
     returns — none of them is a stand-in for one it doesn't. When the number a
     line would describe is missing (an older backend omits the two edit counts)
     or would be meaningless (a share of an unknown/zero roster), the line is
     simply absent. A tile with no context beats a tile with invented context. */

  // "Across N industries" — the canonical finance industries that actually have
  // someone in them. Zero-count industries are still LISTED in the breakdown
  // panel below; they just aren't something the roster spans.
  const industriesWithAlumni = breakdown
    ? breakdown.industries.filter((i) => i.count > 0).length
    : null;
  const totalAlumni = s?.total_alumni ?? null;
  /** `n` as a whole-percent share of the active roster, or null when either side
   *  is missing — a share of an unknown total isn't a number we can show. */
  const shareOfRoster = (n: number | undefined) =>
    n === undefined || !totalAlumni ? null : Math.round((n / totalAlumni) * 100);
  const editedMonthShare = shareOfRoster(s?.alumni_edited_this_month);
  const editedYearShare = shareOfRoster(s?.alumni_edited_this_year);
  // Both edit counts are UTC calendar windows off `updated_at` (see Summary), so
  // the year the coverage line names is the UTC one, not the viewer's local one.

  return (
    <>
      {/* NO TOP BAR AT ALL (Jake, 2026-08-20). It first lost its title, because
          the hero band below is the page's identity and "Dashboard" in the bar
          said it twice; what was left was an empty 64px white strip above a
          full-bleed photo, which read as a rendering fault rather than as
          chrome. Sign out — the only thing the bar still carried — moved onto
          the band itself.

          This page only. Every other screen keeps its bar, because every other
          screen needs the title or breadcrumb it carries. */}
      {/* The page padding sits on the block below rather than on `main`, so the
          hero band can run edge to edge.

          ⚠️ FROM `lg` UP THIS PAGE DOES NOT SCROLL (Jake, 2026-08-20). It used
          to: the Industry panel was given its NATURAL height so every industry
          was on screen, which made the column taller than a laptop viewport and
          pushed the bottom of both panels under the fold. On a launchpad that is
          the wrong trade — the whole point is that everything is visible at a
          glance, and a dashboard you have to scroll is a page.

          So `main` becomes a bounded flex column and the bottom row takes
          whatever height is left. The industry rows are already built to absorb
          that: each is `flex-1` with a `min-h-[20px]` floor, so they share the
          remaining space, and the list scrolls INSIDE its own panel only if the
          floor is ever hit. That is the honest failure — a scrollbar in one
          panel — rather than rows silently under the fold.

          Below `lg` nothing changes: the KPI strip and the breakdown are not
          rendered at all, the fields simply flow, and the page scrolls the way a
          phone should. */}
      {/* ⚠️ `scrollbar-gutter:auto` at `lg` (experiment/top-nav). Global CSS puts
          `scrollbar-gutter: stable` on every <main> so a page that starts
          scrolling does not jump sideways. This page CANNOT scroll from `lg` up,
          so that gutter is ~15px reserved for a scrollbar that will never
          appear — and the nav bar is a SIBLING of <main>, so it spans the full
          width while everything under it stops short. That is the white strip
          down the right-hand side. */}
      <main className="flex-1 overflow-auto lg:flex lg:min-h-0 lg:flex-col lg:overflow-hidden lg:[scrollbar-gutter:auto]">
        {/* The masthead moved INTO the shell (experiment/top-nav): the nav bar
            and the greeting now share one photo, which is the only way the two
            are continuous at every window width. Nothing renders it here. */}
        {/* Top padding is on the BRANCHES, not here: the happy path zeroes it
            from `lg` up so the KPI strip's negative margin is measured straight
            off the band's bottom edge (see HERO_OVERLAP_CLASS), while the two
            fallback states — which have no KPI strip to overlap — keep it and
            clear the band normally. */}
        <div className="px-4 pb-4 md:px-6 md:pb-6 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
          {notProvisioned ? (
            <Card className="mt-4 p-4 text-sm text-gray-700 md:mt-6">
              Your account is authenticated but not yet provisioned. Ask a Super
              Admin to grant your account a role to see data.
            </Card>
          ) : error ? (
            <LoadError
              status={error.status}
              noun="the dashboard"
              className="mt-4 md:mt-6"
            />
          ) : (
            /* Top to bottom (Jake, 2026-08-19): the KPI strip straddling the
               hero band's bottom edge, THEN the search card, then the two
               working panels side by side. The page scrolls naturally rather
               than pinning itself to the viewport height — that's what keeps
               the Industry breakdown at its NATURAL height (see the panel
               below), which is the only shape it can't be clipped in. */
            <div className="flex flex-col gap-4 pt-4 md:pt-6 lg:min-h-0 lg:flex-1 lg:gap-4 lg:pt-0">
              {/* KPI strip, pulled up so the tiles sit half on the photo and
                  half off it — see HERO_OVERLAP_CLASS for the geometry and why
                  it's a margin. `relative` (no z-index needed — it is a later
                  sibling) puts the tiles and their shadows OVER the band; the
                  shadows are never clipped because this block lives outside the
                  band's `overflow-hidden`.

                  Desktop only: on a phone the dashboard is search-first, so the
                  KPIs and the Industry breakdown are dropped rather than
                  stacked into a long scroll — which also means there is no
                  overlap to reason about once the grid would collapse to one
                  column. */}
              <div
                /* FOUR tiles (Jake, 2026-08-20). `sm:grid-cols-2` before
                   `lg:grid-cols-4`: four across at tablet width squeezes a
                   6-figure value and its sub-line into ~180px and the numbers
                   wrap, where 2x2 keeps each tile the width it was designed at.
                   The strip only actually renders from `lg` (`hidden lg:grid`),
                   so the 2-up is what a narrow desktop window gets. */
                className={`relative hidden grid-cols-1 gap-4 sm:grid-cols-2 lg:grid lg:grid-cols-4 lg:gap-4 ${HERO_OVERLAP_CLASS}`}
              >
                <MetricCard
                  size="lg"
                  raised
                  label="Total alumni"
                  value={s?.total_alumni ?? "—"}
                  sub={
                    industriesWithAlumni === null
                      ? null
                      : `Across ${industriesWithAlumni} ${
                          industriesWithAlumni === 1
                            ? "industry"
                            : "industries"
                        }`
                  }
                  href="/alumni"
                  linkLabel="View all alumni"
                />
                {/* Jake, 2026-08-11: "Contacted this month" is gone and the two
                    edit counts are now tiles in their own right. They used to be
                    stacked inside ONE split card (#645) because a fourth tile
                    would have orphaned the three-across strip — dropping
                    Contacted frees that slot, so each figure gets a full card.

                    Both are CALENDAR windows off the alumni table's
                    `updated_at` — the month resets on the 1st, the year on Jan 1
                    (year-to-date, NOT a trailing 12 months, so it reads near
                    zero every January by design). They count alumni ROWS, not
                    edits: ten changes to one person is one. Both land on the
                    same most-recently-edited list, whose "Last updated" column
                    makes either count checkable. Each sub-line restates its own
                    count as a share of the roster, so the two windows can be
                    compared without doing the arithmetic.

                    ALL FOUR SUB-LINES ARE THE SAME MUTED GREY (Jake,
                    2026-08-20). The month's was success green, on the argument
                    that it read as this-month's progress. Sitting in a row of
                    four otherwise identical tiles it just read as one tile being
                    special, and the eye went to it before the numbers. Colour on
                    a KPI strip should mean something is wrong, and nothing here
                    is. Both windows now phrase their share the same way, so the
                    four lines scan as one row rather than four formats. */}
                <MetricCard
                  size="lg"
                  raised
                  label="Companies"
                  value={s?.distinct_employers ?? "—"}
                  /* Mirrors the industries line under Total alumni: a count is
                     hard to size on its own, and the second dimension is what
                     turns "42" into "42, spread over 12 states". Null rather
                     than a guess when the backend has not sent it — a tile that
                     invents a denominator is worse than one that shows only its
                     number. */
                  sub={
                    s?.employer_states == null
                      ? null
                      : `Across ${s.employer_states} ${
                          s.employer_states === 1 ? "state" : "states"
                        }`
                  }
                  /* Deep-links to the same population the number counts —
                     alumni WITH a current employer — rather than to the whole
                     list. A tile whose drill-down is wider than its own count is
                     the recurring parity bug on this page. */
                  href="/alumni?missing_employer=0"
                  linkLabel="View alumni who have a current employer on file"
                />
                <MetricCard
                  size="lg"
                  raised
                  label="Edited this month"
                  value={s?.alumni_edited_this_month ?? "—"}
                  sub={
                    editedMonthShare === null
                      ? null
                      : `${editedMonthShare}% of all records`
                  }
                  href="/alumni?sort=updated"
                  linkLabel="View alumni edited this month, sorted by most recently edited"
                />
                <MetricCard
                  size="lg"
                  raised
                  label="Edited this year"
                  value={s?.alumni_edited_this_year ?? "—"}
                  sub={
                    editedYearShare === null
                      ? null
                      : `${editedYearShare}% of all records`
                  }
                  href="/alumni?sort=updated"
                  linkLabel="View alumni edited this year, sorted by most recently edited"
                />
              </div>

              {/* The big search field sits UNDER the KPI tiles (Jake,
                  2026-08-19), not above them — the band and the tiles are the
                  masthead, and this is the first thing you act on below it. */}
              <SearchHero />

              {/* The two working panels, on a 12-column grid split 5:7 — the
                  search card is a column of paired fields and needs less width
                  than the breakdown's name-bar-count rows, which spend theirs
                  on bar length. The grid's default `items-stretch` is what pins
                  the search card's action bar to the same line in BOTH tabs
                  (#594): the row's height is set by the Industry panel's
                  natural height, and the search card fills it. */}
              {/* The row that absorbs the leftover height — `min-h-0` so it
                  may shrink below its content, which is what lets the panels
                  inside it scroll instead of the page. */}
              <div className="grid grid-cols-1 gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-12 lg:gap-5 lg:overflow-hidden">
                <DashboardSearch
                  options={filterOptions ?? EMPTY_FILTER_OPTIONS}
                  className="lg:col-span-5"
                />
                {/* Industry breakdown STRETCHES to the row (Jake, 2026-08-20),
                    where it used to sit at its natural height. Natural height is
                    what pushed the page past the fold; `self-stretch` hands it
                    exactly the space that is left and the rows share it. */}
                <Panel
                  title="Industry breakdown"
                  action={
                    <span className="text-sm font-medium text-brand-blue-600">
                      Click to filter
                    </span>
                  }
                  className="hidden lg:col-span-7 lg:flex lg:min-h-0 lg:self-stretch"
                >
                  {/* ⚠️ NO SCROLLBAR HERE, BY INSTRUCTION (Jake, 2026-08-20),
                      reversing the earlier call on this exact line.

                      It used to be `overflow-y-auto` on the reasoning that if
                      the list ever outgrew its box, an honest scrollbar beat
                      rows silently vanishing. True in general — but on this
                      panel the rows are ELASTIC, so a scrollbar was appearing
                      while every industry was still on screen, which reads as
                      broken rather than honest. The rows now shrink further
                      (see the floor on each `li`) and the list is sized to fit.

                      THE TRADE, STATED: at a viewport short enough that even the
                      compressed rows do not fit, the tail is clipped with
                      nothing on screen saying so. The floor is set low enough
                      that this needs a window far shorter than a laptop — but it
                      is the failure mode, and it is the one the old comment was
                      guarding against. */}
                  <div className="flex w-full flex-col lg:min-h-0 lg:flex-1 lg:overflow-hidden">
                    <IndustryBarList
                      rows={industryRows}
                      emptyLabel="No industry data yet."
                    />
                  </div>
                </Panel>
              </div>
            </div>
          )}
        </div>

        {/* Home quick-add FAB (mobile). Log interaction / Add note open an
            alumnus search first, then land on that profile's form. */}
        {!notProvisioned && !error && showFab ? (
          <Fab label="Quick add">
            {canLogInteraction ? (
              <QuickLogButton kind="interaction" label="Log interaction" />
            ) : null}
            {canAddNote ? (
              <QuickLogButton kind="note" label="Add note" />
            ) : null}
            {/* The plain create form — an event needs no attendee list to exist
                (#611). Bulk CSV import is its own entry below, never the thing
                labelled "Add event". */}
            {canCreateEvent ? (
              <Button asChild variant="secondary">
                <Link href="/events/new">Add event</Link>
              </Button>
            ) : null}
            {canImportEvent ? (
              <Button asChild variant="secondary">
                <Link href="/events/import">Import events from CSV</Link>
              </Button>
            ) : null}
            {canCreate ? (
              <Button asChild variant="secondary">
                <Link href="/alumni/new">Add alumni</Link>
              </Button>
            ) : null}
            {canCreate ? (
              <Button asChild variant="secondary">
                <Link href="/alumni/new?kind=friend">Add friend</Link>
              </Button>
            ) : null}
          </Fab>
        ) : null}
      </main>
    </>
  );
}
