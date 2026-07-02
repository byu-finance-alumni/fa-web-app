"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2 } from "lucide-react";
import {
  geoCentroid,
  geoGraticule,
  geoNaturalEarth1,
  geoPath,
} from "d3-geo";
import { feature } from "topojson-client";
import worldTopo from "world-atlas/countries-110m.json";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { Topology } from "topojson-specification";
import {
  geocodePlace,
  getCountryDetail,
  resolveState,
  reverseGeocode,
  type CountryDetailResult,
} from "@/app/(app)/map/actions";
import { INDUSTRY_OPTIONS } from "@/constants/dropdowns";
import {
  FALLBACK_CENTROIDS,
  normalizeCountryName,
  US_CANONICAL,
} from "@/lib/geo/world-countries";
import { UsGeoMap } from "./UsGeoMap";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const RADIUS_PRESETS = [10, 25, 50, 100] as const;
const MIN_MILES = 1;
const MAX_MILES = 250;
// Filter params preserved across radius navigations. `employer` (Company) and
// `industry` are also map-wide filters the server applies to the choropleth.
const FILTER_KEYS = ["industry", "employer", "year", "region", "tag"] as const;

// The map search box is unified (#214): one field resolves whatever you type,
// in this order — a US state (full name or 2-letter code) drills into that
// state; a term matching a known industry re-shades the map by industry; a
// place geocodes to a radius center; anything else is treated as a company
// (employer) filter. See onSearch for the logic.

export interface RadiusState {
  lat?: string;
  lng?: string;
  miles: number;
  place?: string;
  industry?: string;
  employer?: string;
  year?: string;
  region?: string;
  tag?: string;
}

/**
 * The map workspace, Marketplace-style: one full-bleed geo-projected US map fills
 * the content area as the hero, with compact control Cards floating OVER it.
 * Proximity search is always on — click the map to drop a pin (center) or search
 * a city; scroll to zoom, drag to pan, more detail (counties + city labels) as
 * you zoom in. A radius preset/slider sets the distance; when a center is set the
 * results float in a collapsible panel pinned bottom-right (count badge + table +
 * CSV export) instead of pushing the map down. The grouped Filters control + the
 * results both come from the server via the URL searchParams.
 */
