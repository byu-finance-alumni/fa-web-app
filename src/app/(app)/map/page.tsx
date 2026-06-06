import Link from "next/link";
import { apiGet, ApiError } from "@/lib/api";
import { Topbar } from "@/components/shell/Topbar";
import { TopbarSearch } from "@/components/shared/TopbarSearch";
import { GeographyExplorer } from "@/components/geography/GeographyExplorer";
import type { GeoSummary, StateCount } from "@/types/geography";

const FILTER_KEYS = ["employer", "industry", "year", "region", "tag"] as const;

type SP = Record<string, string | undefined>;

function filterQs(sp: SP): string {
  const p = new URLSearchParams();
  for (const k of FILTER_KEYS) if (sp[k]) p.set(k, sp[k]!);
  return p.toString();
}

export default async function GeographyPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const qs = filterQs(sp);

  let summary: GeoSummary | null = null;
  let states: StateCount[] = [];
  let notProvisioned = false;
  try {
    [summary, states] = await Promise.all([
      apiGet<GeoSummary>(`/geography/summary?${qs}`),
      apiGet<StateCount[]>(`/geography/states?${qs}`),
    ]);
  } catch (e) {
    if (e instanceof ApiError && e.status === 403) notProvisioned = true;
  }

  const counts: Record<string, number> = {};
  for (const s of states) counts[s.state] = s.alumni_count;

  return (
    <>
      <Topbar title="Map">
        <TopbarSearch />
      </Topbar>
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6 lg:overflow-hidden">
        {notProvisioned ? (
          <div className="rounded-xl border border-gray-300 bg-white p-4 text-sm text-gray-700">
            Your account is authenticated but not yet provisioned. Ask a Super
            Admin to grant your account a role to see data.
          </div>
        ) : (
          <GeographyExplorer
            counts={counts}
            topStates={states}
            topCities={summary?.top_cities ?? []}
            topEmployers={summary?.top_employers ?? []}
            topIndustries={summary?.top_industries ?? []}
            filterQuery={qs}
            initialState={sp.state ?? null}
            filters={
              <form method="get" className="flex flex-wrap items-end gap-2">
                <Filter
                  name="employer"
                  label="Employer"
                  value={sp.employer}
                  options={summary?.options.employers ?? []}
                />
                <Filter
                  name="industry"
                  label="Industry"
                  value={sp.industry}
                  options={summary?.options.industries ?? []}
                />
                <Filter
                  name="year"
                  label="Grad year"
                  value={sp.year}
                  options={(summary?.options.graduation_years ?? []).map(String)}
                />
                <Filter
                  name="region"
                  label="Region"
                  value={sp.region}
                  options={summary?.options.regions ?? []}
                />
                <Filter
                  name="tag"
                  label="Tag"
                  value={sp.tag}
                  options={summary?.options.tags ?? []}
                />
                <button
                  type="submit"
                  className="rounded-lg bg-brand-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-blue-500"
                >
                  Apply
                </button>
                {qs ? (
                  <Link
                    href="/map"
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Clear
                  </Link>
                ) : null}
              </form>
            }
          />
        )}
      </main>
    </>
  );
}

function Filter({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value?: string;
  options: string[];
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </span>
      <select
        name={name}
        defaultValue={value ?? ""}
        className="w-32 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-brand-blue-600"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
