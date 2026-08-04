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
import { hasFullAccess, canAddInteraction } from "@/constants/roles";
import { DATA_VIZ_PALETTE, CHART_MUTED_COLOR } from "@/constants/chart";
import type { UserContext } from "@/types/alumni";
import type { FilterOptions } from "@/types/filters";

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
   */
  alumni_edited_this_month?: number;
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

/** YYYY-MM-DD for a date `days` before today (UTC) — matches the rolling
 *  30-day KPI windows so a tile's count and its deep-linked list agree. */
function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

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

/** Industry breakdown as a vertical list of per-industry coloured bars with the
 *  FULL (un-truncated) industry name above each bar, plus its count (#375 —
 *  replaces the old donut wheel so long industry names are fully legible). Real
 *  finance industries are listed alphabetically (A→Z); the "Other" and "Unknown"
 *  catch-all buckets always sort LAST since they aren't part of the A→Z category
 *  list. Each row carries its own `color` (resolved by the caller from the
 *  UX-UI.md data-viz palette) so every bar is a different colour — deliberately
 *  distinct from the single-blue Top Employers bars beneath it. Zero-count
 *  industries are still listed, shown muted (grey); each row links to the
 *  filtered alumni list. */
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

  // Desktop (lg): the list fills the panel height with rows distributed evenly
  // (each row flex-1) and NO scrollbar — every industry visible at once, bars as
  // tall as the space allows. Mobile: rows take their natural height with a
  // fixed, readable bar so the list reads as a clean stacked list (the fill-
  // height math has no bounded height to work with on a phone).
  return (
    <ul className="flex flex-col gap-0.5 lg:h-full">
      {ordered.map((r) => {
        const muted = r.count === 0;
        // "Unknown" is a data-gap bucket: always drawn in danger red (label +
        // count), even at 0, so it never blends into the muted zero rows.
        const isUnknown = r.label === "Unknown";
        const body = (
          <>
            <div className="flex items-baseline justify-between gap-2">
              <span
                className={`min-w-0 truncate text-xs font-medium ${
                  isUnknown
                    ? "text-danger-600"
                    : muted
                      ? "text-gray-400"
                      : "text-gray-700"
                }`}
              >
                {r.label}
              </span>
              <span
                className={`shrink-0 text-xs font-semibold tabular-nums ${
                  isUnknown
                    ? "text-danger-600"
                    : muted
                      ? "text-gray-400"
                      : "text-gray-900"
                }`}
              >
                {r.count}
              </span>
            </div>
            {/* Bar track grows to fill the row's leftover height (flex-1), so the
                bars are as tall as they can be while all rows still fit. A
                zero-count row draws no fill but keeps its muted label + 0. */}
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100 lg:h-auto lg:min-h-[6px] lg:flex-1">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.round((r.count / max) * 100)}%`,
                  backgroundColor: r.color,
                }}
              />
            </div>
          </>
        );
        return (
          <li key={r.label} className="flex flex-col lg:min-h-0 lg:flex-1">
            {r.href ? (
              <Link
                href={r.href}
                aria-label={`View ${r.label} (${r.count}) in alumni list`}
                title={`${r.label}: ${r.count}`}
                className="flex flex-col rounded-lg px-1.5 py-0.5 transition hover:bg-brand-blue-50/40 lg:h-full"
              >
                {body}
              </Link>
            ) : (
              <div
                className="flex flex-col px-1.5 py-0.5 lg:h-full"
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
  const thirtyDaysAgo = isoDaysAgo(30);

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

  // Quick-add FAB (mobile) gating: full_access can create records; interaction
  // logging is open to the wider canAddInteraction tier (professors included).
  const dashRoles = ctx?.roles ?? null;
  const canCreate = hasFullAccess(dashRoles);
  const canLogInteraction = canAddInteraction(dashRoles);

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

  const EMPTY_OPTIONS: FilterOptions = {
    employers: [],
    past_employers: [],
    titles: [],
    seniority_levels: [],
    industries: [],
    secondary_industries: [],
    employment_statuses: [],
    cities: [],
    states: [],
    tags: [],
    status_labels: [],
    leadership_roles: [],
    survey_statuses: [],
    graduation_years: [],
    graduation_classes: [],
  };

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
              <DashboardSearch options={filterOptions ?? EMPTY_OPTIONS} />
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
                <MetricCard
                  size="lg"
                  label="Contacted this month"
                  value={s?.contacted_this_month ?? "—"}
                  href={`/alumni?contacted_after=${thirtyDaysAgo}`}
                  linkLabel="View alumni contacted this month"
                />
                {/* #606: replaces the old "Events attended this month" tile.
                    Counts alumni records touched in the CURRENT CALENDAR month
                    — note the tile to its left is a rolling 30 days, so the two
                    numbers are not directly comparable. Deep-links to the
                    alumni list sorted most-recently-edited first, whose "Last
                    updated" column makes the count checkable. */}
                <MetricCard
                  size="lg"
                  label="Alumni edited this month"
                  value={s?.alumni_edited_this_month ?? "—"}
                  href="/alumni?sort=updated"
                  linkLabel="View alumni sorted by most recently edited"
                />
              </div>
              {/* Industry breakdown fills the entire leftover column space
                  beneath the KPI strip (#354/#375). Every industry fits without
                  a scrollbar — the rows distribute evenly to fill the height and
                  the bars grow as large as the space allows (#294 follow-up). */}
              <Panel
                title="Industry breakdown"
                action={
                  <span className="text-xs font-medium text-gray-500">
                    Click to filter
                  </span>
                }
                className="lg:min-h-0 lg:flex-1"
              >
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

        {/* Home quick-add FAB (mobile). Log interaction / Add note open an
            alumnus search first, then land on that profile's form. */}
        {!notProvisioned && (canCreate || canLogInteraction) ? (
          <Fab label="Quick add">
            {canLogInteraction ? (
              <QuickLogButton kind="interaction" label="Log interaction" />
            ) : null}
            {canCreate ? (
              <QuickLogButton kind="note" label="Add note" />
            ) : null}
            {canCreate ? (
              <Button asChild variant="secondary">
                {/* The plain create form — an event needs no attendee list to
                  exist (#611). Bulk CSV import lives on the Events page as its
                  own clearly-labelled secondary action. */}
              <Link href="/events/new">Add event</Link>
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
