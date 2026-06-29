"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2 } from "lucide-react";
import { geocodePlace, reverseGeocode } from "@/app/(app)/map/actions";
import { UsGeoMap } from "./UsGeoMap";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const RADIUS_PRESETS = [10, 25, 50, 100] as const;
const MIN_MILES = 1;
const MAX_MILES = 250;
const FILTER_KEYS = ["industry", "year", "region", "tag"] as const;

export interface RadiusState {
  lat?: string;
  lng?: string;
  miles: number;
  place?: string;
  industry?: string;
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
  const [placeInput, setPlaceInput] = useState(radius.place ?? "");
  const [geoError, setGeoError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
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

  async function onSearchPlace(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const query = placeInput.trim();
    if (!query) {
      setGeoError("Enter a city to search.");
      return;
    }
    setGeoError(null);
    setSearching(true);
    try {
      const res = await geocodePlace(query);
      if (!res.ok) {
        setGeoError(res.error);
        return;
      }
      startTransition(() =>
        router.push(
          buildRadiusUrl({
            lat: String(res.lat),
            lng: String(res.lng),
            place: res.label,
          }),
        ),
      );
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
    // Reverse-geocode the pin to the nearest city so the label reads as a place.
    const name = await reverseGeocode(lat, lng).catch(() => null);
    if (name) setPlaceInput(name);
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
    setPlaceInput("");
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
          pan; counties + city labels fade in as you zoom. */}
      <div className="absolute inset-0">
        <UsGeoMap
          mode="radius"
          counts={counts}
          countyCounts={countyCounts}
          center={center}
          onPick={onPick}
          onResetCenter={resetCenter}
          matchCounties={matchCounties}
        />
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

      {/* Top-left: city search + grouped Filters, floating over the map. */}
      <div className="absolute left-4 top-4 z-20 w-[min(22rem,calc(100%-2rem))]">
        <Card className="p-3">
          <form onSubmit={onSearchPlace} className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <Input
                value={placeInput}
                onChange={(e) => {
                  setPlaceInput(e.target.value);
                  if (geoError) setGeoError(null);
                }}
                placeholder="Search alumni near a city — e.g. Provo, UT"
                aria-label="Search alumni near a city"
                aria-invalid={geoError ? true : undefined}
              />
              {geoError ? (
                <p className="mt-1.5 text-xs text-danger-600">{geoError}</p>
              ) : null}
            </div>
            <Button type="submit" disabled={searching || pending}>
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Search
            </Button>
          </form>

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

        {/* Radius distance control — its own compact floating Card under search. */}
        <Card className="mt-3 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-gray-700">Radius</span>
            <span className="text-sm font-semibold tabular-nums text-gray-900">
              {miles} mi
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {RADIUS_PRESETS.map((p) => (
              <Chip
                key={p}
                type="button"
                active={miles === p}
                aria-pressed={miles === p}
                onClick={() => {
                  setMiles(p);
                  applyMiles(p);
                }}
              >
                {p} mi
              </Chip>
            ))}
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
      </div>

      {/* Bottom-right: radius results, floating + scrollable + collapsible. Only
          when a center is set — otherwise the map stays fully clear. */}
      {hasCenterProp ? (
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
