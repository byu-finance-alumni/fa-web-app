"use client";

import { useMemo, useRef, useState } from "react";
import { geoAlbersUsa, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import type { Topology } from "topojson-specification";
import statesTopo from "us-atlas/states-10m.json";
import { FIPS_TO_USPS } from "./state-fips";

/**
 * Unified, geo-projected US states map. Renders real state polygons from
 * `us-atlas` states-10m via d3 `geoAlbersUsa` (so AK/HI insets sit correctly).
 *
 * Two modes share one projection:
 *  - "explore": each state shaded by alumni density (`counts`); clicking a state
 *    emits `onStateClick(USPS)` to drill into its detail page.
 *  - "radius":  clicking the map emits `onPick(lat, lng)` via `projection.invert`
 *    and the current `center` is marked with a pin.
 *
 * Choropleth palette + absolute buckets are ported verbatim from `UsStateMap`
 * (the old `@svg-maps/usa` choropleth) so shading is identical; this just swaps
 * the path source to a projected one that can invert clicks.
 */

const WIDTH = 960;
const HEIGHT = 600;

// Absolute heatmap buckets — fixed thresholds (designed for thousands of alumni,
// not normalized to the current max). Identical to UsStateMap.fillFor / legend.
const BUCKETS: { min: number; fill: string; label: string }[] = [
  { min: 100, fill: "#1C2E54", label: "100+" },
  { min: 50, fill: "#3B5C9A", label: "50–99" },
  { min: 10, fill: "#9DB2D8", label: "10–49" },
  { min: 1, fill: "#DCE5F5", label: "1–9" },
  { min: 0, fill: "#F3F4F6", label: "0" },
];

function fillFor(count: number): string {
  return (BUCKETS.find((b) => count >= b.min) ?? BUCKETS[BUCKETS.length - 1])
    .fill;
}

export interface UsGeoMapProps {
  mode: "explore" | "radius";
  /** Alumni count per USPS code — drives the choropleth fill in both modes. */
  counts: Record<string, number>;
  /** Current radius center [lng/lat] to mark with a pin (radius mode). */
  center?: { lat: number; lng: number } | null;
  /** Explore mode: clicked a state (USPS code). */
  onStateClick?: (code: string) => void;
  /** Radius mode: clicked the map -> inverted to (lat, lng). */
  onPick?: (lat: number, lng: number) => void;
}

type StatePath = { id: string; usps: string; name: string; d: string };

export function UsGeoMap({
  mode,
  counts,
  center = null,
  onStateClick,
  onPick,
}: UsGeoMapProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{
    name: string;
    count: number;
    x: number;
    y: number;
  } | null>(null);

  // Build projection + state paths once. geoAlbersUsa fit to the fixed viewBox;
  // the same projection inverts clicks and projects the current-center pin.
  const { paths, projection } = useMemo(() => {
    const topo = statesTopo as unknown as Topology;
    const fc = feature(
      topo,
      topo.objects.states,
    ) as unknown as FeatureCollection<Geometry>;
    const proj = geoAlbersUsa().fitExtent(
      [
        [8, 8],
        [WIDTH - 8, HEIGHT - 8],
      ],
      fc,
    );
    const path = geoPath(proj);
    const ds = fc.features
      .map((f, i) => {
        const fips = String(f.id ?? i).padStart(2, "0");
        const props = (f.properties ?? {}) as { name?: string };
        return {
          id: fips,
          usps: FIPS_TO_USPS[fips] ?? "",
          name: props.name ?? "",
          d: path(f),
        };
      })
      .filter((p): p is StatePath => !!p.d);
    return { paths: ds, projection: proj };
  }, []);

  const pin = useMemo(() => {
    if (!center) return null;
    const pt = projection([center.lng, center.lat]);
    return pt ? { x: pt[0], y: pt[1] } : null;
  }, [center, projection]);

  function handleSvgClick(e: React.MouseEvent<SVGSVGElement>) {
    if (mode !== "radius" || !onPick) return;
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    // Map the click from rendered pixels into the fixed viewBox coordinate space.
    const x = ((e.clientX - rect.left) / rect.width) * WIDTH;
    const y = ((e.clientY - rect.top) / rect.height) * HEIGHT;
    const inverted = projection.invert?.([x, y]);
    if (!inverted) return;
    const [lng, lat] = inverted;
    if (Number.isFinite(lng) && Number.isFinite(lat)) onPick(lat, lng);
  }

  function moveHover(e: React.MouseEvent, name: string, count: number) {
    const rect = wrapRef.current?.getBoundingClientRect();
    setHover({
      name,
      count,
      x: e.clientX - (rect?.left ?? 0),
      y: e.clientY - (rect?.top ?? 0),
    });
  }

  const isExplore = mode === "explore";

  return (
    <div ref={wrapRef} className="relative flex h-full w-full flex-col">
      <div className="relative min-h-0 flex-1">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="xMidYMid meet"
          className={`absolute inset-0 h-full w-full select-none ${
            mode === "radius" ? "cursor-crosshair" : ""
          }`}
          role="img"
          aria-label={
            isExplore
              ? "US alumni distribution by state"
              : "Click the map to set the search center"
          }
          onClick={handleSvgClick}
        >
          {paths.map((p) => {
            const count = counts[p.usps] ?? 0;
            const interactive = isExplore && !!p.usps;
            return (
              <path
                key={p.id}
                d={p.d}
                fill={fillFor(count)}
                stroke="#FFFFFF"
                strokeWidth={0.75}
                className={
                  interactive
                    ? "cursor-pointer outline-none transition-[fill,opacity] hover:opacity-80"
                    : "transition-[fill] hover:opacity-90"
                }
                tabIndex={interactive ? 0 : undefined}
                role={interactive ? "button" : undefined}
                aria-label={
                  p.name ? `${p.name}: ${count} alumni` : undefined
                }
                onMouseEnter={(e) => moveHover(e, p.name, count)}
                onMouseMove={(e) => moveHover(e, p.name, count)}
                onMouseLeave={() => setHover(null)}
                onClick={
                  interactive
                    ? (e) => {
                        e.stopPropagation();
                        onStateClick?.(p.usps);
                      }
                    : undefined
                }
                onKeyDown={
                  interactive
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onStateClick?.(p.usps);
                        }
                      }
                    : undefined
                }
              />
            );
          })}

          {pin ? (
            <g
              className="pointer-events-none"
              transform={`translate(${pin.x}, ${pin.y})`}
              aria-label="Selected center"
            >
              <circle r={11} fill="#2E4A86" opacity={0.12} />
              <circle r={6} fill="#FFFFFF" />
              <circle r={4.5} fill="#2E4A86" />
            </g>
          ) : null}
        </svg>

        {hover && hover.name ? (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg bg-navy-900 px-2.5 py-1.5 text-xs text-white shadow-lg"
            style={{ left: hover.x, top: hover.y - 10 }}
          >
            <p className="font-semibold">{hover.name}</p>
            <p className="tabular-nums text-brand-blue-300">
              {hover.count.toLocaleString()} alumni
            </p>
          </div>
        ) : null}
      </div>

      {/* Heatmap legend (absolute thresholds) — same palette/buckets as before. */}
      <div className="mt-2 flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
        <span className="font-medium text-gray-600">Alumni per state</span>
        {[...BUCKETS].reverse().map((b) => (
          <span
            key={b.label}
            title={`${b.label} alumni`}
            className="flex cursor-default items-center gap-1.5 tabular-nums"
          >
            <span
              className="h-3 w-5 rounded-sm ring-1 ring-inset ring-gray-200"
              style={{ backgroundColor: b.fill }}
            />
            {b.label}
          </span>
        ))}
      </div>
    </div>
  );
}