export function GeographyExplorer({
  counts,
  countyCounts,
  countryCounts,
  radius,
  filters,
  results,
  hasCenter: hasCenterProp,
  matchCounties,
}: {
  counts: Record<string, number>;
  /** Per-county alumni counts (FIPS → count) for the county choropleth. */
  countyCounts?: Record<string, number>;
  /** Per-country alumni counts (country name → count) for the world view. */
  countryCounts?: Record<string, number>;
  radius: RadiusState;
  /** The grouped "Filters" control (industry/year/region/tag). */
  filters: ReactNode;
  /** Radius results (count badge + table + export), rendered by the server. */
  results: ReactNode;
  /** Whether a valid radius center is set (drives the floating results panel). */
  hasCenter: boolean;
  /** County FIPS that contain a matched alumnus — outlined on the map. */
  matchCounties?: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const hasCenter = !!radius.lat && !!radius.lng;
  const center = hasCenter
    ? { lat: Number(radius.lat), lng: Number(radius.lng) }
    : null;

  const [miles, setMiles] = useState(radius.miles);
  useEffect(() => setMiles(radius.miles), [radius.miles]);
  const [geoError, setGeoError] = useState<string | null>(null);
  // Non-blocking note (e.g. a bare city name that spans several states).
  const [geoNote, setGeoNote] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  // US ↔ World map toggle (#213). The US view is the full interactive map; the
  // world view is wired behind a `WorldGeoMap` that loads a world topojson when
  // the asset is present (see note in that component).
  const [mapView, setMapView] = useState<"us" | "world">("us");
  // Seed the box with the active employer/industry filter or the resolved place
  // so it reflects the current URL state.
  const [searchInput, setSearchInput] = useState(
    radius.employer ?? radius.industry ?? radius.place ?? "",
  );
  // Results panel starts open whenever there's a center; collapsible to reveal
  // the map underneath, Marketplace-style.
  const [resultsOpen, setResultsOpen] = useState(true);
  useEffect(() => {
    if (hasCenterProp) setResultsOpen(true);
  }, [hasCenterProp]);

  const buildRadiusUrl = useCallback(
    (over: Partial<RadiusState>) => {
      const merged = { ...radius, ...over };
      const p = new URLSearchParams();
      if (merged.lat) p.set("lat", String(merged.lat));
      if (merged.lng) p.set("lng", String(merged.lng));
      if (merged.place) p.set("place", merged.place);
      p.set("miles", String(merged.miles));
      for (const k of FILTER_KEYS) {
        const v = merged[k];
        if (v) p.set(k, v);
      }
      return `/map?${p.toString()}`;
    },
    [radius],
  );

  // Build a /map URL that sets/clears a single map-wide filter param (industry
  // or employer) while preserving the radius center + all other filters.
  const buildFilterUrl = useCallback(
    (key: "industry" | "employer", value: string | undefined) => {
      const merged: RadiusState = { ...radius, [key]: value || undefined };
      const p = new URLSearchParams();
      if (merged.lat) p.set("lat", String(merged.lat));
      if (merged.lng) p.set("lng", String(merged.lng));
      if (merged.place) p.set("place", merged.place);
      p.set("miles", String(merged.miles));
      for (const k of FILTER_KEYS) {
        const v = merged[k];
        if (v) p.set(k, v);
      }
      return `/map?${p.toString()}`;
    },
    [radius],
  );

  // Clear BOTH map-wide filters (industry + employer) while keeping the radius
  // center and other filters — used when the unified search box is submitted
  // empty (reset the shading).
  const buildClearFiltersUrl = useCallback(() => {
    const merged: RadiusState = {
      ...radius,
      industry: undefined,
      employer: undefined,
    };
    const p = new URLSearchParams();
    if (merged.lat) p.set("lat", String(merged.lat));
    if (merged.lng) p.set("lng", String(merged.lng));
    if (merged.place) p.set("place", merged.place);
    p.set("miles", String(merged.miles));
    for (const k of FILTER_KEYS) {
      const v = merged[k];
      if (v) p.set(k, v);
    }
    return `/map?${p.toString()}`;
  }, [radius]);

  // Unified map search (#214): one box, resolved in priority order — US state
  // (name/code) → known industry → city (geocode → radius center) → otherwise a
  // company (employer) filter. An empty submit clears the industry/employer
  // shading.
  async function onSearch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const query = searchInput.trim();
    setGeoError(null);
    setGeoNote(null);

    if (!query) {
      startTransition(() => router.push(buildClearFiltersUrl()));
      return;
    }

    setSearching(true);
    try {
      // 1) A US state (full name or 2-letter code) → drill into its map.
      const state = await resolveState(query);
      if (state.ok) {
        startTransition(() => router.push(`/map/state/${state.code}`));
        return;
      }

      // 2) A known industry (controlled vocabulary, case-insensitive) →
      //    re-shade the whole map by that industry.
      const industry = INDUSTRY_OPTIONS.find(
        (o) => o.toLowerCase() === query.toLowerCase(),
      );
      if (industry) {
        startTransition(() => router.push(buildFilterUrl("industry", industry)));
        return;
      }

      // 3) A place → geocode to a radius center.
      const geo = await geocodePlace(query);
      if (geo.ok) {
        if (geo.spannedStates && geo.spannedStates.length) {
          const shown = geo.spannedStates.slice(0, 5).join(", ");
          const more = geo.spannedStates.length > 5 ? ", …" : "";
          setGeoNote(
            `"${geo.label.split(",")[0]}" is also in ${shown}${more}. Showing ${geo.label} — add a state to pick another.`,
          );
        }
        startTransition(() =>
          router.push(
            buildRadiusUrl({
              lat: String(geo.lat),
              lng: String(geo.lng),
              place: geo.label,
            }),
          ),
        );
        return;
      }

      // 4) Otherwise treat it as a company (employer) filter.
      startTransition(() => router.push(buildFilterUrl("employer", query)));
    } finally {
      setSearching(false);
    }
  }

  function applyMiles(next: number) {
    const clamped = Math.min(MAX_MILES, Math.max(MIN_MILES, Math.round(next)));
    startTransition(() => router.push(buildRadiusUrl({ miles: clamped })));
  }
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function onSlider(next: number) {
    setMiles(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => applyMiles(next), 350);
  }
  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  async function onPick(lat: number, lng: number) {
    setGeoError(null);
    setGeoNote(null);
    // Reverse-geocode the pin to the nearest city so the label reads as a place.
    const name = await reverseGeocode(lat, lng).catch(() => null);
    if (name) {
      setSearchInput(name);
    }
    startTransition(() =>
      router.push(
        buildRadiusUrl({
          lat: lat.toFixed(5),
          lng: lng.toFixed(5),
          place: name ?? "Pinned location",
        }),
      ),
    );
  }

  // Clear the radius center/pin (keep the radius distance + filters).
  function resetCenter() {
    setGeoError(null);
    setGeoNote(null);
    setSearchInput("");
    const p = new URLSearchParams();
    p.set("miles", String(radius.miles));
    for (const k of FILTER_KEYS) {
      const v = radius[k];
      if (v) p.set(k, v);
    }
    startTransition(() => router.push(`/map?${p.toString()}`));
  }

  return (
    <div className="relative min-h-0 flex-1">
      {/* Full-bleed map — the hero. Click to drop a pin, scroll to zoom, drag to
          pan; counties + city labels fade in as you zoom. Toggle to the world
          view (#213) swaps in the world map. */}
      <div className="absolute inset-0">
        {mapView === "us" ? (
          <UsGeoMap
            mode="radius"
            counts={counts}
            countyCounts={countyCounts}
            center={center}
            miles={miles}
            onPick={onPick}
            onResetCenter={resetCenter}
            matchCounties={matchCounties}
          />
        ) : (
          <WorldGeoMap
            countryCounts={countryCounts ?? {}}
            filters={{
              industry: radius.industry,
              employer: radius.employer,
              year: radius.year,
              region: radius.region,
              tag: radius.tag,
            }}
          />
        )}
      </div>

      {/* Top-center: US / World view toggle — text-style segmented control. */}
      <div className="absolute left-1/2 top-4 z-20 -translate-x-1/2">
        <div
          role="tablist"
          aria-label="Map view"
          className="flex gap-1 rounded-lg bg-white/95 p-1 shadow-card"
        >
          {(["us", "world"] as const).map((v) => {
            const active = mapView === v;
            return (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setMapView(v)}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500 focus-visible:ring-offset-1",
                  active
                    ? "bg-brand-blue-600 text-white"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
                )}
              >
                {v === "us" ? "United States" : "World"}
              </button>
            );
          })}
        </div>
      </div>

      {/* Global pending shimmer over the whole map. */}
      {pending ? (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-start justify-center pt-6">
          <span className="flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-gray-700 shadow-card">
            <Loader2
              className="h-4 w-4 animate-spin text-brand-blue-600"
              aria-hidden="true"
            />
            Updating…
          </span>
        </div>
      ) : null}

      {/* Top-left: multi-dimension search (City / State / Industry / Company) +
          grouped Filters, floating over the map. */}
      <div className="absolute left-4 top-4 z-20 w-[min(24rem,calc(100%-2rem))]">
        <Card className="p-3">
          <form onSubmit={onSearch} className="space-y-2">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <Input
                  value={searchInput}
                  onChange={(e) => {
                    setSearchInput(e.target.value);
                    if (geoError) setGeoError(null);
                  }}
                  placeholder="Search a city, state, industry, or company"
                  aria-label="Search the map by city, state, industry, or company"
                  aria-invalid={geoError ? true : undefined}
                />
                {geoError ? (
                  <p className="mt-1.5 text-xs text-danger-600">{geoError}</p>
                ) : null}
                {geoNote ? (
                  <p className="mt-1.5 text-xs text-gray-500">{geoNote}</p>
                ) : null}
              </div>
              <Button type="submit" disabled={searching || pending}>
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Search
              </Button>
            </div>
          </form>

          {/* Active map-wide filters (Company/Industry) — clearable inline. */}
          {radius.employer || radius.industry ? (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
              {radius.employer ? (
                <button
                  type="button"
                  onClick={() =>
                    startTransition(() =>
                      router.push(buildFilterUrl("employer", undefined)),
                    )
                  }
                  className="rounded-md border border-gray-300 px-2 py-0.5 text-gray-700 hover:bg-gray-50"
                  title="Clear company filter"
                >
                  Company: {radius.employer} ✕
                </button>
              ) : null}
              {radius.industry ? (
                <button
                  type="button"
                  onClick={() =>
                    startTransition(() =>
                      router.push(buildFilterUrl("industry", undefined)),
                    )
                  }
                  className="rounded-md border border-gray-300 px-2 py-0.5 text-gray-700 hover:bg-gray-50"
                  title="Clear industry filter"
                >
                  Industry: {radius.industry} ✕
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="mt-2.5 flex items-center justify-between gap-2">
            <p className="min-w-0 truncate text-xs">
              {radius.place ? (
                <span className="font-medium text-gray-900">{radius.place}</span>
              ) : hasCenter ? (
                <span className="font-medium text-gray-900">Pinned location</span>
              ) : (
                <span className="text-gray-500">Click the map to drop a pin.</span>
              )}
            </p>
            {filters}
          </div>
        </Card>

        {/* Radius distance control — US/radius view only. */}
        {mapView === "us" ? (
        <Card className="mt-3 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-gray-700">Radius</span>
            <span className="text-sm font-semibold tabular-nums text-gray-900">
              {miles} mi
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {RADIUS_PRESETS.map((p) => {
              const active = miles === p;
              return (
                <button
                  key={p}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setMiles(p);
                    applyMiles(p);
                  }}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500 focus-visible:ring-offset-1",
                    active
                      ? "bg-brand-blue-600 text-white"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
                  )}
                >
                  {p} mi
                </button>
              );
            })}
          </div>
          <input
            type="range"
            min={MIN_MILES}
            max={MAX_MILES}
            value={miles}
            onChange={(e) => onSlider(Number(e.target.value))}
            aria-label="Search radius in miles"
            className={cn(
              "mt-3 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-gray-200 accent-brand-blue-600",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500 focus-visible:ring-offset-1",
            )}
          />
        </Card>
        ) : null}
      </div>

      {/* Bottom-right: radius results, floating + scrollable + collapsible. Only
          when a center is set (US/radius view) — otherwise the map stays clear. */}
      {hasCenterProp && mapView === "us" ? (
        <div className="absolute bottom-4 right-4 z-20 w-[min(40rem,calc(100%-2rem))]">
          <Card className="flex max-h-[min(70vh,32rem)] flex-col overflow-hidden">
            <button
              type="button"
              onClick={() => setResultsOpen((o) => !o)}
              aria-expanded={resultsOpen}
              className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-200 px-4 py-2.5 text-left hover:bg-gray-50"
            >
              <span className="text-sm font-semibold text-gray-900">
                Results near {radius.place || "this point"}
              </span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-gray-500 transition-transform",
                  resultsOpen ? "rotate-180" : "",
                )}
                aria-hidden="true"
              />
            </button>
            {resultsOpen ? (
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
                {results}
              </div>
            ) : null}
          </Card>
        </div>
      ) : null}
    </div>
  );
}

