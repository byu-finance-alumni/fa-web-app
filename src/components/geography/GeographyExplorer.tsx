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
import Link from "next/link";
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
  getCountryAlumni,
  getStateTopCities,
  resolveState,
  reverseGeocode,
  type CountryAlumniResult,
} from "@/app/(app)/map/actions";
import type { GeoAlumniRow } from "@/types/geography";
import type { Alumni, AlumniPage } from "@/types/alumni";
import { INDUSTRY_OPTIONS } from "@/constants/dropdowns";
import {
  FALLBACK_CENTROIDS,
  normalizeCountryName,
  US_CANONICAL,
} from "@/lib/geo/world-countries";
import {
  buildLocalSuggestions,
  type MapSuggestion,
} from "@/lib/geo/mapSearchSuggestions";
import { clientGet } from "@/lib/api-client";
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

/** Section header shown above each group of local autocomplete suggestions. */
const GROUP_LABEL: Record<MapSuggestion["kind"], string> = {
  city: "Cities",
  state: "States",
  country: "Countries",
  industry: "Industries",
  company: "Company",
};

/** "Preferred First Last" for an alumni search row (falls back gracefully). */
function alumniDisplayName(a: Alumni): string {
  const first = a.preferred_first_name ?? a.first_name ?? "";
  return [first, a.last_name].filter(Boolean).join(" ") || "Unnamed alumnus";
}

