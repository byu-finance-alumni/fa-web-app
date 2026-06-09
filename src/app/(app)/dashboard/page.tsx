import Link from "next/link";
import { apiGet, ApiError } from "@/lib/api";
import { Topbar } from "@/components/shell/Topbar";
import { KpiDrawers } from "@/components/dashboard/KpiDrawers";
import { MetricCard } from "@/components/shared/MetricCard";
import { TopbarSearch } from "@/components/shared/TopbarSearch";
import { UsStateMap } from "@/components/geography/UsStateMap";
import { DATA_VIZ_PALETTE } from "@/constants/chart";
import type { StateCount, GeoSummary } from "@/types/geography";

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
  by_graduation_year: { year: number; count: number }[];
  top_employers: { employer: string; count: number }[];
  by_state: { state: string; count: number }[];
}

interface EventParticipationRow {
  event_id: number;
  event_name: string;
  event_type: string | null;
  /** ISO date "YYYY-MM-DD" or null. */
  event_date: string | null;
  participant_count: number;
}

/** Compact event date, e.g. "May 29, 2026". Returns "" when unknown so the
 *  row simply omits a date rather than showing a dash. */
function formatEventDate(d: string | null): string {
  if (!d) return "";
  return new Date(`${d}T00:00:00`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
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

/** Hand-built, clickable horizontal bar list of per-event participation over
 *  the ~last 12 months. Each row shows the event name + date and a
 *  proportional bar + attendee count, and links to that event in the Events
 *  section, which auto-opens its detail drawer (`/events?event=<id>`). Fills
 *  the panel height and scrolls internally when there are many events. */
function EventParticipationChart({
  rows,
}: {
  rows: EventParticipationRow[];
}) {
  if (rows.length === 0)
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-gray-400">No event participation yet.</p>
      </div>
    );

  const max = Math.max(1, ...rows.map((r) => r.participant_count));
  return (
    <ul className="-mx-2 flex min-h-0 flex-1 flex-col gap-1 overflow-auto px-2">
      {rows.map((r) => {
        const date = formatEventDate(r.event_date);
        const count = r.participant_count;
        return (
          <li key={r.event_id}>
            <Link
              href={`/events?event=${r.event_id}`}
              aria-label={`Open ${r.event_name} in events: ${count} ${
                count === 1 ? "participant" : "participants"
              }`}
              className="group -mx-2 block rounded-lg px-2 py-1.5 transition hover:bg-brand-blue-50/40"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-sm font-medium text-gray-900">
                  {r.event_name}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-gray-500">
                  {date}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-navy-800 transition-colors group-hover:bg-brand-blue-600"
                    style={{
                      width: `${Math.max(count > 0 ? 4 : 0, (count / max) * 100)}%`,
                    }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right text-sm font-semibold tabular-nums text-gray-900">
                  {count}
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export default async function DashboardPage() {
  let s: Summary | null = null;
  let geo: StateCount[] = [];
  let geoSum: GeoSummary | null = null;
  let participation: EventParticipationRow[] = [];
  let notProvisioned = false;
  try {
    [s, geo, geoSum, participation] = await Promise.all([
      apiGet<Summary>("/dashboard/summary", {
        revalidate: 60,
        tags: ["dashboard"],
      }),
      apiGet<StateCount[]>("/geography/states", {
        revalidate: 60,
        tags: ["geography"],
      }),
      apiGet<GeoSummary>("/geography/summary", {
        revalidate: 60,
        tags: ["geography"],
      }),
      apiGet<EventParticipationRow[]>("/dashboard/event-participation", {
        revalidate: 60,
        tags: ["dashboard", "events"],
      }),
    ]);
  } catch (e) {
    if (e instanceof ApiError && e.status === 403) notProvisioned = true;
  }
  const geoCounts: Record<string, number> = {};
  for (const st of geo) geoCounts[st.state] = st.alumni_count;

  return (
    <>
      <Topbar title="Dashboard">
        <TopbarSearch />
      </Topbar>
      <main className="flex min-h-0 flex-1 flex-col overflow-auto p-6 lg:overflow-hidden">
        {notProvisioned ? (
          <div className="rounded-xl border border-gray-300 bg-white p-4 text-sm text-gray-700">
            Your account is authenticated but not yet provisioned. Ask a Super
            Admin to grant your account a role to see data.
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-4 lg:overflow-hidden">
            {/* Row 1 — KPI strip (6 across) */}
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
                label="Attended an event this month"
                value={s?.attended_event_this_month ?? "—"}
                href="/events"
                linkLabel="View events"
              />
              <MetricCard
                size="lg"
                label="Upcoming events"
                value={s?.upcoming_events ?? "—"}
                href="/events"
                linkLabel="View upcoming events"
              />
              <MetricCard
                size="lg"
                label="Willing mentors"
                value={s?.willing_mentors ?? "—"}
                href="/alumni?mentor=1"
                linkLabel="View alumni willing to mentor"
              />
              <KpiDrawers
                contacted={s?.contacted_this_month ?? "—"}
                followUps={s?.upcoming_follow_ups ?? "—"}
              />
            </div>

            {/* Row 2 — Top employers | Cohort chart (equal halves) */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Panel title="Top employers">
                <BarList
                  rows={(s?.top_employers ?? []).slice(0, 5).map((e) => ({
                    label: e.employer,
                    count: e.count,
                    href: `/alumni?employer=${encodeURIComponent(e.employer)}`,
                  }))}
                  emptyLabel="No employer data yet."
                />
              </Panel>

              <Panel title="Top industries">
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

            {/* Row 3 — Alumni map (left) | Event participation (right), equal
                halves. Grows to fill the remaining viewport height on lg+;
                stacks at natural height below lg. Recent activity and data
                quality live on their own pages (/activity, /data-quality). */}
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
              <Panel
                className="flex h-full flex-col"
                title="Alumni map"
                action={
                  <Link
                    href="/map"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-blue-600 hover:text-brand-blue-500"
                  >
                    Open full map →
                  </Link>
                }
              >
                <div className="min-h-0 flex-1">
                  <UsStateMap
                    counts={geoCounts}
                    selected={null}
                    filterQuery=""
                    fit
                  />
                </div>
              </Panel>

              <Panel className="flex h-full flex-col" title="Event participation">
                <EventParticipationChart rows={participation} />
              </Panel>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