/* ----------------------------------------------------------------- world map */

const WORLD_W = 960;
const WORLD_H = 500;
const WORLD_MIN_K = 1;
const WORLD_MAX_K = 8;

// Country choropleth buckets — same palette family as the US map (UsGeoMap
// BUCKETS), tuned to the smaller international counts. Countries with no alumni
// stay a neutral base so only the ones that carry alumni read as colored.
const COUNTRY_BUCKETS: { min: number; fill: string }[] = [
  { min: 25, fill: "#1C2E54" },
  { min: 10, fill: "#3B5C9A" },
  { min: 5, fill: "#5B7BB4" },
  { min: 1, fill: "#9DB2D8" },
];
const NEUTRAL_COUNTRY = "#E7EDF7";

function countryFill(count: number): string {
  if (count <= 0) return NEUTRAL_COUNTRY;
  return (
    COUNTRY_BUCKETS.find((b) => count >= b.min) ??
    COUNTRY_BUCKETS[COUNTRY_BUCKETS.length - 1]
  ).fill;
}

// Bubble radius (g-space units) from a count — sqrt scale so area ∝ count, with
// a floor/ceiling so a single alumnus is still visible and a hub never dominates.
function bubbleRadius(count: number): number {
  return Math.max(5, Math.min(22, 4 + Math.sqrt(count) * 4));
}