/** A short location subtitle for an alumni suggestion ("Los Angeles, CA"). */
function alumniLocationLabel(a: Alumni): string | null {
  const us = [a.current_city, a.current_state].filter(Boolean).join(", ");
  if (us) return us;
  if (a.home_country && normalizeCountryName(a.home_country) !== US_CANONICAL)
    return a.home_country;
  return null;
}

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
  stateNames,
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
  /** USPS code → full state name, for the Top-10 states widget (#379). Derived
   *  from the same per-state data the map shades by. */
  stateNames?: Record<string, string>;
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
  // County boundary LINE overlay on/off (#2) — default ON (today's behavior:
  // county borders appear once zoomed past COUNTY_ZOOM). Toggling off hides just
  // the boundary strokes; county shading + everything else is untouched.
  const [showCountyLines, setShowCountyLines] = useState(true);
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

  // Focus a single state — the "drill into the state" navigation the search box
  // already uses when you type a state name (#214). Extracted so the map's
  // state-click (#378) reuses the exact same behavior instead of duplicating it:
  // it lands on /map/state/CODE, which auto-zooms to the state and renders its
  // alumni city markers + info rail.
  const focusState = useCallback(
    (code: string) => {
      startTransition(() => router.push(`/map/state/${code.toUpperCase()}`));
    },
    [router],
  );

  // Top 10 states by alumni at their CURRENT LOCATION (#379) — reuses the same
  // per-state `counts` the map shades by; drop empty states and rank high→low.
  const top10States = useMemo(
    () =>
      Object.entries(counts)
        .filter(([, c]) => c > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10),
    [counts],
  );
  const [topOpen, setTopOpen] = useState(true);

  // --- State focus → contextual ranked widget --------------------------------
  // UsGeoMap reports which state is focused (via its in-map focusStateInMap flow)
  // and clears it when the user zooms back out. When a state is focused, the
  // ranked widget switches from "Top states" to "Top cities" for that state.
  const [focusedState, setFocusedState] = useState<{ code: string } | null>(
    null,
  );
  const handleFocusChange = useCallback(
    (f: { code: string } | null) => setFocusedState(f),
    [],
  );
  // Leaving the US view drops any focused state (the world map has no states).
  useEffect(() => {
    if (mapView !== "us") setFocusedState(null);
  }, [mapView]);

  // Floating controls box visibility. Defaults OPEN on the overview; auto-hides
  // when a state is focused/zoomed-in (via the same focus signal) so it doesn't
  // cover the state, and re-opens on zoom-out. This effect only re-runs when the
  // focus itself changes, so a manual show/hide (below) sticks until the user
  // next focuses or zooms out — user intent wins in between.
  const [controlsOpen, setControlsOpen] = useState(true);
  useEffect(() => {
    setControlsOpen(!focusedState);
  }, [focusedState]);

  // Ask the map to focus/zoom a state — used by the "Top states" widget rows so a
  // ranked click behaves like clicking that state on the map. The bumped nonce
  // lets the same state be re-focused after zooming back out.
  const [focusReq, setFocusReq] = useState<{ code: string; n: number } | null>(
    null,
  );
  const requestFocus = useCallback(
    (code: string) =>
      setFocusReq((r) => ({ code: code.toUpperCase(), n: (r?.n ?? 0) + 1 })),
    [],
  );

  // Top cities for the focused state — fetched from the SAME endpoint the state
  // detail page uses (`/geography/states/{code}` → cities), with the active map
  // filters applied so the ranking matches the shading. Per-city alumni counts
  // are NOT in the per-state/per-county data already flowing here, so this is the
  // one place the widget reads an (existing) endpoint. Degrades to [] on error.
  const [cityRows, setCityRows] = useState<
    { city: string; count: number }[] | null
  >(null);
  const [citiesLoading, setCitiesLoading] = useState(false);
  useEffect(() => {
    const code = focusedState?.code;
    if (!code) {
      setCityRows(null);
      setCitiesLoading(false);
      return;
    }
    let cancelled = false;
    setCitiesLoading(true);
    getStateTopCities(code, {
      industry: radius.industry,
      employer: radius.employer,
      year: radius.year,
      region: radius.region,
      tag: radius.tag,
    })
      .then((rows) => {
        if (!cancelled) setCityRows(rows);
      })
      .finally(() => {
        if (!cancelled) setCitiesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    focusedState?.code,
    radius.industry,
    radius.employer,
    radius.year,
    radius.region,
    radius.tag,
  ]);

  // --- Autocomplete + place/country/alumni zoom (#406) -----------------------
  // Imperative "frame this point/country" requests handed to the maps. A bumped
  // nonce re-triggers the same target after a manual zoom-out, mirroring the
  // existing state `focusReq` pattern.
  const [usFocusReq, setUsFocusReq] = useState<{
    lat: number;
    lng: number;
    n: number;
  } | null>(null);
  const requestUsFocus = useCallback(
    (lat: number, lng: number) =>
      setUsFocusReq((r) => ({ lat, lng, n: (r?.n ?? 0) + 1 })),
    [],
  );
  const [worldFocusReq, setWorldFocusReq] = useState<{
    key: string;
    n: number;
  } | null>(null);
  const requestWorldFocus = useCallback(
    (key: string) =>
      setWorldFocusReq((r) => ({ key, n: (r?.n ?? 0) + 1 })),
    [],
  );

  // Country display names the world map knows about — the topojson spellings plus
  // any extra spellings the backend counts arrive under — so a typed/selected
  // country resolves to a canonical key even with zero alumni. Client-safe: the
  // topojson is already bundled for the world view.
  const worldCountryNames = useMemo(() => {
    const names = new Set<string>();
    try {
      const topo = worldTopo as unknown as Topology;
      const obj = topo.objects?.countries;
      if (obj) {
        const fc = feature(topo, obj) as unknown as FeatureCollection<Geometry>;
        for (const f of fc.features) {
          const name = (f.properties as { name?: string } | null)?.name;
          if (name && normalizeCountryName(name) !== US_CANONICAL)
            names.add(name);
        }
      }
    } catch {
      /* topojson parse issues just yield fewer country suggestions */
    }
    for (const raw of Object.keys(countryCounts ?? {})) {
      if (raw && normalizeCountryName(raw) !== US_CANONICAL) names.add(raw);
    }
    return Array.from(names);
  }, [countryCounts]);

  // Debounced alumni-name matches (locate-on-map). Mirrors TopbarSearch: a short
  // debounce keeps the request rate inside the WAF limit; a monotonic sequence
  // guards against out-of-order responses. `kind=all` so program friends surface
  // too. Degrades silently on error — local suggestions still show.
  const [alumniMatches, setAlumniMatches] = useState<Alumni[]>([]);
  const alumniSeq = useRef(0);
  useEffect(() => {
    const term = searchInput.trim();
    if (term.length < 2) {
      alumniSeq.current++;
      setAlumniMatches([]);
      return;
    }
    const seq = ++alumniSeq.current;
    const timer = setTimeout(async () => {
      try {
        const page = await clientGet<AlumniPage>(
          `/alumni?q=${encodeURIComponent(term)}&kind=all&limit=4&offset=0`,
        );
        if (seq === alumniSeq.current) setAlumniMatches(page.items);
      } catch {
        if (seq === alumniSeq.current) setAlumniMatches([]);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const localSuggestions = useMemo(
    () =>
      buildLocalSuggestions({
        query: searchInput,
        countryNames: worldCountryNames,
        worldActive: mapView === "world",
      }),
    [searchInput, worldCountryNames, mapView],
  );

  // One flat, keyboard-navigable list: alumni matches first (locate is a headline
  // action), then the local place/industry suggestions.
  const suggestions = useMemo<
    (
      | { type: "alumni"; alumnus: Alumni }
      | { type: "local"; suggestion: MapSuggestion }
    )[]
  >(() => {
    const trimmed = searchInput.trim();
    const rows: (
      | { type: "alumni"; alumnus: Alumni }
      | { type: "local"; suggestion: MapSuggestion }
    )[] = [
      ...alumniMatches.map((a) => ({ type: "alumni" as const, alumnus: a })),
      ...localSuggestions.map((s) => ({
        type: "local" as const,
        suggestion: s,
      })),
    ];
    // Always offer an explicit "filter by company" escape hatch for free text.
    if (trimmed) {
      rows.push({
        type: "local",
        suggestion: { kind: "company", label: trimmed, value: trimmed },
      });
    }
    return rows;
  }, [alumniMatches, localSuggestions, searchInput]);

  const [acOpen, setAcOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  // Reset the highlighted row whenever the list changes so it never points past
  // the end.
  useEffect(() => setActiveIndex(-1), [suggestions.length]);
  // Close the dropdown on any outside click.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (
        searchWrapRef.current &&
        !searchWrapRef.current.contains(e.target as Node)
      )
        setAcOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // Jump/zoom the map to one alumnus's location. US city/state → geocode to a
  // radius center + frame it; international home country → world view + frame the
  // country. Nothing on file → a soft note.
  const locateAlumnus = useCallback(
    async (a: Alumni) => {
      setGeoError(null);
      setGeoNote(null);
      setAcOpen(false);
      const name = alumniDisplayName(a);
      const city = a.current_city?.trim();
      const state = a.current_state?.trim();
      if (state) {
        // US alumnus — geocode "City, ST" when we have a city, else frame the
        // whole state.
        if (city) {
          const geo = await geocodePlace(`${city}, ${state}`).catch(() => null);
          if (geo && geo.ok) {
            setMapView("us");
            setSearchInput(geo.label);
            requestUsFocus(geo.lat, geo.lng);
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
        }
        const st = await resolveState(state);
        if (st.ok) {
          setMapView("us");
          setSearchInput(name);
          focusState(st.code);
          return;
        }
      }
      const country = a.home_country?.trim();
      if (country && normalizeCountryName(country) !== US_CANONICAL) {
        setMapView("world");
        setSearchInput(name);
        requestWorldFocus(normalizeCountryName(country));
        return;
      }
      setGeoNote(`No location on file for ${name} to place on the map.`);
    },
    [buildRadiusUrl, focusState, requestUsFocus, requestWorldFocus, router],
  );

  // Act on a picked local suggestion — dispatched by kind, no re-resolution.
  const applyLocalSuggestion = useCallback(
    (s: MapSuggestion) => {
      setGeoError(null);
      setGeoNote(null);
      setAcOpen(false);
      switch (s.kind) {
        case "city":
          setMapView("us");
          setSearchInput(s.label);
          requestUsFocus(s.lat, s.lng);
          startTransition(() =>
            router.push(
              buildRadiusUrl({
                lat: s.lat.toFixed(5),
                lng: s.lng.toFixed(5),
                place: s.label,
              }),
            ),
          );
          return;
        case "state":
          setMapView("us");
          setSearchInput(s.label);
          focusState(s.code);
          return;
        case "country":
          setMapView("world");
          setSearchInput(s.display);
          requestWorldFocus(s.key);
          return;
        case "industry":
          setSearchInput(s.value);
          startTransition(() =>
            router.push(buildFilterUrl("industry", s.value)),
          );
          return;
        case "company":
          setSearchInput(s.value);
          startTransition(() =>
            router.push(buildFilterUrl("employer", s.value)),
          );
          return;
      }
    },
    [buildFilterUrl, buildRadiusUrl, focusState, requestUsFocus, requestWorldFocus, router],
  );

  function applyActiveSuggestion(index: number) {
    const item = suggestions[index];
    if (!item) return;
    if (item.type === "alumni") void locateAlumnus(item.alumnus);
    else applyLocalSuggestion(item.suggestion);
  }

  function onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!acOpen || suggestions.length === 0) {
      if (e.key === "Escape") setAcOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      applyActiveSuggestion(activeIndex);
    } else if (e.key === "Escape") {
      setAcOpen(false);
      setActiveIndex(-1);
    }
  }

  // Unified map search (#214): one box, resolved in priority order — US state
  // (name/code) → known industry → matching country → city (geocode → radius
  // center) → otherwise a company (employer) filter. An empty submit clears the
  // industry/employer shading. Used when the user submits free text without
  // picking an autocomplete row.
  async function onSearch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAcOpen(false);
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
        setMapView("us");
        focusState(state.code);
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

      // 3) An exact country name (world map) → switch to the world view and
      //    frame that country.
      const country = worldCountryNames.find(
        (c) => c.toLowerCase() === query.toLowerCase(),
      );
      if (country) {
        setMapView("world");
        requestWorldFocus(normalizeCountryName(country));
        return;
      }

      // 4) A place → geocode to a radius center and frame it on the US map.
      const geo = await geocodePlace(query);
      if (geo.ok) {
        if (geo.spannedStates && geo.spannedStates.length) {
          const shown = geo.spannedStates.slice(0, 5).join(", ");
          const more = geo.spannedStates.length > 5 ? ", …" : "";
          setGeoNote(
            `"${geo.label.split(",")[0]}" is also in ${shown}${more}. Showing ${geo.label} — add a state to pick another.`,
          );
        }
        setMapView("us");
        requestUsFocus(geo.lat, geo.lng);
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

      // 5) Otherwise treat it as a company (employer) filter.
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
      {/* FLOATING CONTROLS BOX — search + filters + drop-pin radius + county-lines
          switch, stacked vertically, over the TOP-LEFT of the full-width map (the
          Pacific/ocean side). z-30 keeps it above the map; the inner Cards supply
          the surfaces. Auto-hides on state focus/zoom-in (see `controlsOpen`) and
          collapses to a compact "Search & filters" button in its place. */}
      {controlsOpen ? (
      <div className="absolute left-4 top-4 z-30 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-3">
        {/* Header — label + a "Hide" affordance to collapse the box. */}
        <div className="flex items-center justify-between rounded-lg bg-white/95 px-3 py-1.5 shadow-card">
          <span className="text-xs font-semibold text-gray-700">
            Search &amp; filters
          </span>
          <button
            type="button"
            onClick={() => setControlsOpen(false)}
            className="rounded text-xs font-medium text-brand-blue-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500 focus-visible:ring-offset-1"
          >
            Hide
          </button>
        </div>
        {/* Search + active filters + current center + grouped Filters popover. */}
        <Card className="space-y-2.5 p-3.5">
          <form onSubmit={onSearch} className="space-y-2.5">
            {/* Prominent search field with type-ahead suggestions (#406). The
                autocomplete listbox floats over the map below the input; picking a
                row jumps/zooms the map or applies the matching filter. */}
            <div ref={searchWrapRef} className="relative">
              <Input
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  if (geoError) setGeoError(null);
                  setAcOpen(true);
                }}
                onFocus={() => {
                  if (suggestions.length > 0) setAcOpen(true);
                }}
                onKeyDown={onSearchKeyDown}
                placeholder="Search alumni, city, state, country, industry…"
                aria-label="Search the map by alumni, city, state, country, industry, or company"
                aria-invalid={geoError ? true : undefined}
                role="combobox"
                aria-expanded={acOpen}
                aria-controls="map-search-listbox"
                aria-autocomplete="list"
                aria-activedescendant={
                  activeIndex >= 0
                    ? `map-search-option-${activeIndex}`
                    : undefined
                }
                autoComplete="off"
                className="h-10 text-sm"
              />
              {acOpen && suggestions.length > 0 ? (
                <ul
                  id="map-search-listbox"
                  role="listbox"
                  aria-label="Map search suggestions"
                  className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-80 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
                >
                  {suggestions.map((item, i) => {
                    const group =
                      item.type === "alumni"
                        ? "Alumni"
                        : GROUP_LABEL[item.suggestion.kind];
                    const prevGroup =
                      i === 0
                        ? null
                        : suggestions[i - 1].type === "alumni"
                          ? "Alumni"
                          : GROUP_LABEL[
                              (
                                suggestions[i - 1] as {
                                  suggestion: MapSuggestion;
                                }
                              ).suggestion.kind
                            ];
                    const showHeader = group !== prevGroup;
                    const active = i === activeIndex;
                    return (
                      <li key={`${group}-${i}`} role="none">
                        {showHeader ? (
                          <p className="px-3 pb-0.5 pt-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                            {group}
                          </p>
                        ) : null}
                        <button
                          type="button"
                          id={`map-search-option-${i}`}
                          role="option"
                          aria-selected={active}
                          onMouseEnter={() => setActiveIndex(i)}
                          onClick={() => applyActiveSuggestion(i)}
                          className={cn(
                            "flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm",
                            active ? "bg-brand-blue-50" : "hover:bg-gray-50",
                          )}
                        >
                          {item.type === "alumni" ? (
                            <>
                              <span className="min-w-0 truncate font-medium text-gray-900">
                                {alumniDisplayName(item.alumnus)}
                              </span>
                              <span className="shrink-0 truncate text-xs text-gray-500">
                                {alumniLocationLabel(item.alumnus) ??
                                  (item.alumnus.graduation_year
                                    ? `Class of ${item.alumnus.graduation_year}`
                                    : "")}
                              </span>
                            </>
                          ) : item.suggestion.kind === "company" ? (
                            <span className="min-w-0 truncate text-gray-700">
                              Filter by company:{" "}
                              <span className="font-medium text-gray-900">
                                {item.suggestion.value}
                              </span>
                            </span>
                          ) : (
                            <span className="min-w-0 truncate font-medium text-gray-900">
                              {item.suggestion.label}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
            {geoError ? (
              <p className="text-xs text-danger-600">{geoError}</p>
            ) : null}
            {geoNote ? (
              <p className="text-xs text-gray-500">{geoNote}</p>
            ) : null}
            {/* Filters on the left, Search on the right — under the search bar. */}
            <div className="flex items-center justify-between gap-2">
              {filters}
              <Button type="submit" disabled={searching || pending}>
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Search
              </Button>
            </div>
          </form>

          {/* Active map-wide filters (Company/Industry) — clearable inline. */}
          {radius.employer || radius.industry ? (
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
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

          {/* Pinned-location indicator — only shown once a place/center is set. */}
          {radius.place || hasCenter ? (
            <p className="min-w-0 truncate text-xs">
              {radius.place ? (
                <span className="font-medium text-gray-900">{radius.place}</span>
              ) : (
                <span className="font-medium text-gray-900">Pinned location</span>
              )}
            </p>
          ) : null}
        </Card>

        {/* Drop-pin radius distance — US/radius view only. */}
        {mapView === "us" ? (
          <Card className="p-3">
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

        {/* County-lines toggle SWITCH (#1) — a sliding on/off switch with a text
            label. No design-system Switch exists, so this is a minimal accessible
            one (role="switch" + aria-checked; a <button> is keyboard-toggleable).
            US view only; toggles just the county boundary line overlay. */}
        {mapView === "us" ? (
          <Card className="p-3">
            <div className="flex items-center justify-between gap-3">
              <span
                id="county-lines-label"
                className="text-sm font-medium text-gray-700"
              >
                County lines
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={showCountyLines}
                aria-labelledby="county-lines-label"
                onClick={() => setShowCountyLines((v) => !v)}
                title="Show or hide county boundary lines on the map"
                className={cn(
                  "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500 focus-visible:ring-offset-1",
                  showCountyLines ? "bg-brand-blue-600" : "bg-gray-300",
                )}
              >
                <span
                  className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                    showCountyLines ? "translate-x-4" : "translate-x-0.5",
                  )}
                />
              </button>
            </div>
          </Card>
        ) : null}
      </div>
      ) : (
        // Collapsed — a compact text button in the same top-left spot that
        // re-opens the full controls box (auto-collapsed on state focus).
        <div className="absolute left-4 top-4 z-30">
          <button
            type="button"
            onClick={() => setControlsOpen(true)}
            className="rounded-lg bg-white/95 px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-card hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500 focus-visible:ring-offset-1"
          >
            Search &amp; filters
          </button>
        </div>
      )}

      {/* US / World view toggle — a centered pill floating ABOVE THE CENTER of
          the map (prod look). Sits in the top padding above the landmass, clear
          of the top-left controls box on desktop widths. */}
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

        {/* Full-bleed map — the hero. From the US overview, click a state to
            zoom/focus into it and reveal its alumni dots (#378); once zoomed into
            a state, click a populated area to drop a radius pin. Scroll to zoom,
            drag to pan; counties + city labels fade in as you zoom. Toggle to the
            world view (#213) swaps in the world map. */}
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
              onFocusChange={handleFocusChange}
              focusRequest={focusReq}
              focusPoint={usFocusReq}
              showCountyLines={showCountyLines}
              matchCounties={matchCounties}
            />
          ) : (
            <WorldGeoMap
              countryCounts={countryCounts ?? {}}
              focusRequest={worldFocusReq}
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

      {/* Bottom-right (or bottom-left when results are shown): the ranked widget.
          Lists "Top states by alumni" on the overview; when a state is focused it
          switches to "Top cities" for that state. Compact + collapsible. */}
      {mapView === "us" && (focusedState || top10States.length > 0) ? (
        <div
          className={cn(
            "absolute bottom-4 z-20 w-[min(15rem,calc(100%-2rem))]",
            hasCenterProp ? "left-4" : "right-4",
          )}
        >
          <Card className="overflow-hidden">
            <button
              type="button"
              onClick={() => setTopOpen((o) => !o)}
              aria-expanded={topOpen}
              className="flex w-full items-center justify-between gap-2 border-b border-gray-200 px-3 py-2 text-left hover:bg-gray-50"
            >
              <span className="min-w-0 truncate text-xs font-semibold text-gray-900">
                {focusedState
                  ? `Top cities — ${stateNames?.[focusedState.code] ?? focusedState.code}`
                  : "Top states by alumni"}
              </span>
              <span className="shrink-0 text-xs font-medium text-brand-blue-600">
                {topOpen ? "Hide" : "Show"}
              </span>
            </button>
            {topOpen ? (
              focusedState ? (
                /* Cities mode — top cities for the focused state. */
                citiesLoading && !cityRows ? (
                  <p className="px-3 py-2 text-xs text-gray-500">
                    Loading cities…
                  </p>
                ) : cityRows && cityRows.length ? (
                  <ol className="max-h-[min(40vh,20rem)] overflow-y-auto p-1.5">
                    {cityRows.slice(0, 10).map((c, i) => (
                      <li
                        key={`${c.city}-${i}`}
                        className="flex items-center gap-2 rounded-md px-2 py-1"
                        title={`${c.city}: ${c.count.toLocaleString()} alumni`}
                      >
                        <span className="w-4 shrink-0 text-xs tabular-nums text-gray-400">
                          {i + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-xs font-medium text-gray-700">
                          {c.city}
                        </span>
                        <span className="shrink-0 text-xs font-semibold tabular-nums text-gray-900">
                          {c.count.toLocaleString()}
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="px-3 py-2 text-xs text-gray-500">
                    No city data for this state yet.
                  </p>
                )
              ) : (
                /* States mode — top states; a row click focuses that state on
                   the map (which flips this widget to that state's cities). */
                <ol className="max-h-[min(40vh,20rem)] overflow-y-auto p-1.5">
                  {top10States.map(([code, count], i) => (
                    <li key={code}>
                      <button
                        type="button"
                        onClick={() => requestFocus(code)}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-gray-50"
                        title={`Focus ${stateNames?.[code] ?? code}`}
                      >
                        <span className="w-4 shrink-0 text-xs tabular-nums text-gray-400">
                          {i + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-xs font-medium text-gray-700">
                          {stateNames?.[code] ?? code}
                        </span>
                        <span className="shrink-0 text-xs font-semibold tabular-nums text-gray-900">
                          {count.toLocaleString()}
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              )
            ) : null}
          </Card>
        </div>
      ) : null}

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
  focusRequest,
}: {
  countryCounts: Record<string, number>;
  filters: WorldFilters;
  /** Imperative "frame this country" request (map search → zoom, #406). Bumped
   *  nonce re-triggers the same country after a manual pan/zoom. */
  focusRequest?: { key: string; n: number } | null;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Zoom/pan transform (g-space -> outer viewBox), identical model to UsGeoMap.
  const [view, setView] = useState({ k: 1, x: 0, y: 0 });
  const drag = useRef<{
    active: boolean;
    ox: number;
    oy: number;
    moved: boolean;
    captured: boolean;
  }>({ active: false, ox: 0, oy: 0, moved: false, captured: false });

  const [hover, setHover] = useState<{
    name: string;
    count: number;
    x: number;
    y: number;
  } | null>(null);
  const [selected, setSelected] = useState<{
    name: string;
    count: number;
  } | null>(null);
  // The individual alumni behind the selected country (full-access; paginated).
  const [alumniResult, setAlumniResult] = useState<CountryAlumniResult | null>(
    null,
  );
  const [alumniItems, setAlumniItems] = useState<GeoAlumniRow[]>([]);
  const [alumniLoading, setAlumniLoading] = useState(false);

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

  // Canonical key → centroid [lng, lat], from the topojson polygons plus the
  // hand-kept fallbacks (finance hubs too small for the 110m atlas). Drives the
  // parent-requested country focus (#406).
  const centroidByKey = useMemo(() => {
    const m = new Map<string, [number, number]>();
    for (const c of countries) m.set(c.key, c.centroid);
    for (const [key, lnglat] of Object.entries(FALLBACK_CENTROIDS)) {
      if (!m.has(key)) m.set(key, lnglat);
    }
    return m;
  }, [countries]);

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
    // NB: do NOT capture the pointer here — capturing on the SVG redirects the
    // subsequent `click` to the SVG, so clicks never reach the country/bubble
    // child elements (which is where the drill-down handlers live). We only
    // capture once a real drag begins (past the threshold, below), so a plain
    // click stays on its target while panning still tracks off-element.
    drag.current = {
      active: true,
      ox: outer[0],
      oy: outer[1],
      moved: false,
      captured: false,
    };
  }
  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!drag.current.active) return;
    const outer = toOuter(e.clientX, e.clientY);
    if (!outer) return;
    const dx = outer[0] - drag.current.ox;
    const dy = outer[1] - drag.current.oy;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      drag.current.moved = true;
      if (!drag.current.captured) {
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current.captured = true;
      }
    }
    drag.current.ox = outer[0];
    drag.current.oy = outer[1];
    setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
  }
  function onPointerUp(e: React.PointerEvent<SVGSVGElement>) {
    if (
      drag.current.captured &&
      e.currentTarget.hasPointerCapture(e.pointerId)
    )
      e.currentTarget.releasePointerCapture(e.pointerId);
    drag.current.active = false;
    drag.current.captured = false;
  }

  // --- drill-down -------------------------------------------------------------
  const ALUMNI_PAGE = 50;

  // Fetch one page of the country's alumni; offset 0 replaces the list, a
  // higher offset appends (the "Show more" pager).
  const fetchAlumniPage = useCallback(
    (display: string, offset: number) => {
      setAlumniLoading(true);
      getCountryAlumni(display, filters, { limit: ALUMNI_PAGE, offset })
        .then((r) => {
          setAlumniResult(r);
          if (r.ok) {
            setAlumniItems((prev) =>
              offset === 0 ? r.page.items : [...prev, ...r.page.items],
            );
          }
        })
        .catch(() => setAlumniResult({ ok: false, forbidden: false }))
        .finally(() => setAlumniLoading(false));
    },
    [filters],
  );

  const openCountry = useCallback(
    (display: string, count: number) => {
      if (drag.current.moved) {
        drag.current.moved = false;
        return;
      }
      setSelected({ name: display, count });
      setAlumniResult(null);
      setAlumniItems([]);
      fetchAlumniPage(display, 0);
    },
    [fetchAlumniPage],
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

  // Parent-requested country focus (map search → zoom, #406): project the
  // country's centroid, frame it at a mid zoom, and open its drill-down when it
  // has alumni. The nonce bump re-frames the same country after a manual pan.
  useEffect(() => {
    if (!focusRequest) return;
    const lnglat = centroidByKey.get(focusRequest.key);
    if (!lnglat) return;
    const pt = projection(lnglat);
    if (!pt || !Number.isFinite(pt[0]) || !Number.isFinite(pt[1])) return;
    const k = Math.min(WORLD_MAX_K, 4);
    setView({ k, x: WORLD_W / 2 - k * pt[0], y: WORLD_H / 2 - k * pt[1] });
    const entry = countsByKey.get(focusRequest.key);
    if (entry) {
      setSelected({ name: entry.display, count: entry.count });
      setAlumniResult(null);
      setAlumniItems([]);
      fetchAlumniPage(entry.display, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest]);

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
                  interactive
                    ? () => openCountry(entry!.display, count)
                    : undefined
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
          const active = selected?.name === b.display;
          return (
            <g
              key={b.key}
              transform={`translate(${ox}, ${oy})`}
              className="cursor-pointer"
              onMouseEnter={(e) => moveHover(e, b.display, b.count)}
              onMouseMove={(e) => moveHover(e, b.display, b.count)}
              onMouseLeave={() => setHover(null)}
              onClick={() => openCountry(b.display, b.count)}
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
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-900">
                  {selected.name}
                </p>
                <p className="text-xs tabular-nums text-gray-500">
                  {selected.count.toLocaleString()}{" "}
                  {selected.count === 1 ? "alumnus" : "alumni"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelected(null);
                  setAlumniResult(null);
                  setAlumniItems([]);
                }}
                className="rounded-md px-1.5 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                aria-label="Close country details"
              >
                ✕
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3 text-sm">
              {alumniResult && !alumniResult.ok ? (
                <p className="text-gray-600">
                  {alumniResult.forbidden
                    ? "Viewing the individual alumni here needs full access."
                    : "Couldn't load the alumni for this country."}
                </p>
              ) : alumniItems.length ? (
                <>
                  <ul className="divide-y divide-gray-100">
                    {alumniItems.map((a) => (
                      <li key={a.alumni_id} className="py-1.5">
                        <Link
                          href={`/alumni/${a.alumni_id}`}
                          className="font-medium text-brand-blue-700 hover:underline"
                        >
                          {a.name}
                        </Link>
                        <p className="text-xs text-gray-500">
                          {[
                            a.city,
                            a.graduation_year
                              ? `Class of ${a.graduation_year}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                        {a.current_employer || a.current_title ? (
                          <p className="truncate text-xs text-gray-600">
                            {[a.current_title, a.current_employer]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                  {alumniResult?.ok &&
                  alumniItems.length < alumniResult.page.total ? (
                    <button
                      type="button"
                      disabled={alumniLoading}
                      onClick={() =>
                        selected &&
                        fetchAlumniPage(selected.name, alumniItems.length)
                      }
                      className="mt-2 w-full rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                    >
                      {alumniLoading
                        ? "Loading…"
                        : `Show more (${alumniResult.page.total - alumniItems.length} more)`}
                    </button>
                  ) : null}
                </>
              ) : alumniLoading ? (
                <p className="flex items-center gap-2 text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Loading alumni…
                </p>
              ) : alumniResult?.ok ? (
                <p className="text-gray-500">
                  No alumni match here with the current filters.
                </p>
              ) : null}
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
