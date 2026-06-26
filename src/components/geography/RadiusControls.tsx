"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import { geocodePlace } from "@/app/(app)/map/radius/actions";
import { RadiusPinMap } from "./RadiusPinMap";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const RADIUS_PRESETS = [10, 25, 50, 100] as const;
const MIN_MILES = 1;
const MAX_MILES = 250;

/** The geography filters carried through every navigation so they're preserved. */
const FILTER_KEYS = ["employer", "industry", "year", "region", "tag"] as const;

export interface RadiusControlValues {
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

export function RadiusControls({ values }: { values: RadiusControlValues }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [placeInput, setPlaceInput] = useState(values.place ?? "");
  const [geoError, setGeoError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  // Local mirror of the radius so the slider/chips feel instant while the URL
  // (and thus the server fetch) updates debounced.
  const [miles, setMiles] = useState(values.miles);
  useEffect(() => setMiles(values.miles), [values.miles]);

  const hasCenter = !!values.lat && !!values.lng;
  const center = hasCenter
    ? { lat: Number(values.lat), lng: Number(values.lng) }
    : null;

  /** Build a /map/radius URL preserving lat/lng/place + filters, overriding bits. */
  const buildUrl = useCallback(
    (over: Partial<RadiusControlValues>) => {
      const merged = { ...values, ...over };
      const p = new URLSearchParams();
      if (merged.lat) p.set("lat", String(merged.lat));
      if (merged.lng) p.set("lng", String(merged.lng));
      if (merged.place) p.set("place", merged.place);
      p.set("miles", String(merged.miles));
      for (const k of FILTER_KEYS) {
        const v = merged[k];
        if (v) p.set(k, v);
      }
      return `/map/radius?${p.toString()}`;
    },
    [values],
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
          buildUrl({
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

  // ---- Radius (chips immediate; slider debounced) ----------------------------
  function applyMiles(next: number) {
    const clamped = Math.min(MAX_MILES, Math.max(MIN_MILES, Math.round(next)));
    startTransition(() => router.push(buildUrl({ miles: clamped })));
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
  function onPick(lng: number, lat: number) {
    setGeoError(null);
    startTransition(() => {
      router.push(
        buildUrl({
          lat: lat.toFixed(5),
          lng: lng.toFixed(5),
          place: "Pinned location",
        }),
      );
    });
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* Left column: typed city + radius controls */}
      <div className="flex flex-col gap-4 lg:col-span-1">
        {/* Typed city center */}
        <Card className="p-4">
          <Label htmlFor="radius-place" className="mb-1.5">
            Search from a city
          </Label>
          <form onSubmit={onSearchPlace} className="flex items-start gap-2">
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
                aria-describedby={geoError ? "radius-place-error" : undefined}
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
            <Button type="submit" disabled={searching || pending}>
              {searching ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Search className="h-4 w-4" aria-hidden="true" />
              )}
              <span>Search</span>
            </Button>
          </form>
        </Card>

        {/* Radius */}
        <Card className="p-4">
          <div className="mb-2 flex items-baseline justify-between">
            <Label className="mb-0">Radius</Label>
            <span className="text-sm font-semibold tabular-nums text-gray-900">
              {miles} mi
            </span>
          </div>
          <div className="mb-3 flex flex-wrap gap-1.5">
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
          <div className="mt-1 flex justify-between text-[11px] tabular-nums text-gray-400">
            <span>{MIN_MILES} mi</span>
            <span>{MAX_MILES} mi</span>
          </div>
        </Card>
      </div>

      {/* Right column: click-to-drop-a-pin map */}
      <Card className="flex min-h-0 flex-col p-4 lg:col-span-2">
        <div className="mb-2 flex items-center justify-between gap-2">
          <Label className="mb-0">Click the map to set the center</Label>
          <span className="truncate text-xs text-gray-500">
            {values.place
              ? `Center: ${values.place}`
              : hasCenter
                ? "Center: pinned location"
                : "No center yet"}
          </span>
        </div>
        <div className="relative aspect-[16/10] w-full">
          <div className="absolute inset-0">
            <RadiusPinMap center={center} onPick={onPick} />
          </div>
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
    </div>
  );
}
