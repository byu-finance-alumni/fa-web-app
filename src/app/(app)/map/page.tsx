import { apiGet, ApiError } from "@/lib/api";
import { Topbar } from "@/components/shell/Topbar";
import { TopbarSearch } from "@/components/shared/TopbarSearch";
import Link from "next/link";
import { GeographyExplorer } from "@/components/geography/GeographyExplorer";
import { MapFilters } from "@/components/geography/MapFilters";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { lookupCityGeo } from "@/lib/geo/counties-data";
import type {
  CountryCount,
  CountyCount,
  GeoSummary,
  StateCount,
} from "@/types/geography";
import type { components } from "@/types/api.gen";

type RadiusPage = components["schemas"]["RadiusPage"];

const FILTER_KEYS = ["industry", "employer", "year", "region", "tag"] as const;

const DEFAULT_MILES = 25;
const RESULT_LIMIT = 200;

type SP = Record<string, string | undefined>;

function filterQs(sp: SP): string {
  const p = new URLSearchParams();
  for (const k of FILTER_KEYS) if (sp[k]) p.set(k, sp[k]!);
  return p.toString();
}

function clampMiles(raw: string | undefined): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_MILES;
  return Math.min(250, Math.max(1, Math.round(n)));
}

export default async function GeographyPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const qs = filterQs(sp);

  // --- Map shading data (always fetched) --------------------------------------
  // States power the hover tooltip; counties power the choropleth (shade only the
  // counties where alumni actually work).
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

  // County choropleth (zoomed-in detail). Fetched tolerantly on its own so an
  // API without /geography/counties (e.g. prod before this ships) just disables
  // county shading rather than blanking the whole map.
  let counties: CountyCount[] = [];
  if (!notProvisioned) {
    try {
      counties = await apiGet<CountyCount[]>(`/geography/counties?${qs}`, {
        revalidate: 60,
        tags: ["geography"],
      });
    } catch {
      counties = [];
    }
  }

  // Per-country counts for the world view (#238). Fetched tolerantly like
  // counties so an API without /geography/countries just disables world shading
  // rather than blanking the map.
  let countries: CountryCount[] = [];
  if (!notProvisioned) {
    try {
      countries = await apiGet<CountryCount[]>(`/geography/countries?${qs}`, {
        revalidate: 60,
        tags: ["geography"],
      });
    } catch {
      countries = [];
    }
  }

  const counts: Record<string, number> = {};
  for (const s of states) counts[s.state] = s.alumni_count;

  const countyCounts: Record<string, number> = {};
  for (const c of counties) countyCounts[c.county_fips] = c.count;

  const countryCounts: Record<string, number> = {};
  for (const c of countries) countryCounts[c.country] = c.alumni_count;

  // --- Radius search (full_access-gated) — always on -------------------------
  const lat = sp.lat;
  const lng = sp.lng;
  const miles = clampMiles(sp.miles);
  const place = sp.place;
  const hasCenter =
    !!lat &&
    !!lng &&
    Number.isFinite(Number(lat)) &&
    Number.isFinite(Number(lng));

  let page: RadiusPage | null = null;
  let forbidden = false;
  let loadError = false;

  if (hasCenter) {
    const p = new URLSearchParams();
    p.set("lat", String(lat));
    p.set("lng", String(lng));
    p.set("miles", String(miles));
    p.set("limit", String(RESULT_LIMIT));
    for (const k of FILTER_KEYS) if (sp[k]) p.set(k, sp[k]!);
    try {
      page = await apiGet<RadiusPage>(`/geography/radius?${p.toString()}`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) forbidden = true;
      else loadError = true;
    }
  }

  const centerLabel = place || "this point";
  const items = page?.items ?? [];
  const total = page?.total ?? 0;

  // The counties that contain a matched alumnus (via the city -> county/FIPS
  // crosswalk) — the map outlines just these.
  const matchCounties = Array.from(
    new Set(
      items
        .map((it) =>
          it.city && it.state
            ? lookupCityGeo(it.city, it.state)?.countyFips
            : undefined,
        )
        .filter((f): f is string => !!f),
    ),
  );

  // Build a link into the alumni list filtered to the matched cities/states (so
  // it shows ~the same people) plus whichever geography filters were applied.
  // year maps to the alumni list's ymin/ymax (it accepts `year` for both).
  function alumniHref(): string {
    const p = new URLSearchParams();
    const cities = new Set<string>();
    const statesSet = new Set<string>();
    for (const it of items) {
      if (it.city) cities.add(it.city);
      if (it.state) statesSet.add(it.state);
    }
    for (const c of cities) p.append("city", c);
    for (const s of statesSet) p.append("state", s);
    if (sp.industry) p.set("industry", sp.industry);
    if (sp.employer) p.set("employer", sp.employer);
    if (sp.year) p.set("year", sp.year);
    if (sp.tag) p.set("tag", sp.tag);
    return `/alumni?${p.toString()}`;
  }

  const results = (
    <>
      {forbidden ? (
        <Card className="p-4 text-sm text-gray-700">
          <p className="font-semibold text-gray-900">
            Radius search needs full access.
          </p>
          <p className="mt-1 text-gray-600">
            This view counts the alumni near a location, so it&apos;s limited to
            full-access accounts. Ask a Super Admin if you need it.
          </p>
        </Card>
      ) : loadError ? (
        <Card className="p-4 text-sm text-gray-700">
          <p className="font-semibold text-gray-900">
            Couldn&apos;t load results.
          </p>
          <p className="mt-1 text-gray-600">
            Something went wrong searching near this point. Try adjusting the
            center or radius.
          </p>
        </Card>
      ) : !hasCenter ? null : (
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Badge variant="solid" className="text-base tabular-nums">
              {total.toLocaleString()}
            </Badge>
            <span className="text-sm text-gray-700">
              {total === 1 ? "alumnus" : "alumni"} within{" "}
              <span className="font-semibold text-gray-900">{miles} mi</span> of{" "}
              <span className="font-semibold text-gray-900">{centerLabel}</span>
            </span>
          </div>
          {total > 0 ? (
            <Button asChild className="mt-3 w-full">
              <Link href={alumniHref()}>View these alumni…</Link>
            </Button>
          ) : (
            <p className="mt-2 text-sm text-gray-500">
              Try a larger radius or a different center.
            </p>
          )}
        </Card>
      )}
    </>
  );

  return (
    <>
      <Topbar title="Alumni Map">
        <TopbarSearch />
      </Topbar>
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {notProvisioned ? (
          <div className="p-6">
            <Card className="p-4 text-sm text-gray-700">
              Your account is authenticated but not yet provisioned. Ask a Super
              Admin to grant your account a role to see data.
            </Card>
          </div>
        ) : (
          <GeographyExplorer
            counts={counts}
            countyCounts={countyCounts}
            countryCounts={countryCounts}
            hasCenter={hasCenter || forbidden || loadError}
            matchCounties={matchCounties}
            radius={{
              lat,
              lng,
              miles,
              place,
              industry: sp.industry,
              employer: sp.employer,
              year: sp.year,
              region: sp.region,
              tag: sp.tag,
            }}
            filters={
              <MapFilters
                hasFilters={!!qs}
                extraParams={{
                  lat,
                  lng,
                  place,
                  miles: String(miles),
                  employer: sp.employer,
                }}
                values={{
                  industry: sp.industry,
                  year: sp.year,
                  region: sp.region,
                  tag: sp.tag,
                }}
                options={{
                  industries: summary?.options.industries ?? [],
                  graduation_years: (summary?.options.graduation_years ?? []).map(
                    String,
                  ),
                  regions: summary?.options.regions ?? [],
                  tags: summary?.options.tags ?? [],
                }}
              />
            }
            results={results}
          />
        )}
      </main>
    </>
  );
}
