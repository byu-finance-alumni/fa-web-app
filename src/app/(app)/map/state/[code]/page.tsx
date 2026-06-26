import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { apiGet, ApiError } from "@/lib/api";
import { Topbar } from "@/components/shell/Topbar";
import { TopbarSearch } from "@/components/shared/TopbarSearch";
import { UsStateMap } from "@/components/geography/UsStateMap";
import { CountyMap } from "@/components/geography/CountyMap";
import { MapFilters } from "@/components/geography/MapFilters";
import { Card } from "@/components/ui/card";
import { buildCountyMap } from "@/lib/geo/county-map";
import type { GeoSummary, StateCount, StateDetail } from "@/types/geography";

const FILTER_KEYS = ["employer", "industry", "year", "region", "tag"] as const;

type SP = Record<string, string | undefined>;

function filterQs(sp: SP): string {
  const p = new URLSearchParams();
  for (const k of FILTER_KEYS) if (sp[k]) p.set(k, sp[k]!);
  return p.toString();
}

export default async function StateMapPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<SP>;
}) {
  const { code: rawCode } = await params;
  const code = rawCode.toUpperCase();
  const sp = await searchParams;
  const qs = filterQs(sp);
  const mapHref = `/map${qs ? `?${qs}` : ""}`;

  let states: StateCount[] = [];
  let summary: GeoSummary | null = null;
  let detail: StateDetail | null = null;
  let notProvisioned = false;
  let loadError = false;
  try {
    // States power the whole choropleth; summary supplies the filter dropdown
    // options (same as the 50-state map); detail is this state's drill-down.
    [states, summary] = await Promise.all([
      apiGet<StateCount[]>(`/geography/states?${qs}`, {
        revalidate: 60,
        tags: ["geography"],
      }),
      apiGet<GeoSummary>(`/geography/summary?${qs}`, {
        revalidate: 60,
        tags: ["geography"],
      }),
    ]);
    try {
      detail = await apiGet<StateDetail>(`/geography/states/${code}?${qs}`, {
        revalidate: 60,
        tags: ["geography"],
      });
    } catch (e) {
      // Unknown/empty state (a code with no alumni) — fall through to an empty
      // rail rather than failing the whole page.
      if (e instanceof ApiError && e.status === 403) throw e;
    }
  } catch (e) {
    if (e instanceof ApiError && e.status === 403) notProvisioned = true;
    else loadError = true;
  }

  const counts: Record<string, number> = {};
  for (const s of states) counts[s.state] = s.alumni_count;

  const stateName =
    detail?.state_name ??
    states.find((s) => s.state === code)?.state_name ??
    code;
  const alumniCount = detail?.alumni_count ?? 0;

  // Build the county-level map for THIS state on the server (plain SVG out).
  // Returns null if the state's geometry isn't found — we fall back to the
  // zoomed 50-state map in that case so the card never goes blank.
  const countyMap = detail ? buildCountyMap(code, detail.cities ?? []) : null;

  return (
    <>
      <Topbar
        breadcrumb={[{ label: "Map", href: mapHref }, { label: stateName }]}
      >
        <TopbarSearch />
      </Topbar>
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6 lg:overflow-hidden">
        {notProvisioned ? (
          <Card className="p-4 text-sm text-gray-700">
            Your account is authenticated but not yet provisioned. Ask a Super
            Admin to grant your account a role to see data.
          </Card>
        ) : loadError ? (
          <div className="mx-auto max-w-5xl rounded-lg border border-danger-600/20 bg-danger-50 p-10 text-center">
            <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-danger-600" />
            <p className="text-sm font-semibold text-gray-900">
              Couldn’t load this state
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Something went wrong fetching the details.{" "}
              <Link
                href={mapHref}
                className="text-brand-blue-600 hover:text-brand-blue-500"
              >
                Back to the map
              </Link>{" "}
              and try again.
            </p>
          </div>
        ) : (
          /* Same layout as the 50-state /map view: dominant map on the left,
             ranking rail on the right — only the map is zoomed to this state. */
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-4 lg:grid-rows-1">
            {/* Map (left, dominant) */}
            <Card className="flex min-h-0 flex-col p-4 lg:col-span-3">
              <div className="mb-2 flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
                {/* Same filter dropdowns as the 50-state map, but they keep you
                    on this state (basePath → /map/state/CODE). */}
                <MapFilters
                  basePath={`/map/state/${code}`}
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
                    graduation_years: (
                      summary?.options.graduation_years ?? []
                    ).map(String),
                    regions: summary?.options.regions ?? [],
                    tags: summary?.options.tags ?? [],
                  }}
                />
                <span className="mr-3 shrink-0 self-start text-xl font-semibold text-gray-900">
                  {alumniCount.toLocaleString()} alumni
                </span>
              </div>
              <div className="min-h-0 flex-1">
                {countyMap ? (
                  <CountyMap {...countyMap} stateName={stateName} />
                ) : (
                  /* Fallback: state geometry not found (or no detail) — show the
                     zoomed 50-state map so the card never goes blank. */
                  <UsStateMap
                    fit
                    counts={counts}
                    selected={code}
                    focusState={code}
                  />
                )}
              </div>
            </Card>

            {/* Ranking rail (right) — same boxes/place as the main map */}
            <div className="flex min-h-0 flex-col gap-3">
              <RankBox
                title="Top cities"
                rows={(detail?.cities ?? []).map((c) => [c.city, c.count])}
              />
              <RankBox
                title="Top employers"
                rows={(detail?.employers ?? []).map((e) => [e.employer, e.count])}
              />
              <RankBox
                title="Top industries"
                rows={(detail?.industries ?? []).map((i) => [
                  i.industry,
                  i.count,
                ])}
              />
              <RankBox
                title="By graduation year"
                rows={(detail?.by_graduation_year ?? []).map((y) => [
                  String(y.year),
                  y.count,
                ])}
              />
            </div>
          </div>
        )}
      </main>
    </>
  );
}

/* ------------------------------------------------------------------ helpers */

/** Mirrors the RankBox used on the /map explorer so the rail looks identical:
 *  a compact label, an inline mini-bar showing relative magnitude, and a
 *  right-aligned tabular count. Presentation only — no map scale math here. */
function RankBox({ title, rows }: { title: string; rows: [string, number][] }) {
  const shown = rows.slice(0, 5);
  const max = Math.max(1, ...shown.map(([, count]) => count));
  return (
    <Card className="flex flex-col p-3">
      <h3 className="mb-1 text-sm font-semibold text-gray-900">{title}</h3>
      {rows.length === 0 ? (
        <p className="py-1.5 text-sm text-gray-400">No data yet.</p>
      ) : (
        <ul className="space-y-0.5">
          {shown.map(([label, count], i) => (
            <li
              key={`${label}-${i}`}
              title={`${label}: ${count.toLocaleString()} alumni`}
              className="flex items-center gap-2.5 px-1.5 py-1"
            >
              <span className="w-24 shrink-0 truncate text-sm text-gray-700">
                {label}
              </span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                <span
                  className="block h-full rounded-full bg-brand-blue-500"
                  style={{ width: `${Math.round((count / max) * 100)}%` }}
                />
              </span>
              <span className="w-9 shrink-0 text-right text-xs font-semibold tabular-nums text-gray-900">
                {count.toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