type WorldFilters = {
  industry?: string;
  employer?: string;
  year?: string;
  region?: string;
  tag?: string;
};

/**
 * World view (#213). Renders a `geoNaturalEarth1` world map with real country
 * shapes (Phase A, #237 — the `world-atlas` topojson is bundled), shades each
 * country by its alumni count and plots a count bubble at its centroid
 * (Phase B, #238), and opens an aggregate drill-down panel when a country is
 * clicked (Phase C, #239). Scroll to zoom, drag to pan — mirroring the US map's
 * `{k,x,y}` transform so the interaction feels identical.
 *
 * Counts come pre-filtered from the server (the same industry/company/year/tag
 * filters the US choropleth uses), so re-shading on a filter change is handled
 * by the page refetch; the drill-down forwards the same filters to stay
 * consistent. International location is country-level (centroids) by design —
 * city-level international geocoding is a separate, larger data project.
 */
function WorldGeoMap({
  countryCounts,
  filters,
}: {
  countryCounts: Record<string, number>;
  filters: WorldFilters;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Zoom/pan transform (g-space -> outer viewBox), identical model to UsGeoMap.
  const [view, setView] = useState({ k: 1, x: 0, y: 0 });
  const drag = useRef<{ active: boolean; ox: number; oy: number; moved: boolean }>(
    { active: false, ox: 0, oy: 0, moved: false },
  );

  const [hover, setHover] = useState<{
    name: string;
    count: number;
    x: number;
    y: number;
  } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<CountryDetailResult | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const projection = useMemo(
    () =>
      geoNaturalEarth1().fitExtent(
        [
          [10, 10],
          [WORLD_W - 10, WORLD_H - 10],
        ],
        { type: "Sphere" } as const,
      ),
    [],
  );

  const graticulePath = useMemo(
    () => geoPath(projection)(geoGraticule()()) || "",
    [projection],
  );
  const spherePath = useMemo(
    () => geoPath(projection)({ type: "Sphere" } as const) || "",
    [projection],
  );

  // Country polygons + display name + centroid, from the bundled topojson.
  const countries = useMemo(() => {
    const topo = worldTopo as unknown as Topology;
    const obj = topo.objects?.countries;
    if (!obj) return [];
    const fc = feature(topo, obj) as unknown as FeatureCollection<Geometry>;
    const path = geoPath(projection);
    return fc.features
      .map((f) => {
        const name = (f.properties as { name?: string } | null)?.name ?? "";
        return {
          key: normalizeCountryName(name),
          name,
          d: path(f) || "",
          centroid: geoCentroid(f as Feature) as [number, number],
        };
      })
      .filter((c) => c.d);
  }, [projection]);

  // Fold the incoming counts by canonical key (dropping the US + zeros), keeping
  // a display spelling for labels/drill-down.
  const countsByKey = useMemo(() => {
    const m = new Map<string, { count: number; display: string }>();
    for (const [rawName, count] of Object.entries(countryCounts)) {
      const key = normalizeCountryName(rawName);
      if (!key || key === US_CANONICAL || !count) continue;
      const prev = m.get(key);
      m.set(key, {
        count: (prev?.count ?? 0) + count,
        display: prev?.display ?? rawName.trim(),
      });
    }
    return m;
  }, [countryCounts]);

  // Bubble anchors in g-space: each country's centroid (from the topojson, or a
  // fallback for microstates too small to appear in the low-res atlas), sorted
  // so the biggest bubble draws on top.
  const bubbles = useMemo(() => {
    const centroidByKey = new Map<string, [number, number]>();
    for (const c of countries) centroidByKey.set(c.key, c.centroid);
    const out: {
      key: string;
      display: string;
      count: number;
      gx: number;
      gy: number;
    }[] = [];
    for (const [key, { count, display }] of countsByKey) {
      const lnglat = centroidByKey.get(key) ?? FALLBACK_CENTROIDS[key];
      if (!lnglat) continue;
      const pt = projection(lnglat);
      if (!pt || !Number.isFinite(pt[0]) || !Number.isFinite(pt[1])) continue;
      out.push({ key, display, count, gx: pt[0], gy: pt[1] });
    }
    return out.sort((a, b) => a.count - b.count);
  }, [countries, countsByKey, projection]);

  const totalPlotted = useMemo(
    () => bubbles.reduce((n, b) => n + b.count, 0),
    [bubbles],
  );

  // --- pan/zoom (mirrors UsGeoMap) --------------------------------------------
  function toOuter(clientX: number, clientY: number): [number, number] | null {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return [p.x, p.y];
  }

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const outer = toOuter(e.clientX, e.clientY);
      if (!outer) return;
      const [mx, my] = outer;
      setView((v) => {
        const factor = e.deltaY < 0 ? 1.2 : 1 / 1.2;
        const k = Math.min(WORLD_MAX_K, Math.max(WORLD_MIN_K, v.k * factor));
        if (k === WORLD_MIN_K) return { k: 1, x: 0, y: 0 };
        const ratio = k / v.k;
        return { k, x: mx - ratio * (mx - v.x), y: my - ratio * (my - v.y) };
      });
    }
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, []);

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    const outer = toOuter(e.clientX, e.clientY);
    if (!outer) return;
    drag.current = { active: true, ox: outer[0], oy: outer[1], moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!drag.current.active) return;
    const outer = toOuter(e.clientX, e.clientY);
    if (!outer) return;
    const dx = outer[0] - drag.current.ox;
    const dy = outer[1] - drag.current.oy;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.current.moved = true;
    drag.current.ox = outer[0];
    drag.current.oy = outer[1];
    setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
  }
  function onPointerUp(e: React.PointerEvent<SVGSVGElement>) {
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
    drag.current.active = false;
  }

  // --- drill-down -------------------------------------------------------------
  const openCountry = useCallback(
    (display: string) => {
      if (drag.current.moved) {
        drag.current.moved = false;
        return;
      }
      setSelected(display);
      setDetail(null);
      setDetailLoading(true);
      getCountryDetail(display, filters)
        .then((r) => setDetail(r))
        .catch(() => setDetail({ ok: false, forbidden: false }))
        .finally(() => setDetailLoading(false));
    },
    [filters],
  );

  function moveHover(e: React.MouseEvent, name: string, count: number) {
    const rect = wrapRef.current?.getBoundingClientRect();
    setHover({
      name,
      count,
      x: e.clientX - (rect?.left ?? 0),
      y: e.clientY - (rect?.top ?? 0),
    });
  }

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WORLD_W} ${WORLD_H}`}
        preserveAspectRatio="xMidYMid meet"
        className={cn(
          "absolute inset-0 h-full w-full touch-none select-none bg-brand-blue-50/30",
          view.k > 1 ? "cursor-grab" : "",
        )}
        role="img"
        aria-label="World map of alumni by country. Scroll to zoom, drag to pan."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {/* Shaded countries + graticule pan/zoom together in g-space. */}
        <g transform={`translate(${view.x}, ${view.y}) scale(${view.k})`}>
          <path d={spherePath} fill="#FFFFFF" stroke="#CBD5E1" strokeWidth={1} />
          <path
            d={graticulePath}
            fill="none"
            stroke="#E2E8F0"
            strokeWidth={0.5}
          />
          {countries.map((c, i) => {
            const entry = countsByKey.get(c.key);
            const count = entry?.count ?? 0;
            const interactive = count > 0;
            return (
              <path
                key={c.name || i}
                d={c.d}
                fill={countryFill(count)}
                stroke="#9DB2D8"
                strokeWidth={0.5}
                vectorEffect="non-scaling-stroke"
                className={interactive ? "cursor-pointer" : undefined}
                aria-label={
                  interactive ? `${c.name}: ${count} alumni` : undefined
                }
                onMouseEnter={
                  interactive
                    ? (e) => moveHover(e, entry!.display, count)
                    : undefined
                }
                onMouseMove={
                  interactive
                    ? (e) => moveHover(e, entry!.display, count)
                    : undefined
                }
                onMouseLeave={() => setHover(null)}
                onClick={
                  interactive ? () => openCountry(entry!.display) : undefined
                }
              />
            );
          })}
        </g>

        {/* Count bubbles in OUTER coords (project centroid, then apply the zoom
            transform) so they stay a constant on-screen size at any zoom — the
            same trick the US map uses for its pin. */}
        {bubbles.map((b) => {
          const ox = view.x + view.k * b.gx;
          const oy = view.y + view.k * b.gy;
          if (ox < -40 || ox > WORLD_W + 40 || oy < -40 || oy > WORLD_H + 40)
            return null;
          const r = bubbleRadius(b.count);
          const active = selected === b.display;
          return (
            <g
              key={b.key}
              transform={`translate(${ox}, ${oy})`}
              className="cursor-pointer"
              onMouseEnter={(e) => moveHover(e, b.display, b.count)}
              onMouseMove={(e) => moveHover(e, b.display, b.count)}
              onMouseLeave={() => setHover(null)}
              onClick={() => openCountry(b.display)}
            >
              <circle
                r={r}
                fill="#1C2E54"
                fillOpacity={0.85}
                stroke={active ? "#F59E0B" : "#FFFFFF"}
                strokeWidth={active ? 2.5 : 1.5}
              />
              <text
                textAnchor="middle"
                dy="0.35em"
                className="pointer-events-none fill-white text-[11px] font-semibold tabular-nums"
              >
                {b.count.toLocaleString()}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Hover tooltip. */}
      {hover ? (
        <div
          className="pointer-events-none absolute z-30 -translate-x-1/2 rounded-md bg-gray-900/95 px-2 py-1 text-xs text-white shadow-card"
          style={{ left: hover.x, top: hover.y - 10 }}
        >
          <p className="font-semibold">{hover.name}</p>
          <p className="tabular-nums text-gray-200">
            {hover.count.toLocaleString()} alumni
          </p>
        </div>
      ) : null}

      {/* Empty state — no international alumni to plot (all alumni are US, or a
          filter excluded everyone). The map still renders for context. */}
      {bubbles.length === 0 ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
          <p className="max-w-md rounded-lg bg-white/95 px-4 py-2 text-center text-xs text-gray-600 shadow-card">
            No international alumni to plot yet. Alumni located outside the US
            appear here as country bubbles.
          </p>
        </div>
      ) : (
        <div className="pointer-events-none absolute bottom-4 left-4 z-10 rounded-md bg-white/90 px-2.5 py-1.5 text-xs text-gray-600 shadow-card">
          <span className="font-semibold text-gray-900 tabular-nums">
            {totalPlotted.toLocaleString()}
          </span>{" "}
          international {totalPlotted === 1 ? "alumnus" : "alumni"} in{" "}
          <span className="font-semibold text-gray-900 tabular-nums">
            {bubbles.length}
          </span>{" "}
          {bubbles.length === 1 ? "country" : "countries"}
        </div>
      )}

      {/* Country drill-down panel (Phase C) — floats bottom-right, mirroring the
          US radius results panel. */}
      {selected ? (
        <div className="absolute bottom-4 right-4 z-20 w-[min(24rem,calc(100%-2rem))]">
          <Card className="flex max-h-[min(70vh,28rem)] flex-col overflow-hidden">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-200 px-4 py-2.5">
              <span className="truncate text-sm font-semibold text-gray-900">
                {selected}
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelected(null);
                  setDetail(null);
                }}
                className="rounded-md px-1.5 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                aria-label="Close country details"
              >
                ✕
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 text-sm">
              {detailLoading ? (
                <p className="flex items-center gap-2 text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Loading…
                </p>
              ) : detail && !detail.ok ? (
                <p className="text-gray-600">
                  {detail.forbidden
                    ? "Country details need full access."
                    : "Couldn't load details for this country."}
                </p>
              ) : detail && detail.ok ? (
                <CountryDetailBody detail={detail.detail} />
              ) : null}
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

/** Renders the aggregate breakdown for one country in the drill-down panel. */
function CountryDetailBody({
  detail,
}: {
  detail: NonNullable<Extract<CountryDetailResult, { ok: true }>["detail"]>;
}) {
  return (
    <>
      <p className="text-gray-700">
        <span className="text-base font-semibold tabular-nums text-gray-900">
          {detail.alumni_count.toLocaleString()}
        </span>{" "}
        {detail.alumni_count === 1 ? "alumnus" : "alumni"}
      </p>

      {detail.employers.length ? (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Top employers
          </p>
          <ul className="space-y-0.5">
            {detail.employers.slice(0, 5).map((e) => (
              <li key={e.employer} className="flex justify-between gap-2">
                <span className="truncate text-gray-700">{e.employer}</span>
                <span className="shrink-0 tabular-nums text-gray-500">
                  {e.count}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {detail.industries.length ? (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Top industries
          </p>
          <ul className="space-y-0.5">
            {detail.industries.slice(0, 5).map((i) => (
              <li key={i.industry} className="flex justify-between gap-2">
                <span className="truncate text-gray-700">{i.industry}</span>
                <span className="shrink-0 tabular-nums text-gray-500">
                  {i.count}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!detail.employers.length && !detail.industries.length ? (
        <p className="text-gray-500">No employer or industry data yet.</p>
      ) : null}
    </>
  );
}
