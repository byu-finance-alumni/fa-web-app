import Link from "next/link";
import { Crosshair } from "lucide-react";
import { apiGet, ApiError } from "@/lib/api";
import { Topbar } from "@/components/shell/Topbar";
import { TopbarSearch } from "@/components/shared/TopbarSearch";
import { GeographyExplorer } from "@/components/geography/GeographyExplorer";
import { MapFilters } from "@/components/geography/MapFilters";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
      apiGet<GeoSummary>(`/geography/summary?${qs}`, {
        revalidate: 60,
        tags: ["geography"],
      }),
      apiGet<StateCount[]>(`/geography/states?${qs}`, {
        revalidate: 60,
        tags: ["geography"],
      }),
    ]);
  } catch (e) {
    if (e instanceof ApiError && e.status === 403) notProvisioned = true;
  }

  const counts: Record<string, number> = {};
  for (const s of states) counts[s.state] = s.alumni_count;

  return (
    <>
      <Topbar title="Alumni by State">
        <TopbarSearch />
      </Topbar>
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6 lg:overflow-hidden">
        <div className="mb-3 flex shrink-0 items-center justify-end">
          <Button asChild variant="secondary" size="sm">
            <Link href="/map/radius">
              <Crosshair className="h-4 w-4" aria-hidden="true" />
              Radius search
            </Link>
          </Button>
        </div>
        {notProvisioned ? (
          <Card className="p-4 text-sm text-gray-700">
            Your account is authenticated but not yet provisioned. Ask a Super
            Admin to grant your account a role to see data.
          </Card>
        ) : (
          <GeographyExplorer
            counts={counts}
            topStates={states}
            topCities={summary?.top_cities ?? []}
            filterQuery={qs}
            filters={
              <MapFilters
                hasFilters={!!qs}
                values={{
                  employer: sp.employer,
                  industry: sp.industry,
                  year: sp.year,
                  region: sp.region,
                  tag: sp.tag,
                }}
                options={{
                  employers: summary?.options.employers ?? [],
                  industries: summary?.options.industries ?? [],
                  graduation_years: (summary?.options.graduation_years ?? []).map(
                    String,
                  ),
                  regions: summary?.options.regions ?? [],
                  tags: summary?.options.tags ?? [],
                }}
              />
            }
          />
        )}
      </main>
    </>
  );
}
