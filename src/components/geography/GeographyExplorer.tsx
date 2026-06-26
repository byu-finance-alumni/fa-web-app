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
import { Compass, Crosshair, Loader2, Search } from "lucide-react";
import { geocodePlace } from "@/app/(app)/map/actions";
import { UsGeoMap } from "./UsGeoMap";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Mode = "explore" | "radius";

const RADIUS_PRESETS = [10, 25, 50, 100] as const;
const MIN_MILES = 1;
const MAX_MILES = 250;

/** The geography filters carried through every navigation so they're preserved. */
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
 * The map workspace: a mode toggle over one big geo-projected US map.
 *
 *  - Explore: states shaded by alumni density; clicking a state drills into
 *    `/map/state/{CODE}` (filters preserved).
 *  - Radius: clicking the map drops a pin (center) and runs the radius search;
 *    plus a type-a-city box and radius presets/slider. Both write the URL so the
 *    server fetches and renders results below the map (passed as `children`).
 *
 * Filters (rendered above the map) apply to BOTH the shading and the radius
 * search, since the page re-fetches both from the same searchParams.
 */
export function GeographyExplorer({
  counts,
  mode,
  radius,
  filterQuery,
  filters,
  results,
}: {
  counts: Record<string, number>;
  mode: Mode;
  radius: RadiusState;
  filterQuery: string;
  filters: ReactNode;
  /** Radius results (count badge + table + export), rendered by the server. */
  results: ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const totalAlumni = Object.values(counts).reduce((a, b) => a + b, 0);

  const hasCenter = !!radius.lat && !!radius.lng;
  const center = hasCenter
    ? { lat: Number(radius.lat), lng: Number(radius.lng) }
    : null;

  // Local mirror of the radius so the slider/chips feel instant while the URL
  // (and thus the server fetch) updates debounced.
  const [miles, setMiles] = useState(radius.miles);
  useEffect(() => setMiles(radius.miles), [radius.miles]);

  const [placeInput, setPlaceInput] = useState(radius.place ?? "");
  const [geoError, setGeoError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  // ---- Explore: state click -> drill into the state detail page --------------
  function openState(code: string) {
    router.push(
      `/map/state/${code.toUpperCase()}?${filterQuery}`.replace(/\?$/, ""),
    );
  }

  // ---- Mode toggle (segmented control) ---------------------------------------
  function switchMode(next: Mode) {
    if (next === mode) return;
    const p = new URLSearchParams();
    for (const k of FILTER_KEYS) if (radius[k]) p.set(k, radius[k]!);
    if (next === "radius") {
      p.set("mode", "radius");
      if (radius.lat) p.set("lat", radius.lat);
      if (radius.lng) p.set("lng", radius.lng);
      if (radius.place) p.set("place", radius.place);
      p.set("miles", String(radius.miles));
    }
    const qs = p.toString();
    startTransition(() => router.push(qs ? `/map?${qs}` : "/map"));
  }

  // ---- Radius: build a /map?mode=radius URL preserving center + filters ------
  const buildRadiusUrl = useCallback(
    (over: Partial<RadiusState>) => {
      const merged = { ...radius, ...over };
      const p = new URLSearchParams();
      p.set("mode", "radius");
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

  // ---- Typed city -> geocode -> navigate -------------------------------------
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
      startTransition(() => {
        router.push(
          buildRadiusUrl({
            lat: String(res.lat),
            lng: String(res.lng),
            place: res.label,
          }),
        );
      });
    } finally {
      setSearching(false);
    }
  }

  // ---- Radius value (chips immediate; slider debounced) ----------------------
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

  // ---- Pin drop -> navigate --------------------------------------------------
  function onPick(lat: number, lng: number) {
    setGeoError(null);
    startTransition(() => {
      router.push(
        buildRadiusUrl({
          lat: lat.toFixed(5),
          lng: lng.toFixed(5),
          place: "Pinned location",
        }),
      );
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {/* Mode toggle */}
      <div className="flex shrink-0 items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Map mode"
          className="inline-flex gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1"
        >
          <ModeTab
            active={mode === "explore"}
            onClick={() => switchMode("explore")}
            icon={<Compass className="h-4 w-4" aria-hidden="true" />}
            label="Explore"
          />
          <ModeTab
            active={mode === "radius"}
            onClick={() => switchMode("radius")}
            icon={<Crosshair className="h-4 w-4" aria-hidden="true" />}
            label="Radius"
          />
        </div>
        {mode === "explore" ? (
          <span className="text-xl font-semibold text-gray-900">
            {totalAlumni.toLocaleString()} alumni
          </span>
        ) : null}
      </div>

      {/* Big map card — filters live in this card's header (apply to both modes) */}
      <Card className="flex min-h-0 flex-1 flex-col p-4">
        <div className="mb-3 flex flex-wrap items-end gap-x-3 gap-y-2">
          {filters}
        </div>

        {mode === "radius" ? (
          <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            {/* Type-a-city */}
            <form
              onSubmit={onSearchPlace}
              className="flex w-full max-w-md items-start gap-2"
            >
              <div className="flex-1">
                <Label htmlFor="radius-place" className="mb-1.5">
                  Search from a city
                </Label>
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <Input
                      id="radius-place"
                      value={placeInput}
                      onChange={(e) => {
                        setPlaceInput(e.target.value);
                        if (geoError) setGeoError(null);
                      }}
                      placeholder="City, ST (e.g. Provo, UT)"
                      aria-invalid={geoError ? true : undefined}
                      aria-describedby={
                        geoError ? "radius-place-error" : undefined
                      }
                    />
                    {geoError ? (
                      <p
                        id="radius-place-error"
                        className="mt-1.5 text-xs text-danger-600"
                      >
                        {geoError}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="submit"
                    disabled={searching || pending}
                    className={cn(
                      "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-brand-blue-600 px-3 text-sm font-medium text-white transition-colors hover:bg-brand-blue-500 disabled:pointer-events-none disabled:opacity-50",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500 focus-visible:ring-offset-1",
                    )}
                  >
                    {searching ? (
                      <Loader2
                        className="h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <Search className="h-4 w-4" aria-hidden="true" />
                    )}
                    <span>Search</span>
                  </button>
                </div>
              </div>
            </form>

            {/* Radius presets + slider */}
            <div className="w-full max-w-xs">
              <div className="mb-1.5 flex items-baseline justify-between">
                <Label className="mb-0">Radius</Label>
                <span className="text-sm font-semibold tabular-nums text-gray-900">
                  {miles} mi
                </span>
              </div>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {RADIUS_PRESETS.map((p) => (
                  <Chip
                    key={p}
                    type="button"
                    active={miles === p}
                    onClick={() => {
                      setMiles(p);
                      applyMiles(p);
                    }}
                    aria-pressed={miles === p}
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
                  "h-1.5 w-full cursor-pointer appearance-none rounded-full bg-gray-200 accent-brand-blue-600",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500 focus-visible:ring-offset-1",
                )}
              />
            </div>
          </div>
        ) : null}

        {mode === "radius" ? (
          <p className="mb-2 shrink-0 text-xs text-gray-500">
            Click the map to drop a pin, or search a city.{" "}
            {radius.place
              ? `Center: ${radius.place}`
              : hasCenter
                ? "Center: pinned location"
                : "No center yet."}
          </p>
        ) : null}

        <div className="relative min-h-0 flex-1">
          <UsGeoMap
            mode={mode}
            counts={counts}
            center={center}
            onStateClick={openState}
            onPick={onPick}
          />
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

      {/* Radius results (server-rendered): count badge + table + CSV export. */}
      {mode === "radius" ? results : null}
    </div>
  );
}

/* ----------------------------------------------------------------- mode tab -- */

function ModeTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500 focus-visible:ring-offset-1",
        active
          ? "bg-white text-brand-blue-700 shadow-card"
          : "text-gray-600 hover:text-gray-900",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
