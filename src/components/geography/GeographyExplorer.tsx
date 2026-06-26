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
import { Loader2 } from "lucide-react";
import { geocodePlace } from "@/app/(app)/map/actions";
import { UsGeoMap } from "./UsGeoMap";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const RADIUS_PRESETS = [10, 25, 50, 100] as const;
const MIN_MILES = 1;
const MAX_MILES = 250;
const FILTER_KEYS = ["employer", "industry", "year", "region", "tag"] as const;

export interface RadiusState {
  lat?: string;
  lng?: string;
  miles: number;
  place?: string;
  employer?: string;
  industry?: string;
  year?: string;
  region?: string;
  tag?: string;
}

/**
 * The map workspace: one big geo-projected US map shaded by alumni density,
 * with proximity search always on — click the map to drop a pin (center) or
 * search a city; scroll to zoom, drag to pan. A radius preset/slider sets the
 * distance; results render below (passed in as `results`). The grouped Filters
 * control + the results both come from the server via the URL searchParams.
 */
export function GeographyExplorer({
  counts,
  radius,
  filters,
  results,
}: {
  counts: Record<string, number>;
  radius: RadiusState;
  /** The grouped "Filters" control (employer/industry/year/region/tag). */
  filters: ReactNode;
  /** Radius results (count badge + table + export), rendered by the server. */
  results: ReactNode;
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

  function onPick(lat: number, lng: number) {
    setGeoError(null);
    startTransition(() =>
      router.push(
        buildRadiusUrl({
          lat: lat.toFixed(5),
          lng: lng.toFixed(5),
          place: "Pinned location",
        }),
      ),
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {/* Search a city (the radius center) + the grouped Filters control. */}
      <div className="flex flex-wrap items-start gap-3">
        <form
          onSubmit={onSearchPlace}
          className="flex min-w-0 flex-1 items-start gap-2"
        >
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
        {filters}
      </div>

      {/* Radius distance control. */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-gray-700">Radius</span>
        <div className="flex flex-wrap gap-1.5">
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
            "h-1.5 max-w-[12rem] flex-1 cursor-pointer appearance-none rounded-full bg-gray-200 accent-brand-blue-600",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500 focus-visible:ring-offset-1",
          )}
        />
        <span className="text-sm font-semibold tabular-nums text-gray-900">
          {miles} mi
        </span>
      </div>

      {/* Big map — click to drop a pin, scroll to zoom, drag to pan. */}
      <Card className="flex min-h-0 flex-1 flex-col p-4">
        <p className="mb-2 shrink-0 text-xs text-gray-500">
          Click the map to drop a pin, or search a city above.{" "}
          {radius.place
            ? `Center: ${radius.place}`
            : hasCenter
              ? "Center: pinned location"
              : "No center yet."}
        </p>
        <div className="relative min-h-0 flex-1">
          <UsGeoMap mode="radius" counts={counts} center={center} onPick={onPick} />
          {pending ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/40">
              <Loader2
                className="h-5 w-5 animate-spin text-brand-blue-600"
                aria-hidden="true"
              />
            </div>
          ) : null}
        </div>
      </Card>

      {results}
    </div>
  );
}
