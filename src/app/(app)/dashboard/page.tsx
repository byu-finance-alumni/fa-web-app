import { apiGet, ApiError } from "@/lib/api";
import type { AlumniPage } from "@/types/alumni";
import { Topbar } from "@/components/shell/Topbar";

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
  let total: number | null = null;
  let notProvisioned = false;
  try {
    const page = await apiGet<AlumniPage>("/alumni?limit=1");
    total = page.total;
  } catch (e) {
    if (e instanceof ApiError && e.status === 403) notProvisioned = true;
  }

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
          <Kpi label="Total alumni" value={total?.toString() ?? "—"} />
          <Kpi label="Missing email" value="—" />
          <Kpi label="Missing employer" value="—" />
          <Kpi label="Duplicate records" value="—" />
          <Kpi label="Contacted this month" value="—" />
          <Kpi label="Upcoming follow-ups" value="—" />
        </div>

        <div className="mt-4 rounded-xl border border-gray-300 bg-white p-6 text-sm text-gray-500">
          Charts (top employers, graduation cohort, map) and the activity feed
          render here once the supporting endpoints land. The data-quality
          metrics above light up as those tables are populated.
        </div>
      </main>
    </>
  );
}
