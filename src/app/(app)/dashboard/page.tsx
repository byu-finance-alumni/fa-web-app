import Link from "next/link";
import { apiGet, ApiError } from "@/lib/api";
import { getAuthContext } from "@/lib/auth-context";
import { Topbar } from "@/components/shell/Topbar";
import { MetricCard } from "@/components/shared/MetricCard";
import { SearchHero } from "@/components/dashboard/SearchHero";
import { DashboardSearch } from "@/components/dashboard/DashboardSearch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Fab } from "@/components/shared/Fab";
import { QuickLogButton } from "@/components/dashboard/QuickLogButton";
import {
  canAddInteraction,
  canCreateAlumni,
  canCreateEvents,
  canImportEvents,
  canWriteNotes,
} from "@/constants/capabilities";
import { DATA_VIZ_PALETTE, CHART_MUTED_COLOR } from "@/constants/chart";
import type { UserContext } from "@/types/alumni";
import type { FilterOptions } from "@/types/filters";
import { EMPTY_FILTER_OPTIONS } from "@/lib/emptyFilterOptions";

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

/**
 * Danger red for the "Unknown" (no industry on file) bucket, so it reads as a
 * gap in the data to fix — distinct from the grey "Other" catch-all and from the
 * brand-blue data-viz accents. Signals "needs attention", not a real category.
 */
const CHART_UNKNOWN_COLOR = "#B42318"; // danger-600
// Graduate Student (#294): its own counted bar, split out of "Other" by the
// backend. A teal accent so it reads as a distinct (non-finance) category,
// separate from the gray "Other" and red "Unknown".
const CHART_GRAD_STUDENT_COLOR = "#0E7490"; // teal accent

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
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col">
        {children}
      </CardContent>
    </Card>
  );
}

/** Industry breakdown as a vertical list of per-industry coloured bars, ONE ROW
 *  PER INDUSTRY — name, bar and count on a single line (#375 replaced the old
 *  donut wheel so long industry names are legible; the name moved from above the
 *  bar to beside it on 2026-08-11 so the full list fits a laptop — see the
 *  layout note in the body). Real finance industries are listed alphabetically
 *  (A→Z); the "Other" and "Unknown" catch-all buckets always sort LAST since
 *  they aren't part of the A→Z category list. Each row carries its own `color`
 *  (resolved by the caller from the UX-UI.md data-viz palette) so every bar is a
 *  different colour — deliberately distinct from the single-blue Top Employers
 *  bars beneath it. Zero-count industries are still listed, shown muted (grey);
 *  each row links to the filtered alumni list. */
