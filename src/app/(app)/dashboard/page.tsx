import Link from "next/link";
import { apiGet, ApiError } from "@/lib/api";
import { Topbar } from "@/components/shell/Topbar";
import { MetricCard } from "@/components/shared/MetricCard";
import { TopbarSearch } from "@/components/shared/TopbarSearch";
import { DashboardHub } from "@/components/dashboard/DashboardHub";
import { DATA_VIZ_PALETTE } from "@/constants/chart";
import type { GeoSummary } from "@/types/geography";

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
  /** NEW (parallel backend task) — events held in the current month. */
  events_this_month: number;
  /** NEW (parallel backend task) — alumni who guest-spoke this month. */
  guest_speakers_this_month: number;
  by_graduation_year: { year: number; count: number }[];
  top_employers: { employer: string; count: number }[];
  by_state: { state: string; count: number }[];
}

function Panel({
  title,
  action,
  className,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  /** Extra classes on the card (e.g. `flex h-full flex-col` for full-height). */
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-xl border border-gray-300 bg-white p-5${
        className ? ` ${className}` : ""
      }`}
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        {action}
      </div>
      {children}
    </section>
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
 *  the filtered alumni list. Distinct from the bar lists for visual variety. */
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
  const size = 128;
  const stroke = 20;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  let acc = 0;

  return (
    <div className="flex items-center gap-5">
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
          className="fill-gray-900 text-lg font-semibold tabular-nums"
        >
          {total}
        </text>
      </svg>
      <ul className="min-w-0 flex-1 space-y-1.5">
        {rows.map((r, i) => {
          const body = (
            <>
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{
                  backgroundColor: DATA_VIZ_PALETTE[i % DATA_VIZ_PALETTE.length],
                }}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 truncate text-sm text-gray-700">
                {r.label}
              </span>
              <span className="shrink-0 text-sm font-medium tabular-nums text-gray-900">
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
                  className="-mx-2 flex items-center gap-2.5 rounded-lg px-2 py-1 transition hover:bg-brand-blue-50/40"
                >
                  {body}
                </Link>
              ) : (
                <div className="flex items-center gap-2.5 px-2 py-1">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** YYYY-MM-DD for a date `days` before today (UTC), matching the dashboard
 *  KPIs' rolling 30-day window so a tile's count and its deep-linked list agree. */
function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Today as YYYY-MM-DD (UTC). */
function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

/** First day of the current calendar month as YYYY-MM-DD (UTC). Matches the
 *  backend's calendar-month window for the "Events this month" and "Guest
 *  speakers this month" KPIs (month_start) so a tile's count and its deep-linked
 *  list agree. */
function isoMonthStart(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
}

/** Last day of the current calendar month as YYYY-MM-DD (UTC) — day 0 of next
 *  month. Mirrors the backend's inclusive month_end bound. */
function isoMonthEnd(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))
    .toISOString()
    .slice(0, 10);
}

export default async function DashboardPage() {
  // "This month" KPIs use a rolling 30-day window on the backend
  // (contacted_this_month: interactions in the last 30 days;
  // attended_event_this_month: events held in the last 30 days). The two tiles
  // deep-link with the matching list filters so the count and the resulting
  // list agree: /alumni?contacted_after=<30d ago> and the events list bounded
  // to the same window via from/to (→ date_from/date_to).
  const thirtyDaysAgo = isoDaysAgo(30);
  const today = isoToday();
  // The "Events this month" and "Guest speakers this month" KPIs are
  // CALENDAR-month scoped on the backend (month_start..month_end), unlike the
  // rolling-30-day "Attended this month" / "Contacted this month" tiles. Their
  // deep-links therefore use the calendar-month bounds so count == list length.
  const monthStart = isoMonthStart();
  const monthEnd = isoMonthEnd();

  let s: Summary | null = null;
  let geoSum: GeoSummary | null = null;
  let notProvisioned = false;
  try {
    [s, geoSum] = await Promise.all([
      apiGet<Summary>("/dashboard/summary", {
        revalidate: 60,
        tags: ["dashboard"],
      }),
      // Geography summary still feeds the Top industries panel; the map quick
      // view and birthdays sections were removed, so /geography/states and
      // /dashboard/birthdays are no longer fetched.
      apiGet<GeoSummary>("/geography/summary", {
        revalidate: 60,
        tags: ["geography"],
      }),
    ]);
  } catch (e) {
    if (e instanceof ApiError && e.status === 403) notProvisioned = true;
  }

  return (
    <>
      <Topbar title="Dashboard">
        <TopbarSearch />
      </Topbar>
      <main className="flex-1 overflow-auto p-6">
        {notProvisioned ? (
          <div className="rounded-xl border border-gray-300 bg-white p-4 text-sm text-gray-700">
            Your account is authenticated but not yet provisioned. Ask a Super
            Admin to grant your account a role to see data.
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Search + preset-filter hub — the focal point. Everything here is a
                launchpad: it deep-links into the alumni list, never renders
                results inline. */}
            <DashboardHub
              topEmployers={(s?.top_employers ?? []).map((e) => e.employer)}
            />

            {/* KPI strip (6 across). Each tile deep-links into a pre-filtered
                list (Total alumni → the full list). */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
              <MetricCard
                size="lg"
                label="Total alumni"
                value={s?.total_alumni ?? "—"}
                href="/alumni"
                linkLabel="View all alumni"
              />
              <MetricCard
                size="lg"
                label="Guest speakers this month"
                value={s?.guest_speakers_this_month ?? "—"}
                href={`/alumni?spoke_after=${monthStart}&spoke_before=${monthEnd}`}
                linkLabel="View alumni who guest-spoke this month"
              />
              <MetricCard
                size="lg"
                label="Willing mentors"
                value={s?.willing_mentors ?? "—"}
                href="/alumni?mentor=1"
                linkLabel="View alumni willing to mentor"
              />
              <MetricCard
                size="lg"
                label="Events this month"
                value={s?.events_this_month ?? "—"}
                href={`/events?from=${monthStart}&to=${monthEnd}`}
                linkLabel="View events held this month"
              />
              <MetricCard
                size="lg"
                label="Attended this month"
                value={s?.attended_event_this_month ?? "—"}
                href={`/events?from=${thirtyDaysAgo}&to=${today}`}
                linkLabel="View events held this month"
              />
              <MetricCard
                size="lg"
                label="Contacted this month"
                value={s?.contacted_this_month ?? "—"}
                href={`/alumni?contacted_after=${thirtyDaysAgo}`}
                linkLabel="View alumni contacted this month"
              />
            </div>

            {/* Top employers | Top industries — clickable-to-filter stat panels. */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Panel
                title="Top employers"
                action={
                  <span className="text-xs font-medium text-gray-500">
                    Click to filter →
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

              <Panel
                title="Top industries"
                action={
                  <span className="text-xs font-medium text-gray-500">
                    Click to filter →
                  </span>
                }
              >
                <DonutChart
                  rows={(geoSum?.top_industries ?? []).slice(0, 5).map((i) => ({
                    label: i.industry,
                    count: i.count,
                    href: `/alumni?industry=${encodeURIComponent(i.industry)}`,
                  }))}
                  emptyLabel="No industry data yet."
                />
              </Panel>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
