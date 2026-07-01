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
import { geoGraticule, geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import type { Topology } from "topojson-specification";
import {
  geocodePlace,
  resolveState,
  reverseGeocode,
} from "@/app/(app)/map/actions";
import { INDUSTRY_OPTIONS } from "@/constants/dropdowns";
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
  radius,
  filters,
  results,
  hasCenter: hasCenterProp,
  matchCounties,
}: {
  counts: Record<string, number>;
  /** Per-county alumni counts (FIPS → count) for the county choropleth. */
  countyCounts?: Record<string, number>;
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
          <WorldGeoMap />
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

/**
 * World view (#213). Renders a `geoNaturalEarth1` world map. The country
 * polygons come from a world topojson that is loaded lazily — and ONLY if the
 * `world-atlas` package (or an equivalent asset) is present. We avoid bundling a
 * hard dependency: the dynamic import is wrapped so a missing asset degrades to
 * a graticule globe outline plus a clear "asset not yet available" note instead
 * of breaking the build/runtime.
 *
 * FOLLOW-UP (asset): to light up real countries, add the `world-atlas` package
 * (`countries-110m.json`, ~110 KB) — or drop a topojson in `public/` and fetch
 * it — and the loader below will pick it up. Alumni shading by country also
 * needs a backend that returns per-country counts (the geography endpoints are
 * US-state/county only today).
 */
function WorldGeoMap() {
  const [countryPaths, setCountryPaths] = useState<string[] | null>(null);
  const [assetMissing, setAssetMissing] = useState(false);

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

  useEffect(() => {
    let cancelled = false;
    // Optional asset — guarded so a missing package degrades gracefully.
    // `webpackIgnore` leaves this as a native dynamic import so the build never
    // tries to resolve (and fail on) the not-yet-installed `world-atlas`
    // package; at runtime the bare specifier just rejects in the browser and we
    // fall back to the graticule outline. FOLLOW-UP: once `world-atlas` is added
    // as a dependency, replace this whole block with a static
    // `import("world-atlas/countries-110m.json")` so it's bundled + shaded.
    const mod = "world-atlas/countries-110m.json";
    import(/* webpackIgnore: true */ mod)
      .then((m) => {
        if (cancelled) return;
        const topo = ((m as { default?: unknown }).default ?? m) as Topology;
        const obj = topo.objects?.countries;
        if (!obj) {
          setAssetMissing(true);
          return;
        }
        const fc = feature(topo, obj) as unknown as FeatureCollection<Geometry>;
        const path = geoPath(projection);
        setCountryPaths(
          fc.features.map((f) => path(f) || "").filter((d) => d),
        );
      })
      .catch(() => {
        if (!cancelled) setAssetMissing(true);
      });
    return () => {
      cancelled = true;
    };
  }, [projection]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-brand-blue-50/30">
      <svg
        viewBox={`0 0 ${WORLD_W} ${WORLD_H}`}
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 h-full w-full select-none"
        role="img"
        aria-label="World map of alumni"
      >
        <path d={spherePath} fill="#FFFFFF" stroke="#CBD5E1" strokeWidth={1} />
        <path
          d={graticulePath}
          fill="none"
          stroke="#E2E8F0"
          strokeWidth={0.5}
        />
        {countryPaths
          ? countryPaths.map((d, i) => (
              <path
                key={i}
                d={d}
                fill="#DCE5F5"
                stroke="#9DB2D8"
                strokeWidth={0.5}
              />
            ))
          : null}
      </svg>

      {assetMissing ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
          <p className="max-w-md rounded-lg bg-white/95 px-4 py-2 text-center text-xs text-gray-600 shadow-card">
            World map outline is ready. Country shapes need the{" "}
            <span className="font-semibold text-gray-900">world-atlas</span>{" "}
            asset, and per-country alumni counts need a backend endpoint — see
            the follow-up note.
          </p>
        </div>
      ) : null}
    </div>
  );
}
