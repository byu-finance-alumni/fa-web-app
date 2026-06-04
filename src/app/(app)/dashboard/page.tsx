import { apiGet, ApiError } from "@/lib/api";
import { Topbar } from "@/components/shell/Topbar";

interface Summary {
  total_alumni: number;
  archived: number;
  deceased: number;
  by_graduation_year: { year: number; count: number }[];
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-300 bg-white p-4">
      <p className="text-2xl font-semibold tabular-nums tracking-tight text-navy-800">
        {value}
      </p>
      <p className="mt-1 text-xs text-gray-500">{label}</p>
    </div>
  );
}

export default async function DashboardPage() {
  let s: Summary | null = null;
  let notProvisioned = false;
  try {
    s = await apiGet<Summary>("/dashboard/summary");
  } catch (e) {
    if (e instanceof ApiError && e.status === 403) notProvisioned = true;
  }

  const maxCount = s
    ? Math.max(1, ...s.by_graduation_year.map((d) => d.count))
    : 1;

  return (
    <>
      <Topbar title="Dashboard" />
      <main className="flex-1 overflow-auto p-6">
        <div className="mb-4">
          <h2 className="text-2xl font-semibold text-gray-900">Dashboard</h2>
          <p className="text-sm text-gray-500">BYU Finance Alumni</p>
        </div>

        {notProvisioned ? (
          <div className="mb-4 rounded-lg border border-gray-300 bg-white p-4 text-sm text-gray-700">
            Your account is authenticated but not yet provisioned. Ask a Super
            Admin to grant your account a role to see data.
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <Kpi label="Total alumni" value={s?.total_alumni.toString() ?? "—"} />
          <Kpi label="Archived" value={s?.archived.toString() ?? "—"} />
          <Kpi label="Deceased" value={s?.deceased.toString() ?? "—"} />
          <Kpi label="Missing email" value="—" />
          <Kpi label="Duplicate records" value="—" />
          <Kpi label="Upcoming follow-ups" value="—" />
        </div>

        {s && s.by_graduation_year.length > 0 ? (
          <section className="mt-4 rounded-xl border border-gray-300 bg-white p-5">
            <h3 className="mb-4 text-[15px] font-semibold text-gray-900">
              Alumni by graduation year
            </h3>
            <div className="flex items-end gap-3" style={{ height: 160 }}>
              {s.by_graduation_year.map((d) => (
                <div
                  key={d.year}
                  className="flex flex-1 flex-col items-center gap-2"
                >
                  <span className="text-[11px] tabular-nums text-gray-500">
                    {d.count}
                  </span>
                  <div
                    className="w-full rounded-t bg-navy-800"
                    style={{
                      height: `${Math.round((d.count / maxCount) * 120)}px`,
                    }}
                  />
                  <span className="text-[11px] tabular-nums text-gray-500">
                    &apos;{String(d.year).slice(-2)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <div className="mt-4 rounded-xl border border-gray-300 bg-white p-6 text-sm text-gray-500">
          Top employers, geographic map, and the activity feed render here once
          the supporting tables (employment, contact, interactions) are exposed.
        </div>
      </main>
    </>
  );
}