function IndustryBarList({
  rows,
  emptyLabel,
}: {
  rows: {
    label: string;
    count: number;
    color: string;
    href?: string;
  }[];
  emptyLabel: string;
}) {
  if (rows.length === 0)
    return <p className="py-4 text-sm text-gray-400">{emptyLabel}</p>;

  // Real finance industries sort alphabetically; the three special buckets are
  // pinned to the end in a fixed order — the "Other" catch-all, then the
  // "Unknown" data-gap bucket, then "Graduate Student" last. (Named exactly by
  // the caller, so no real category collides with them.)
  const PINNED = ["Other", "Unknown", "Graduate Student"];
  const ordered = [
    ...rows
      .filter((r) => !PINNED.includes(r.label))
      .sort((a, b) => a.label.localeCompare(b.label)),
    ...PINNED.map((label) => rows.find((r) => r.label === label)).filter(
      (r): r is (typeof rows)[number] => Boolean(r),
    ),
  ];
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
                draws no fill but keeps its muted label + 0. */}
            <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-gray-100">
              <span
                className="block h-full rounded-full"
                style={{
                  width: `${Math.round((r.count / max) * 100)}%`,
                  backgroundColor: r.color,
                }}
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
  }

  // Search workspace data (alumni filter options for the Advanced tab). Fetched
  // tolerantly so a hiccup just leaves the facets empty rather than blanking the
  // dashboard.
  let filterOptions: FilterOptions | null = null;
  let industryVocab: string[] | null = null;
  if (!notProvisioned) {
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

  // "Welcome, Marcus" — name from the auth context (or a first name derived from
  // the email), with a no-name fallback. A static greeting avoids the wrong
  // time-of-day (the server renders in UTC, not the viewer's local hour).
  const firstName = resolveFirstName(ctx);
  const greeting = firstName ? `Welcome, ${firstName}` : "Welcome";

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
  // shows them all (zero-count ones muted). Colors are stable per row: finance
  // industries cycle the data-viz palette, "Other" is muted grey, and "Unknown"
  // gets its own amber tone so it reads as distinct from "Other". Each row is
  // clickable — finance industries deep-link to `?industry=<name>`, "Other" to
  // `?industry_group=other`, and "Unknown" to `?industry_group=unknown` so staff
  // can open and fix the profiles that are missing an industry.
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
  let financeIdx = 0;
  const industryRows: {
    label: string;
    count: number;
    color: string;
    href?: string;
  }[] = breakdown
    ? [
        ...breakdown.industries.map((i) => ({
          label: i.industry,
          count: i.count,
          color: DATA_VIZ_PALETTE[financeIdx++ % DATA_VIZ_PALETTE.length],
          href: `/alumni?industry=${encodeURIComponent(i.industry)}`,
        })),
        {
          label: "Other",
          count: breakdown.other,
          color: CHART_MUTED_COLOR,
          href: `/alumni?industry_group=other`,
        },
        // Unknown = alumni with no industry on file: a "needs fixing" bucket,
        // pinned LAST (below "Other") and drawn in danger red so the data gap is
        // impossible to miss. Always shown, even at 0.
        {
          label: "Unknown",
          count: breakdown.unknown,
          color: CHART_UNKNOWN_COLOR,
          href: `/alumni?industry_group=unknown`,
        },
        // Graduate Student (#294): its own counted bar, split out of the "Other"
        // bucket by the backend. Pinned just above Other/Unknown by
        // IndustryBarList and deep-links via the same `?industry=<name>`
        // mechanism the finance bars use.
        {
          label: "Graduate Student",
          count: breakdown.graduate_student,
          color: CHART_GRAD_STUDENT_COLOR,
          href: `/alumni?industry=${encodeURIComponent("Graduate Student")}`,
        },
      ]
    : [];

  
  return (
    <>
      <Topbar title="Dashboard" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        {notProvisioned ? (
          <Card className="p-4 text-sm text-gray-700">
            Your account is authenticated but not yet provisioned. Ask a Super
            Admin to grant your account a role to see data.
          </Card>
        ) : (
          /* Desktop: two columns that stretch to fill the viewport (quick-search
             on the left, KPIs + chart on the right). Mobile/tablet: a natural,
             scrollable single-column stack — the fill-height behavior is gated
             to lg so the columns never stretch or collapse on a phone. */
          <div className="flex flex-col gap-4 lg:h-full lg:flex-row lg:items-stretch lg:gap-5">
            {/* LEFT — natural-language search bar, then the tabbed search
                workspace (quick / advanced) below it */}
            <div className="flex flex-col gap-4 lg:min-h-0 lg:flex-1 lg:gap-5">
              <SearchHero greeting={greeting} />
              <DashboardSearch options={filterOptions ?? EMPTY_FILTER_OPTIONS} />
            </div>

            {/* RIGHT — KPI strip + the chart. Desktop only: on a phone the
                dashboard is search-first, so the KPIs and Industry breakdown are
                dropped and this whole column is hidden below lg. */}
            <div className="hidden flex-col gap-4 lg:flex lg:min-h-0 lg:flex-1 lg:gap-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <MetricCard
                  size="lg"
                  label="Total alumni"
                  value={s?.total_alumni ?? "—"}
                  href="/alumni"
                  linkLabel="View all alumni"
                />
                {/* Jake, 2026-08-11: "Contacted this month" is gone and the two
                    edit counts are now tiles in their own right. They used to be
                    stacked inside ONE split card (#645) because a fourth tile
                    would have orphaned the three-across strip — dropping
                    Contacted frees that slot, so each figure gets a full card.
                    That also makes the strip shorter, which gives the Industry
                    panel below it back the height it was starved of.

                    Both are CALENDAR windows off the alumni table's
                    `updated_at` — the month resets on the 1st, the year on Jan 1
                    (year-to-date, NOT a trailing 12 months, so it reads near
                    zero every January by design). They count alumni ROWS, not
                    edits: ten changes to one person is one. Both land on the
                    same most-recently-edited list, whose "Last updated" column
                    makes either count checkable. */}
                <MetricCard
                  size="lg"
                  label="Alumni edited this month"
                  value={s?.alumni_edited_this_month ?? "—"}
                  href="/alumni?sort=updated"
                  linkLabel="View alumni edited this month, sorted by most recently edited"
                />
                <MetricCard
                  size="lg"
                  label="Alumni edited this year"
                  value={s?.alumni_edited_this_year ?? "—"}
                  href="/alumni?sort=updated"
                  linkLabel="View alumni edited this year, sorted by most recently edited"
                />
              </div>
              {/* Industry breakdown fills the entire leftover column space
                  beneath the KPI strip (#354/#375). Every industry fits without
                  a scrollbar at laptop height and up — the rows distribute
                  evenly to fill whatever height is left. That claim is what the
                  one-line row shape buys; it was NOT true of the older stacked
                  rows, which quietly overflowed on anything shorter than a
                  desktop monitor. */}
              <Panel
                title="Industry breakdown"
                action={
                  <span className="text-xs font-medium text-gray-500">
                    Click to filter
                  </span>
                }
                className="lg:min-h-0 lg:flex-1"
              >
                {/* `overflow-y-auto`, NOT `overflow-hidden`: the list is sized
                    to fit (two columns, see IndustryBarList), but on a very
                    short viewport the honest failure is a scrollbar, not rows
                    that vanish with nothing on screen saying so. */}
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

        {/* Home quick-add FAB (mobile). Log interaction / Add note open an
            alumnus search first, then land on that profile's form. */}
        {!notProvisioned && showFab ? (
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
