import Link from "next/link";
import { apiGet, ApiError } from "@/lib/api";
import { Topbar } from "@/components/shell/Topbar";
import { MetricCard } from "@/components/shared/MetricCard";
import { SearchHero } from "@/components/dashboard/SearchHero";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DATA_VIZ_PALETTE } from "@/constants/chart";
import type { GeoSummary } from "@/types/geography";

/**
 * `/dashboard/summary` has no `response_model` on the backend, so it isn't in
 * the generated OpenAPI types — keep this hand-written shape in sync with the
 * API. Everything the redesigned launchpad reads comes from here + the geography
 * summary (top industries).
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
}

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

/** First day of the current calendar month as YYYY-MM-DD (UTC) — matches the
 *  backend's calendar-month window for "Guest speakers this month". */
function isoMonthStart(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
}

/** Last day of the current calendar month as YYYY-MM-DD (UTC). */
function isoMonthEnd(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))
    .toISOString()
    .slice(0, 10);
}

const THIS_YEAR = new Date().getFullYear();

/* -------------------------------------------------------------- presentation -- */

function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">{children}</CardContent>
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
    <ul className="space-y-3">
      {rows.map((r) => {
        const row = (
          <>
            <span className="w-28 shrink-0 truncate text-sm text-gray-700">
              {r.label}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-brand-blue-600"
                style={{ width: `${Math.round((r.count / max) * 100)}%` }}
              />
            </div>
            <span className="w-6 shrink-0 text-right text-sm font-medium tabular-nums text-gray-900">
              {r.count}
            </span>
          </>
        );
        return (
          <li key={r.label}>
            {r.href ? (
              <Link
                href={r.href}
                aria-label={`View ${r.label} in alumni list`}
                className="-mx-2 flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1 transition hover:bg-brand-blue-50/40"
              >
                {row}
              </Link>
            ) : (
              <div className="flex items-center gap-3">{row}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Hand-built SVG donut + legend. Slice colors come from the UX-UI.md data-viz
 *  palette (chart-only use). Center shows the total; each legend row links to
 *  the filtered alumni list. */
function DonutChart({
  rows,
  emptyLabel,
}: {
  rows: { label: string; count: number; href?: string }[];
  emptyLabel: string;
}) {
  if (rows.length === 0)
    return <p className="py-4 text-sm text-gray-400">{emptyLabel}</p>;

  const total = rows.reduce((sum, r) => sum + r.count, 0);
  const size = 184;
  const stroke = 30;
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
        aria-label="Top industries distribution"
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
            rows.map((r, i) => {
              const arc = (r.count / total) * circumference;
              const seg = (
                <circle
                  key={r.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={DATA_VIZ_PALETTE[i % DATA_VIZ_PALETTE.length]}
                  strokeWidth={stroke}
                  strokeDasharray={`${arc} ${circumference - arc}`}
                  strokeDashoffset={-acc}
                />
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
      <ul className="min-w-0 flex-1 space-y-3">
        {rows.map((r, i) => {
          const body = (
            <>
              <span
                className="h-3 w-3 shrink-0 rounded-sm"
                style={{
                  backgroundColor: DATA_VIZ_PALETTE[i % DATA_VIZ_PALETTE.length],
                }}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 truncate text-base text-gray-700">
                {r.label}
              </span>
              <span className="shrink-0 text-base font-medium tabular-nums text-gray-900">
                {r.count}
              </span>
            </>
          );
          return (
            <li key={r.label}>
              {r.href ? (
                <Link
                  href={r.href}
                  aria-label={`View ${r.label} in alumni list`}
                  className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-1.5 transition hover:bg-brand-blue-50/40"
                >
                  {body}
                </Link>
              ) : (
                <div className="flex items-center gap-3 px-2 py-1.5">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Quick filters — a titled card whose rows each deep-link into a pre-filtered
 *  alumni list (or geography breakdown). Mirrors the Top employers panel header
 *  treatment so the two columns read as the same component family. */
function QuickFilters({ rows }: { rows: { label: string; href: string }[] }) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle>Quick filters</CardTitle>
      </CardHeader>
      {/* Rows share the remaining card height evenly so the list fills the
          column the same way the Top employers panel does across from it. */}
      <ul className="flex flex-1 flex-col">
        {rows.map((r) => (
          <li key={r.label} className="flex flex-1 border-t border-gray-100">
            <Link
              href={r.href}
              className="flex w-full items-center px-5 py-3 text-sm text-gray-700 transition-colors hover:bg-brand-blue-50/40 hover:text-brand-blue-600"
            >
              <span className="truncate">{r.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** A single "Browse" tile — title and a small subtitle (a count or hint),
 *  linking to the matching view. Text-only: a left navy keyline gives it
 *  identity instead of a decorative icon. */
function BrowseTile({
  title,
  sub,
  href,
}: {
  title: string;
  sub: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col justify-center rounded-lg border border-l-2 border-gray-300 border-l-navy-800 bg-white px-4 py-3.5 shadow-card transition-colors hover:border-l-brand-blue-600 hover:bg-brand-blue-50/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500 focus-visible:ring-offset-1"
    >
      <p className="text-sm font-semibold text-gray-900">{title}</p>
      <p className="mt-0.5 text-xs text-gray-500">{sub}</p>
    </Link>
  );
}

/* --------------------------------------------------------------------- page -- */

export default async function DashboardPage() {
  const thirtyDaysAgo = isoDaysAgo(30);
  const today = isoToday();
  const monthStart = isoMonthStart();
  const monthEnd = isoMonthEnd();
  const recentMin = String(THIS_YEAR - 5);
  const recentMax = String(THIS_YEAR);

  let s: Summary | null = null;
  let geoSum: GeoSummary | null = null;
  let notProvisioned = false;
  try {
    [s, geoSum] = await Promise.all([
      apiGet<Summary>("/dashboard/summary", {
        revalidate: 60,
        tags: ["dashboard"],
      }),
      apiGet<GeoSummary>("/geography/summary", {
        revalidate: 60,
        tags: ["geography"],
      }),
    ]);
  } catch (e) {
    if (e instanceof ApiError && e.status === 403) notProvisioned = true;
  }

  // Derived counts for the Browse tiles (fall back to a hint when unavailable).
  const utahCount = s?.by_state?.find((r) => r.state === "UT")?.count;
  const recentGradCount = s?.by_graduation_year
    ?.filter((r) => r.year >= THIS_YEAR - 5)
    .reduce((sum, r) => sum + r.count, 0);
  const industries = geoSum?.top_industries ?? [];
  const ibPeCount = ["Investment Banking", "Private Equity"]
    .map((name) => industries.find((i) => i.industry === name)?.count ?? 0)
    .reduce((a, b) => a + b, 0);
  const topEmployerNames = (s?.top_employers ?? [])
    .slice(0, 2)
    .map((e) => e.employer);

  const countSub = (n: number | undefined) =>
    typeof n === "number" ? `${n.toLocaleString()} alumni` : "View";

  const quickFilters = [
    {
      label: "Recent grads (last 5 years)",
      href: `/alumni?ymin=${recentMin}&ymax=${recentMax}`,
    },
    { label: "Willing mentors", href: "/alumni?mentor=1" },
    {
      label: "Guest speakers this month",
      href: `/alumni?spoke_after=${monthStart}&spoke_before=${monthEnd}`,
    },
    { label: "By location", href: "/map/breakdown/states" },
    { label: "By industry", href: "/map/breakdown/industries" },
  ];

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
          /* One interleaved 2-col grid so each row's left/right blocks align
             (and stay equal height) like the Figma: search│KPIs,
             quick-filters│top-employers, browse│top-industries. */
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Row 1 — search | KPI strip */}
            <SearchHero />
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
              <MetricCard
                size="lg"
                label="Attended this month"
                value={s?.attended_event_this_month ?? "—"}
                href={`/events?from=${thirtyDaysAgo}&to=${today}`}
                linkLabel="View events held this month"
              />
            </div>

            {/* Row 2 — quick filters | top employers */}
            <QuickFilters rows={quickFilters} />
            <Panel
              title="Top employers"
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

            {/* Row 3 — browse | top industries */}
            <section className="flex h-full flex-col">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Browse
              </p>
              {/* Tiles keep a compact height; any extra column height falls
                  into the gaps between rows (content-between), not into taller
                  tiles — matching the Figma. */}
              <div className="grid flex-1 grid-cols-1 auto-rows-min content-between gap-4 sm:grid-cols-2">
                <BrowseTile
                  title="Utah"
                  sub={countSub(utahCount)}
                  href="/alumni?state=UT"
                />
                <BrowseTile
                  title="Recent grads"
                  sub={
                    typeof recentGradCount === "number"
                      ? `${recentGradCount.toLocaleString()} · last 5 years`
                      : "Last 5 years"
                  }
                  href={`/alumni?ymin=${recentMin}&ymax=${recentMax}`}
                />
                <BrowseTile
                  title="IB / PE"
                  sub={ibPeCount > 0 ? `${ibPeCount.toLocaleString()} alumni` : "View"}
                  href="/alumni?industry=Investment%20Banking"
                />
                <BrowseTile
                  title="Willing mentors"
                  sub={countSub(s?.willing_mentors)}
                  href="/alumni?mentor=1"
                />
                <BrowseTile
                  title="Top employers"
                  sub={
                    topEmployerNames.length
                      ? `${topEmployerNames.join(", ")}…`
                      : "Browse all"
                  }
                  href="/map/breakdown/employers"
                />
                <BrowseTile
                  title="By industry"
                  sub="Browse all"
                  href="/map/breakdown/industries"
                />
              </div>
            </section>
            <Panel
              title="Top industries"
              action={
                <span className="text-xs font-medium text-gray-500">
                  Click to filter
                </span>
              }
            >
              <div className="flex w-full flex-1 items-center">
                <DonutChart
                  rows={industries.slice(0, 5).map((i) => ({
                    label: i.industry,
                    count: i.count,
                    href: `/alumni?industry=${encodeURIComponent(i.industry)}`,
                  }))}
                  emptyLabel="No industry data yet."
                />
              </div>
            </Panel>
          </div>
        )}
      </main>
    </>
  );
}
