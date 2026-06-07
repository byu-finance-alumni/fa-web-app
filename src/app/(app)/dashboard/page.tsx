import Link from "next/link";
import { Users, Mail, Briefcase, Copy } from "lucide-react";
import { apiGet, ApiError } from "@/lib/api";
import { Topbar } from "@/components/shell/Topbar";
import { KpiDrawers } from "@/components/dashboard/KpiDrawers";
import { MetricCard } from "@/components/shared/MetricCard";
import { TopbarSearch } from "@/components/shared/TopbarSearch";
import { UsStateMap } from "@/components/geography/UsStateMap";
import type { StateCount } from "@/types/geography";

interface Summary {
  total_alumni: number;
  archived: number;
  deceased: number;
  missing_email: number;
  missing_employer: number;
  contacted_this_month: number;
  upcoming_follow_ups: number;
  duplicate_count: number;
  by_graduation_year: { year: number; count: number }[];
  top_employers: { employer: string; count: number }[];
  by_state: { state: string; count: number }[];
}

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
    <section className="rounded-xl border border-gray-300 bg-white p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="text-[15px] font-semibold text-gray-900">{title}</h3>
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

export default async function DashboardPage() {
  let s: Summary | null = null;
  let geo: StateCount[] = [];
  let notProvisioned = false;
  try {
    [s, geo] = await Promise.all([
      apiGet<Summary>("/dashboard/summary", {
        revalidate: 60,
        tags: ["dashboard"],
      }),
      apiGet<StateCount[]>("/geography/states", {
        revalidate: 60,
        tags: ["geography"],
      }),
    ]);
  } catch (e) {
    if (e instanceof ApiError && e.status === 403) notProvisioned = true;
  }
  const geoCounts: Record<string, number> = {};
  for (const st of geo) geoCounts[st.state] = st.alumni_count;

  const maxCohort = s
    ? Math.max(1, ...s.by_graduation_year.map((d) => d.count))
    : 1;

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
          <div className="space-y-4">
            {/* Row 1 — KPI strip (6 across) */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
              <MetricCard
                size="lg"
                icon={Users}
                label="Total alumni"
                value={s?.total_alumni ?? "—"}
                sub="Mock dataset"
                href="/alumni"
                linkLabel="View all alumni"
              />
              <MetricCard
                size="lg"
                icon={Mail}
                label="Missing email"
                value={s?.missing_email ?? "—"}
                sub="Needs enrichment"
                subTone="warning"
                href="/alumni?missing_email=1"
                linkLabel="View alumni missing an email"
              />
              <MetricCard
                size="lg"
                icon={Briefcase}
                label="Missing employer"
                value={s?.missing_employer ?? "—"}
                sub="Needs enrichment"
                subTone="warning"
                href="/alumni?missing_employer=1"
                linkLabel="View alumni missing an employer"
              />
              <MetricCard
                size="lg"
                icon={Copy}
                label="Duplicate records"
                value={s?.duplicate_count ?? "—"}
                sub="Review queue"
                subTone="danger"
                href="/alumni?duplicate=1"
                linkLabel="View potential duplicate records"
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
                  rows={(s?.top_employers ?? []).map((e) => ({
                    label: e.employer,
                    count: e.count,
                    href: `/alumni?employer=${encodeURIComponent(e.employer)}`,
                  }))}
                  emptyLabel="No employer data yet."
                />
              </Panel>

              <Panel title="Alumni by graduation year">
                {s && s.by_graduation_year.length > 0 ? (
                  <div className="flex items-end gap-3" style={{ height: 160 }}>
                    {s.by_graduation_year.map((d) => (
                      <Link
                        key={d.year}
                        href={`/alumni?ymin=${d.year}&ymax=${d.year}`}
                        aria-label={`View alumni who graduated in ${d.year}`}
                        title={`${d.count} alumni · class of ${d.year}`}
                        className="group flex h-full flex-1 cursor-pointer flex-col items-center justify-end gap-2 rounded-md transition hover:bg-brand-blue-50/40"
                      >
                        <div
                          className="w-full rounded-t bg-navy-800 transition group-hover:bg-brand-blue-600"
                          style={{
                            height: `${Math.round((d.count / maxCohort) * 120)}px`,
                          }}
                        />
                        <span className="text-[11px] tabular-nums text-gray-500 group-hover:text-brand-blue-600">
                          &apos;{String(d.year).slice(-2)}
                        </span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="py-4 text-sm text-gray-400">
                    No graduation-year data yet.
                  </p>
                )}
              </Panel>
            </div>

            {/* Row 3 — Alumni map (full width). Recent activity and data
                quality moved to their own pages (/activity, /data-quality). */}
            <Panel
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
              <div className="mx-auto max-w-3xl">
                <UsStateMap counts={geoCounts} selected={null} filterQuery="" />
              </div>
            </Panel>
          </div>
        )}
      </main>
    </>
  );
}
