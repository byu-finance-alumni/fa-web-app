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
 * industry breakdown that powers the wheel).
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
 * Distinct muted tone for the "Unknown" (no industry on file) bucket, so it
 * reads differently from the grey "Other" catch-all and nudges staff to fill in
 * the missing data. A warm amber — deliberately NOT one of the brand-blue
 * data-viz accents — signaling "needs attention", not a real category.
 */
const CHART_UNKNOWN_COLOR = "#D97706"; // amber-600

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
      <CardContent className="flex flex-1 flex-col justify-center">
        {children}
      </CardContent>
    </Card>
  );
}

function BarList({
  rows,
  emptyLabel,
}: {
  rows: { label: string; count: number; href?: string }[];
  emptyLabel: string;
}) {
  if (rows.length === 0)
    return <p className="py-4 text-sm text-gray-400">{emptyLabel}</p>;
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <ul className="space-y-1">
      {rows.map((r) => {
        const row = (
          <>
            <span className="w-36 shrink-0 truncate text-sm font-medium text-gray-700">
              {r.label}
            </span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-brand-blue-600"
                style={{ width: `${Math.round((r.count / max) * 100)}%` }}
              />
            </div>
            <span className="w-8 shrink-0 text-right text-sm font-semibold tabular-nums text-gray-900">
              {r.count}
            </span>
          </>
        );
        return (
          <li key={r.label}>
            {r.href ? (
              <Link
                href={r.href}
                aria-label={`View ${r.label} (${r.count}) in alumni list`}
                title={`${r.label}: ${r.count}`}
                className="-mx-2 flex cursor-pointer items-center gap-3 rounded-lg px-2 py-0.5 transition hover:bg-brand-blue-50/40"
              >
                {row}
              </Link>
            ) : (
              <div
                className="flex items-center gap-3"
                title={`${r.label}: ${r.count}`}
              >
                {row}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Hand-built SVG donut + legend. Each row carries its own `color` (resolved by
 *  the caller from the UX-UI.md data-viz palette). The wheel draws only the
 *  non-zero slices; the legend lists EVERY row (incl. zero-count industries,
 *  shown as 0). Center shows the total; each row links to the filtered alumni
 *  list. */
function DonutChart({
  rows,
  emptyLabel,
}: {
  rows: { label: string; count: number; color: string; href?: string }[];
  emptyLabel: string;
}) {
  if (rows.length === 0)
    return <p className="py-4 text-sm text-gray-400">{emptyLabel}</p>;

  const total = rows.reduce((sum, r) => sum + r.count, 0);
  // The wheel only renders slices with a real share; the legend still lists all.
  const slices = rows.filter((r) => r.count > 0);
  const size = 300;
  const stroke = 46;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  let acc = 0;

  return (
    <div className="flex w-full items-center gap-6">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="shrink-0"
        role="img"
        aria-label="Industry distribution"
      >
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {total === 0 ? (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              className="stroke-gray-100"
              strokeWidth={stroke}
            />
          ) : (
            slices.map((r) => {
              const arc = (r.count / total) * circumference;
              const pct = Math.round((r.count / total) * 100);
              const circle = (
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={r.color}
                  strokeWidth={stroke}
                  strokeDasharray={`${arc} ${circumference - arc}`}
                  strokeDashoffset={-acc}
                  className={
                    r.href
                      ? "cursor-pointer transition-opacity hover:opacity-75"
                      : undefined
                  }
                >
                  {/* Native SVG tooltip on hover — exact count + its share of the
                      charted total (a real proportion, not a trend metric). */}
                  <title>{`${r.label}: ${r.count} (${pct}%)`}</title>
                </circle>
              );
              // Clicking a slice drills into the same filtered alumni list its
              // legend row links to.
              const seg = r.href ? (
                <a
                  key={r.label}
                  href={r.href}
                  aria-label={`View ${r.label} (${r.count}) in alumni list`}
                >
                  {circle}
                </a>
              ) : (
                <g key={r.label}>{circle}</g>
              );
              acc += arc;
              return seg;
            })
          )}
        </g>
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-gray-900 text-3xl font-semibold tabular-nums"
        >
          {total}
        </text>
      </svg>
      <ul className="grid min-w-0 flex-1 grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
        {rows.map((r) => {
          const body = (
            <>
              <span
                className="h-3 w-3 shrink-0 rounded-sm"
                style={{ backgroundColor: r.color }}
                aria-hidden="true"
              />
              <span
                className={`min-w-0 flex-1 truncate text-sm ${
                  r.count === 0 ? "text-gray-400" : "text-gray-700"
                }`}
              >
                {r.label}
              </span>
              <span
                className={`shrink-0 text-sm font-medium tabular-nums ${
                  r.count === 0 ? "text-gray-400" : "text-gray-900"
                }`}
              >
                {r.count}
              </span>
            </>
          );
          return (
            <li key={r.label}>
              {r.href ? (
                <Link
                  href={r.href}
                  aria-label={`View ${r.label} (${r.count}) in alumni list`}
                  title={`${r.label}: ${r.count}`}
                  className="-mx-2 flex items-center gap-2.5 rounded-lg px-2 py-1 transition hover:bg-brand-blue-50/40"
                >
                  {body}
                </Link>
              ) : (
                <div
                  className="-mx-2 flex items-center gap-2.5 px-2 py-1"
                  title={`${r.label}: ${r.count}`}
                >
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
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

  // Industry wheel (#351/#352/#353): the backend returns EVERY canonical finance
  // industry (incl. zero-count) plus separate "Other" (catch-all value) and
  // "Unknown" (no industry on file) buckets. The legend lists them all; the
  // wheel only draws non-zero slices. Colors are stable per row: finance
  // industries cycle the data-viz palette, "Other" is muted grey, and "Unknown"
  // gets its own amber tone so it reads as distinct from "Other". Each row is
  // clickable — finance industries deep-link to `?industry=<name>`, "Other" to
  // `?industry_group=other`, and "Unknown" to `?industry_group=unknown` so staff
  // can open and fix the profiles that are missing an industry.
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
        // not a standard category. Only surface it when non-empty so the wheel
        // shows just the 14 + Other otherwise (Tanya, 2026-07-11).
        ...(breakdown.unknown > 0
          ? [
              {
                label: "Unknown",
                count: breakdown.unknown,
                color: CHART_UNKNOWN_COLOR,
                href: `/alumni?industry_group=unknown`,
              },
            ]
          : []),
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
            <div className="flex flex-1 flex-col gap-5">
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
              {/* Industry wheel on top, spanning the column and growing to fill
                  the space (#354); the smaller Top Employers box sits beneath. */}
              <Panel
                title="Industry breakdown"
                action={
                  <span className="text-xs font-medium text-gray-500">
                    Click to filter
                  </span>
                }
                className="flex-1"
              >
                <div className="flex w-full flex-1 items-center">
                  <DonutChart
                    rows={industryRows}
                    emptyLabel="No industry data yet."
                  />
                </div>
              </Panel>
              <Panel
                title="Top Employers (last 5 years)"
                action={
                  <span className="text-xs font-medium text-gray-500">
                    Click to filter
                  </span>
                }
              >
                <BarList
                  rows={(s?.top_employers ?? []).slice(0, 5).map((e) => ({
                    label: e.employer,
                    count: e.count,
                    href: `/alumni?employer=${encodeURIComponent(e.employer)}`,
                  }))}
                  emptyLabel="No employer data yet."
                />
              </Panel>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
