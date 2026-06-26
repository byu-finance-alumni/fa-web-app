import { apiGet, ApiError } from "@/lib/api";
import { Topbar } from "@/components/shell/Topbar";
import { TopbarSearch } from "@/components/shared/TopbarSearch";
import { RadiusControls } from "@/components/geography/RadiusControls";
import { RadiusResultsTable } from "@/components/geography/RadiusResultsTable";
import { RadiusExportButton } from "@/components/geography/RadiusExportButton";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { components } from "@/types/api.gen";

type RadiusPage = components["schemas"]["RadiusPage"];

const FILTER_KEYS = ["employer", "industry", "year", "region", "tag"] as const;

const DEFAULT_MILES = 25;
const RESULT_LIMIT = 200;

type SP = Record<string, string | undefined>;

function clampMiles(raw: string | undefined): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_MILES;
  return Math.min(250, Math.max(1, Math.round(n)));
}

export default async function RadiusSearchPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const lat = sp.lat;
  const lng = sp.lng;
  const miles = clampMiles(sp.miles);
  const place = sp.place;
  const hasCenter =
    !!lat && !!lng && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));

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
  const capped = total > items.length;

  return (
    <>
      <Topbar
        breadcrumb={[
          { label: "Map", href: "/map" },
          { label: "Radius search" },
        ]}
      >
        <TopbarSearch />
      </Topbar>

      <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
        <RadiusControls
          values={{
            lat,
            lng,
            miles,
            place,
            employer: sp.employer,
            industry: sp.industry,
            year: sp.year,
            region: sp.region,
            tag: sp.tag,
          }}
        />

        {forbidden ? (
          <Card className="p-4 text-sm text-gray-700">
            <p className="font-semibold text-gray-900">
              Radius search needs full access.
            </p>
            <p className="mt-1 text-gray-600">
              This view lists the individual alumni near a location, so it&apos;s
              limited to full-access accounts. Ask a Super Admin if you need it.
            </p>
          </Card>
        ) : loadError ? (
          <Card className="p-4 text-sm text-gray-700">
            <p className="font-semibold text-gray-900">
              Couldn&apos;t load results.
            </p>
            <p className="mt-1 text-gray-600">
              Something went wrong fetching alumni near this point. Try adjusting
              the center or radius.
            </p>
          </Card>
        ) : !hasCenter ? (
          <Card className="p-6 text-center text-sm text-gray-500">
            Search from a city, or click the map to drop a pin, to find alumni
            within a radius.
          </Card>
        ) : (
          <>
            {/* Count badge */}
            <Card className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="flex items-center gap-2">
                <Badge variant="solid" className="tabular-nums">
                  {total.toLocaleString()}
                </Badge>
                <span className="text-sm text-gray-700">
                  {total === 1 ? "alumnus" : "alumni"} within{" "}
                  <span className="font-semibold text-gray-900">{miles} mi</span>{" "}
                  of{" "}
                  <span className="font-semibold text-gray-900">
                    {centerLabel}
                  </span>
                  {capped ? (
                    <span className="text-gray-500">
                      {" "}
                      (showing nearest {items.length.toLocaleString()})
                    </span>
                  ) : null}
                </span>
              </div>
              <RadiusExportButton items={items} place={place} miles={miles} />
            </Card>

            {items.length === 0 ? (
              <Card className="p-6 text-center text-sm text-gray-500">
                No alumni found within {miles} mi of {centerLabel}. Try a larger
                radius or a different center.
              </Card>
            ) : (
              <RadiusResultsTable items={items} />
            )}
          </>
        )}
      </main>
    </>
  );
}
