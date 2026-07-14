import Link from "next/link";
import { apiGet, ApiError } from "@/lib/api";
import { getAuthContext } from "@/lib/auth-context";
import { Topbar } from "@/components/shell/Topbar";
import { MetricCard } from "@/components/shared/MetricCard";
import { SearchHero } from "@/components/dashboard/SearchHero";
import { DashboardSearch } from "@/components/dashboard/DashboardSearch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DATA_VIZ_PALETTE, CHART_MUTED_COLOR } from "@/constants/chart";
import type { UserContext } from "@/types/alumni";
import type { FilterOptions } from "@/types/filters";
import type { components } from "@/types/api.gen";

type DashboardPreset = components["schemas"]["DashboardPresetRead"];

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
  upcoming_follow_ups: number;
  duplicate_count: number;
  attended_event_this_month: number;
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
   * file) are separate, distinct buckets.
   */
  industry_breakdown: {
    industries: { industry: string; count: number }[];
    other: number;
    unknown: number;
  };
}

/**
 * Danger red for the "Unknown" (no industry on file) bucket, so it reads as a
 * gap in the data to fix — distinct from the grey "Other" catch-all and from the
 * brand-blue data-viz accents. Signals "needs attention", not a real category.
 */
const CHART_UNKNOWN_COLOR = "#B42318"; // danger-600

/* ------------------------------------------------------------- date helpers -- */

/** YYYY-MM-DD for a date `days` before today (UTC) — matches the rolling
 *  30-day KPI windows so a tile's count and its deep-linked list agree. */
function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Today as YYYY-MM-DD (UTC). */
function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
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
  rows: { label: string; count: number; color: string; href?: string }[];
  emptyLabel: string;
}) {
  if (rows.length === 0)
    return <p className="py-4 text-sm text-gray-400">{emptyLabel}</p>;

  // Catch-all buckets stay pinned to the end; the real finance industries above
  // them are ordered alphabetically. (The buckets are named exactly "Other" /
  // "Unknown" by the caller — no real category collides with those.)
  const CATCH_ALLS = new Set(["Other", "Unknown"]);
  const ordered = [
    ...rows
      .filter((r) => !CATCH_ALLS.has(r.label))
      .sort((a, b) => a.label.localeCompare(b.label)),
    ...rows.filter((r) => CATCH_ALLS.has(r.label)),
  ];
  const max = Math.max(1, ...ordered.map((r) => r.count));

  return (
    <ul className="space-y-0.5">
      {ordered.map((r) => {
        const muted = r.count === 0;
        // "Unknown" is a data-gap bucket: always drawn in danger red (label +
        // count), even at 0, so it never blends into the muted zero rows.
        const isUnknown = r.label === "Unknown";
        const body = (
          <>
            <div className="flex items-baseline justify-between gap-2">
              <span
                className={`min-w-0 truncate text-sm font-medium ${
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
                className={`shrink-0 text-sm font-semibold tabular-nums ${
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
            <div className="mt-0.5 h-2 overflow-hidden rounded-full bg-gray-100">
              {/* Per-industry fill colour (matches the old wheel slice); a
                  zero-count row draws no bar but keeps its muted label + 0. */}
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
          <li key={r.label}>
            {r.href ? (
              <Link
                href={r.href}
                aria-label={`View ${r.label} (${r.count}) in alumni list`}
                title={`${r.label}: ${r.count}`}
                className="block rounded-lg px-1.5 py-[1.75px] transition hover:bg-brand-blue-50/40"
              >
                {body}
              </Link>
            ) : (
              <div className="px-1.5 py-[1.75px]" title={`${r.label}: ${r.count}`}>
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
  const today = isoToday();

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
  let presets: DashboardPreset[] = [];
  let industryVocab: string[] | null = null;
  if (!notProvisioned) {
    [filterOptions, presets, industryVocab] = await Promise.all([
      apiGet<FilterOptions>("/alumni/filter-options", {
        revalidate: 300,
        tags: ["alumni-filter-options"],
      }).catch(() => null),
      apiGet<DashboardPreset[]>("/dashboard/presets", {
        revalidate: 60,
        tags: ["dashboard-presets"],
      }).catch(() => []),
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
      ]
    : [];

  // Quick-filter presets on the Quick search tab — engineer/super-admin-managed
  // (GET /dashboard/presets), each a common compound search deep-linking into
  // the alumni list. One per line.
  const alumniShortcuts = presets.map((p) => ({ label: p.label, href: p.href }));

  const EMPTY_OPTIONS: FilterOptions = {
    employers: [],
    past_employers: [],
    titles: [],
    seniority_levels: [],
    industries: [],
    cities: [],
    states: [],
    tags: [],
    status_labels: [],
    leadership_roles: [],
    survey_statuses: [],
    graduation_years: [],
  };

  return (
    <>
      <Topbar title="Dashboard" />
      <main className="flex-1 overflow-auto p-6">
        {notProvisioned ? (
          <Card className="p-4 text-sm text-gray-700">
            Your account is authenticated but not yet provisioned. Ask a Super
            Admin to grant your account a role to see data.
          </Card>
        ) : (
          /* Two columns that stretch to fill the viewport: quick-search
             features on the left half, KPIs + the two charts on the right. */
          <div className="flex min-h-full flex-col gap-5 lg:h-full lg:flex-row lg:items-stretch">
            {/* LEFT — natural-language search bar, then the tabbed search
                workspace (quick / advanced) below it */}
            <div className="flex min-h-0 flex-1 flex-col gap-5">
              <SearchHero greeting={greeting} />
              <DashboardSearch
                options={filterOptions ?? EMPTY_OPTIONS}
                alumniShortcuts={alumniShortcuts}
              />
            </div>

            {/* RIGHT — KPI strip + the two charts */}
            <div className="flex min-h-0 flex-1 flex-col gap-5">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
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
                <MetricCard
                  size="lg"
                  label="Events attended this month"
                  value={s?.attended_event_this_month ?? "—"}
                  href={`/events?from=${thirtyDaysAgo}&to=${today}`}
                  linkLabel="View events held this month"
                />
              </div>
              {/* Industry breakdown fills the entire leftover column space
                  beneath the KPI strip (#354/#375). The full industry list
                  scrolls inside the box if it's taller than that space, so the
                  box matches the left column's height without growing. */}
              <Panel
                title="Industry breakdown"
                action={
                  <span className="text-xs font-medium text-gray-500">
                    Click to filter
                  </span>
                }
                className="min-h-0 flex-1"
              >
                <div className="min-h-0 w-full flex-1 overflow-y-auto">
                  <IndustryBarList
                    rows={industryRows}
                    emptyLabel="No industry data yet."
                  />
                </div>
              </Panel>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
