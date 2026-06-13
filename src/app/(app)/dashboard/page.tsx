import Link from "next/link";
import { apiGet, ApiError } from "@/lib/api";
import { Topbar } from "@/components/shell/Topbar";
import { MetricCard } from "@/components/shared/MetricCard";
import { TopbarSearch } from "@/components/shared/TopbarSearch";
import { DashboardSearchBar } from "@/components/dashboard/DashboardSearchBar";
import { InitialsAvatar } from "@/components/shared/InitialsAvatar";
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
  /** NEW (parallel backend task) — events held in the current month. */
  events_this_month: number;
  /** NEW (parallel backend task) — alumni who guest-spoke this month. */
  guest_speakers_this_month: number;
  by_graduation_year: { year: number; count: number }[];
  top_employers: { employer: string; count: number }[];
  by_state: { state: string; count: number }[];
}

/** A birthday row from GET /dashboard/birthdays (ordered by day asc). */
interface Birthday {
  id: number;
  first_name: string;
  last_name: string;
  current_employer: string | null;
  graduation_year: number | null;
  /** ISO date "YYYY-MM-DD". */
  birth_date: string;
}

/** Compact month + day for a birthday, e.g. "Jun 14". The year is ignored —
 *  birthdays recur — so we parse only the month/day to avoid TZ drift. */
function formatBirthday(d: string): string {
  const [, m, day] = d.split("-").map(Number);
  if (!m || !day) return "";
  // Use a fixed year; only the month/day are rendered.
  return new Date(2000, m - 1, day).toLocaleDateString("en-US", {
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

/** "Birthdays this month" list. Each row: an initials avatar, the alumnus's
 *  name (links to their profile), an "<employer> · Class of <year>" subtitle,
 *  and a right-aligned "Jun 14" date. Rows arrive ordered by day ascending.
 *  Fills the panel height and scrolls internally when there are many. */
function BirthdayList({ rows }: { rows: Birthday[] }) {
  if (rows.length === 0)
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-gray-400">No birthdays this month.</p>
      </div>
    );

  return (
    <ul className="-mx-2 flex min-h-0 flex-1 flex-col gap-0.5 overflow-auto px-2">
      {rows.map((b) => {
        const name =
          [b.first_name, b.last_name].filter(Boolean).join(" ") || "—";
        const subtitle =
          [
            b.current_employer,
            b.graduation_year ? `Class of ${b.graduation_year}` : null,
          ]
            .filter(Boolean)
            .join(" · ") || "—";
        return (
          <li key={b.id}>
            <Link
              href={`/alumni/${b.id}`}
              aria-label={`View ${name}'s profile — birthday ${formatBirthday(
                b.birth_date,
              )}`}
              className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-1.5 transition hover:bg-brand-blue-50/40"
            >
              <InitialsAvatar name={name} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">
                  {name}
                </p>
                <p className="truncate text-xs text-gray-500">{subtitle}</p>
              </div>
              <span className="shrink-0 text-sm font-medium tabular-nums text-gray-700">
                {formatBirthday(b.birth_date)}
              </span>
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
  let birthdays: Birthday[] = [];
  let notProvisioned = false;
  try {
    [s, geo, geoSum, birthdays] = await Promise.all([
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
      // Birthdays is a brand-new endpoint shipping in parallel; until it lands
      // a 404 (or any error) must not break the page, so swallow it to [].
      apiGet<Birthday[]>("/dashboard/birthdays", {
        revalidate: 60,
        tags: ["dashboard"],
      }).catch((e) => {
        // A 403 still means "not provisioned" — re-throw so the outer catch
        // shows the provisioning notice instead of a half-empty dashboard.
        if (e instanceof ApiError && e.status === 403) throw e;
        return [] as Birthday[];
      }),
    ]);
  } catch (e) {
    if (e instanceof ApiError && e.status === 403) notProvisioned = true;
  }
  const geoCounts: Record<string, number> = {};
  for (const st of geo) geoCounts[st.state] = st.alumni_count;

  const cityOptions = (geoSum?.top_cities ?? []).map((c) => ({
    label: `${c.city}, ${c.state}`,
    city: c.city,
    state: c.state,
  }));

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
            {/* Search / filter bar — find alumni fast */}
            <DashboardSearchBar
              employers={geoSum?.options.employers ?? []}
              gradYears={geoSum?.options.graduation_years ?? []}
              cities={cityOptions}
            />

            {/* KPI strip (6 across) */}
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
                href="/alumni?speaker=1"
                linkLabel="View alumni willing to guest speak"
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
                href="/events"
                linkLabel="View events"
              />
              <MetricCard
                size="lg"
                label="Attended this month"
                value={s?.attended_event_this_month ?? "—"}
                href="/events"
                linkLabel="View events"
              />
              <MetricCard
                size="lg"
                label="Contacted this month"
                value={s?.contacted_this_month ?? "—"}
                href="/alumni"
                linkLabel="View alumni"
              />
            </div>

            {/* Row A — Top employers | Top industries (equal halves) */}
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

            {/* Row B — Map quick view (left) | Birthdays this month (right),
                equal halves. Grows to fill the remaining viewport height on
                lg+; stacks at natural height below lg. */}
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
              <Panel
                className="flex h-full flex-col"
                title="Map quick view"
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

              <Panel
                className="flex h-full flex-col"
                title="Birthdays this month"
                action={
                  <Link
                    href="/alumni"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-blue-600 hover:text-brand-blue-500"
                  >
                    View all
                  </Link>
                }
              >
                <BirthdayList rows={birthdays} />
              </Panel>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
