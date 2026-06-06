import Link from "next/link";
import {
  Users,
  Mail,
  Briefcase,
  Copy,
  MessageSquare,
  CheckSquare,
} from "lucide-react";
import { apiGet, ApiError } from "@/lib/api";
import { Topbar } from "@/components/shell/Topbar";
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
  recent_activity: {
    interaction_id: number;
    alumni_id: number;
    alumni_name: string;
    type: string | null;
    when: string | null;
    by: string | null;
  }[];
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
  rows: { label: string; count: number }[];
  emptyLabel: string;
}) {
  if (rows.length === 0)
    return <p className="py-4 text-sm text-gray-400">{emptyLabel}</p>;
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label} className="flex items-center gap-3">
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
        </li>
      ))}
    </ul>
  );
}

const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : "";

export default async function DashboardPage() {
  let s: Summary | null = null;
  let geo: StateCount[] = [];
  let notProvisioned = false;
  try {
    [s, geo] = await Promise.all([
      apiGet<Summary>("/dashboard/summary"),
      apiGet<StateCount[]>("/geography/states"),
    ]);
  } catch (e) {
    if (e instanceof ApiError && e.status === 403) notProvisioned = true;
  }
  const geoCounts: Record<string, number> = {};
  for (const st of geo) geoCounts[st.state] = st.alumni_count;

  const maxCohort = s
    ? Math.max(1, ...s.by_graduation_year.map((d) => d.count))
    : 1;

  const alerts = [
    {
      label: `${s?.missing_email ?? 0} alumni missing an email`,
      show: (s?.missing_email ?? 0) > 0,
    },
    {
      label: `${s?.missing_employer ?? 0} alumni missing an employer`,
      show: (s?.missing_employer ?? 0) > 0,
    },
    {
      label: `${s?.duplicate_count ?? 0} potential duplicate records`,
      show: (s?.duplicate_count ?? 0) > 0,
    },
  ].filter((a) => a.show);

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
              />
              <MetricCard
                size="lg"
                icon={Mail}
                label="Missing email"
                value={s?.missing_email ?? "—"}
                sub="Needs enrichment"
                subTone="warning"
              />
              <MetricCard
                size="lg"
                icon={Briefcase}
                label="Missing employer"
                value={s?.missing_employer ?? "—"}
                sub="Needs enrichment"
                subTone="warning"
              />
              <MetricCard
                size="lg"
                icon={Copy}
                label="Duplicate records"
                value={s?.duplicate_count ?? "—"}
                sub="Review queue"
                subTone="danger"
              />
              <MetricCard
                size="lg"
                icon={MessageSquare}
                label="Contacted this month"
                value={s?.contacted_this_month ?? "—"}
                sub="Interactions"
                subTone="success"
              />
              <MetricCard
                size="lg"
                icon={CheckSquare}
                label="Upcoming follow-ups"
                value={s?.upcoming_follow_ups ?? "—"}
                sub="Tasks due"
              />
            </div>

            {/* Row 2 — Top employers | Cohort chart (equal halves) */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Panel title="Top employers">
                <BarList
                  rows={(s?.top_employers ?? []).map((e) => ({
                    label: e.employer,
                    count: e.count,
                  }))}
                  emptyLabel="No employer data yet."
                />
              </Panel>

              <Panel title="Alumni by graduation year">
                {s && s.by_graduation_year.length > 0 ? (
                  <div className="flex items-end gap-3" style={{ height: 160 }}>
                    {s.by_graduation_year.map((d) => (
                      <div
                        key={d.year}
                        className="flex flex-1 flex-col items-center gap-2"
                      >
                        <div
                          className="w-full rounded-t bg-navy-800"
                          style={{
                            height: `${Math.round((d.count / maxCohort) * 120)}px`,
                          }}
                        />
                        <span className="text-[11px] tabular-nums text-gray-500">
                          &apos;{String(d.year).slice(-2)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-4 text-sm text-gray-400">
                    No graduation-year data yet.
                  </p>
                )}
              </Panel>
            </div>

            {/* Row 3 — Recent activity | Data quality alerts (equal halves) */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Panel title="Recent activity">
                {s && s.recent_activity.length > 0 ? (
                  <ul className="space-y-3">
                    {s.recent_activity.map((r) => (
                      <li key={r.interaction_id} className="flex gap-3 text-sm">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-blue-600" />
                        <div className="min-w-0 flex-1">
                          <p className="text-gray-900">
                            <Link
                              href={`/alumni/${r.alumni_id}`}
                              className="font-medium hover:text-brand-blue-600"
                            >
                              {r.alumni_name}
                            </Link>
                            {r.type ? (
                              <span className="text-gray-500"> · {r.type}</span>
                            ) : null}
                          </p>
                          <p className="text-xs text-gray-500">
                            {fmtDate(r.when)}
                            {r.by ? ` · ${r.by}` : ""}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="py-4 text-sm text-gray-400">
                    No recent interactions logged.
                  </p>
                )}
              </Panel>

              <Panel title="Data quality alerts">
                {alerts.length > 0 ? (
                  <ul className="space-y-2">
                    {alerts.map((a) => (
                      <li
                        key={a.label}
                        className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2.5"
                      >
                        <span className="flex items-center gap-2.5 text-sm text-gray-700">
                          <span className="flex h-5 w-5 items-center justify-center rounded bg-navy-800 text-white">
                            <span className="h-1.5 w-1.5 rounded-sm bg-white" />
                          </span>
                          {a.label}
                        </span>
                        <Link
                          href="/alumni"
                          className="shrink-0 text-sm font-medium text-brand-blue-600 hover:text-brand-blue-500"
                        >
                          Review
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="py-4 text-sm text-gray-400">
                    No data-quality issues flagged.
                  </p>
                )}
              </Panel>
            </div>

            {/* Row 4 — Alumni map (full width) */}
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
