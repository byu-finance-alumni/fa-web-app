import Link from "next/link";
import {
  Briefcase,
  CalendarCheck,
  GraduationCap,
  Handshake,
  MapPin,
  Mic,
  PhoneCall,
  Users,
  type LucideIcon,
} from "lucide-react";
import { apiGet, ApiError } from "@/lib/api";
import { Topbar } from "@/components/shell/Topbar";
import { SearchHero } from "@/components/dashboard/SearchHero";
import { KpiTile } from "@/components/dashboard/KpiTile";
import { Chip } from "@/components/ui/chip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DATA_VIZ_PALETTE } from "@/constants/chart";
import type { GeoSummary } from "@/types/geography";
import type { UserContext } from "@/types/alumni";

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

/** "Good morning/afternoon/evening" for the current (server) local hour. */
function timeOfDayGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
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
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="flex flex-1 flex-col">
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
    <ul className="space-y-3.5">
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
                className="-mx-2 flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1 transition hover:bg-brand-blue-50/40"
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
              const pct = Math.round((r.count / total) * 100);
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
                >
                  {/* Native SVG tooltip on hover — exact count + its share of the
                      charted total (a real proportion, not a trend metric). */}
                  <title>{`${r.label}: ${r.count} (${pct}%)`}</title>
                </circle>
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
                  aria-label={`View ${r.label} (${r.count}) in alumni list`}
                  title={`${r.label}: ${r.count}`}
                  className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-1.5 transition hover:bg-brand-blue-50/40"
                >
                  {body}
                </Link>
              ) : (
                <div
                  className="flex items-center gap-3 px-2 py-1.5"
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

/** A chip-shaped deep link with an optional leading icon. The whole row of
 *  these wraps, trading the old stacked list for a denser pill cluster. */
function FilterChip({
  label,
  href,
  icon: Icon,
}: {
  label: string;
  href: string;
  icon?: LucideIcon;
}) {
  return (
    <Chip asChild>
      <Link href={href}>
        {Icon ? <Icon aria-hidden="true" /> : null}
        {label}
      </Link>
    </Chip>
  );
}

/** A "Browse alumni" chip — segment label plus its live count, deep-linking to
 *  the pre-filtered alumni list. The count rides inside the pill so the cluster
 *  stays compact; an em dash shows when the count isn't available. */
function BrowseChip({
  label,
  value,
  href,
  icon: Icon,
}: {
  label: string;
  value: string;
  href: string;
  icon?: LucideIcon;
}) {
  return (
    <Chip asChild title={`${label}: ${value}`}>
      <Link href={href}>
        {Icon ? <Icon aria-hidden="true" /> : null}
        {label}
        <span className="ml-1 font-semibold tabular-nums text-gray-900">
          {value}
        </span>
      </Link>
    </Chip>
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
  let ctx: UserContext | null = null;
  let notProvisioned = false;
  try {
    [s, geoSum, ctx] = await Promise.all([
      apiGet<Summary>("/dashboard/summary", {
        revalidate: 60,
        tags: ["dashboard"],
      }),
      apiGet<GeoSummary>("/geography/summary", {
        revalidate: 60,
        tags: ["geography"],
      }),
      // Per-user, not cacheable — used only to greet the signed-in user by name.
      // Tolerated separately below so a context hiccup never blanks the page.
      apiGet<UserContext>("/auth/context").catch(() => null),
    ]);
  } catch (e) {
    if (e instanceof ApiError && e.status === 403) notProvisioned = true;
  }

  // "Good afternoon, Marcus" — name from the auth context (or a first name
  // derived from the email), with a no-name fallback. Never a fabricated name.
  const firstName = resolveFirstName(ctx);
  const greeting = firstName
    ? `${timeOfDayGreeting()}, ${firstName}`
    : timeOfDayGreeting();

  // Derived counts for the Browse stat tiles.
  const utahCount = s?.by_state?.find((r) => r.state === "UT")?.count;
  const recentGradCount = s?.by_graduation_year
    ?.filter((r) => r.year >= THIS_YEAR - 5)
    .reduce((sum, r) => sum + r.count, 0);
  const industries = geoSum?.top_industries ?? [];
  const ibPeCount = ["Investment Banking", "Private Equity"]
    .map((name) => industries.find((i) => i.industry === name)?.count ?? 0)
    .reduce((a, b) => a + b, 0);

  // Format a count for a Browse stat, or an em dash when unavailable.
  const stat = (n: number | undefined) =>
    typeof n === "number" ? n.toLocaleString() : "—";

  const quickFilters: { label: string; href: string; icon: LucideIcon }[] = [
    {
      label: "Recent grads",
      href: `/alumni?ymin=${recentMin}&ymax=${recentMax}`,
      icon: GraduationCap,
    },
    { label: "Willing mentors", href: "/alumni?mentor=1", icon: Handshake },
    {
      label: "Guest speakers this month",
      href: `/alumni?spoke_after=${monthStart}&spoke_before=${monthEnd}`,
      icon: Mic,
    },
    { label: "By location", href: "/map/breakdown/states", icon: MapPin },
    { label: "By industry", href: "/map/breakdown/industries", icon: Briefcase },
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
          /* Two columns that stretch to fill the viewport: quick-search
             features on the left half, KPIs + the two charts on the right. */
          <div className="flex min-h-full flex-col gap-5 lg:flex-row lg:items-stretch">
            {/* LEFT — greeting + search, then chip clusters for quick filters
                and browse-by-segment (denser than the old stacked rows). */}
            <div className="flex flex-1 flex-col gap-5">
              <SearchHero greeting={greeting} />
              <Card className="flex flex-1 flex-col">
                <CardHeader>
                  <CardTitle>Quick filters</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {quickFilters.map((f) => (
                      <FilterChip
                        key={f.label}
                        label={f.label}
                        href={f.href}
                        icon={f.icon}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
              <Card className="flex flex-1 flex-col">
                <CardHeader>
                  <CardTitle>Browse alumni</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    <BrowseChip
                      label="In Utah"
                      value={stat(utahCount)}
                      href="/alumni?state=UT"
                      icon={MapPin}
                    />
                    <BrowseChip
                      label="Recent grads"
                      value={stat(recentGradCount)}
                      href={`/alumni?ymin=${recentMin}&ymax=${recentMax}`}
                      icon={GraduationCap}
                    />
                    <BrowseChip
                      label="In IB / PE"
                      value={stat(ibPeCount)}
                      href="/alumni?industry=Investment%20Banking"
                      icon={Briefcase}
                    />
                    <BrowseChip
                      label="Willing mentors"
                      value={stat(s?.willing_mentors)}
                      href="/alumni?mentor=1"
                      icon={Handshake}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* RIGHT — KPI strip + the two charts */}
            <div className="flex flex-1 flex-col gap-5">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                <KpiTile
                  label="Total alumni"
                  value={s ? s.total_alumni.toLocaleString() : "—"}
                  icon={Users}
                  href="/alumni"
                  linkLabel="View all alumni"
                />
                <KpiTile
                  label="Contacted this month"
                  value={s ? s.contacted_this_month.toLocaleString() : "—"}
                  icon={PhoneCall}
                  href={`/alumni?contacted_after=${thirtyDaysAgo}`}
                  linkLabel="View alumni contacted this month"
                />
                <KpiTile
                  label="Attended this month"
                  value={s ? s.attended_event_this_month.toLocaleString() : "—"}
                  icon={CalendarCheck}
                  href={`/events?from=${thirtyDaysAgo}&to=${today}`}
                  linkLabel="View events held this month"
                />
              </div>
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
          </div>
        )}
      </main>
    </>
  );
}
