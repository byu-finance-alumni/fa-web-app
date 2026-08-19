import Link from "next/link";
import { apiGet, ApiError } from "@/lib/api";
import { getAuthContext } from "@/lib/auth-context";
import { Topbar } from "@/components/shell/Topbar";
import { MetricCard } from "@/components/shared/MetricCard";
import { SearchHero } from "@/components/dashboard/SearchHero";
import {
  DashboardHero,
  HERO_OVERLAP_CLASS,
} from "@/components/dashboard/DashboardHero";
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

/** A clean first name from the auth context, or null if there's nothing usable.
 *  Falls back to the local-part of the email (title-cased) when no name field is
 *  set — never a fabricated name. */
function resolveFirstName(ctx: UserContext | null): string | null {
  const name = ctx?.first_name?.trim();
  if (name) return name;
  const local = ctx?.email?.split("@")[0]?.trim();
  if (!local) return null;
  // "marcus.young" / "marcus_young" -> "Marcus"
  const first = local.split(/[._-]/)[0];
  if (!first || /\d/.test(first)) return null;
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

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
    <ul className="flex flex-col gap-0.5 lg:h-full">
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
        return (
          <li key={r.label} className="flex flex-col lg:min-h-[20px] lg:flex-1">
            {r.href ? (
              <Link
                href={r.href}
                aria-label={`View ${r.label} (${r.count}) in alumni list`}
                title={`${r.label}: ${r.count}`}
                className="flex items-center gap-3 rounded-lg px-1.5 py-0.5 transition hover:bg-brand-blue-50/40 lg:h-full"
              >
                {body}
              </Link>
            ) : (
              <div
                className="flex items-center gap-3 px-1.5 py-0.5 lg:h-full"
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
  const firstName = resolveFirstName(ctx);
  const greeting = firstName ? `Welcome back, ${firstName}` : "Welcome back";

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
  const currentYear = new Date().getUTCFullYear();

  return (
    <>
      {/* No title (Jake, 2026-08-19): the hero band below IS the page's
          identity, so "Dashboard" in the bar was saying it twice. The bar itself
          stays — it still carries Sign out — and every other screen keeps its
          own title or breadcrumb. */}
      <Topbar />
      {/* The page padding sits on the block below rather than on `main`, so the
          hero band can run edge to edge under the top bar. */}
      <main className="flex-1 overflow-auto">
        <DashboardHero greeting={greeting} />
        {/* Top padding is on the BRANCHES, not here: the happy path zeroes it
            from `lg` up so the KPI strip's negative margin is measured straight
            off the band's bottom edge (see HERO_OVERLAP_CLASS), while the two
            fallback states — which have no KPI strip to overlap — keep it and
            clear the band normally. */}
        <div className="px-4 pb-4 md:px-6 md:pb-6">
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
            <div className="flex flex-col gap-4 pt-4 md:pt-6 lg:gap-5 lg:pt-0">
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
                className={`relative hidden grid-cols-1 gap-4 sm:grid-cols-3 lg:grid lg:gap-5 ${HERO_OVERLAP_CLASS}`}
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

                    The MONTH's share is the one set in the design system's
                    success green (`subTone`): it's the figure that reads as
                    this-month's progress. The year's stays muted — it's a
                    running total, not a target being met. */}
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
                  subTone="success"
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
                      : `${editedYearShare}% coverage in ${currentYear}`
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
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
                <DashboardSearch
                  options={filterOptions ?? EMPTY_FILTER_OPTIONS}
                  className="lg:col-span-5"
                />
                {/* Industry breakdown at its NATURAL height (#354/#375) — the
                    panel is no longer squeezed into whatever is left of the
                    viewport, so every industry is on screen and the list has no
                    reason to scroll at all. Desktop only, like the KPI strip. */}
                <Panel
                  title="Industry breakdown"
                  action={
                    <span className="text-sm font-medium text-brand-blue-600">
                      Click to filter
                    </span>
                  }
                  className="hidden lg:col-span-7 lg:flex lg:self-start"
                >
                  {/* `overflow-y-auto`, NOT `overflow-hidden`: nothing bounds
                      this list today, but if something ever does, the honest
                      failure is a scrollbar — not rows that vanish with nothing
                      on screen saying so. */}
                  <div className="flex w-full flex-col lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
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
