"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
 * Scroll to zoom toward the cursor; drag to pan. Choropleth palette + absolute
 * buckets are ported verbatim from the old `UsStateMap`.
 */

const WIDTH = 960;
const HEIGHT = 600;
const MIN_K = 1;
const MAX_K = 12;

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
  counts: Record<string, number>;
  center?: { lat: number; lng: number } | null;
  onStateClick?: (code: string) => void;
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
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<{
    name: string;
    count: number;
    x: number;
    y: number;
  } | null>(null);

  // Zoom/pan transform applied to the map group (g-space -> outer viewBox).
  const [view, setView] = useState({ k: 1, x: 0, y: 0 });
  // Drag state + a "did we actually drag" flag so a drag never fires a click.
  const drag = useRef<{ active: boolean; ox: number; oy: number; moved: boolean }>(
    { active: false, ox: 0, oy: 0, moved: false },
  );

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

  // Pin in outer viewBox coords (projection point, then the zoom transform), so
  // it stays a constant on-screen size regardless of zoom.
  const pin = useMemo(() => {
    if (!center) return null;
    const pt = projection([center.lng, center.lat]);
    if (!pt) return null;
    return { x: view.x + view.k * pt[0], y: view.y + view.k * pt[1] };
  }, [center, projection, view]);

  /** Screen (clientX/Y) -> outer SVG viewBox coords, honoring preserveAspectRatio. */
  function toOuter(clientX: number, clientY: number): [number, number] | null {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return [p.x, p.y];
  }

  // Wheel zoom toward the cursor. Native non-passive listener so we can
  // preventDefault (stop the page from scrolling).
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
        const k = Math.min(MAX_K, Math.max(MIN_K, v.k * factor));
        if (k === MIN_K) return { k: 1, x: 0, y: 0 };
        const ratio = k / v.k;
        return {
          k,
          x: mx - ratio * (mx - v.x),
          y: my - ratio * (my - v.y),
        };
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
    // Defer clearing `active` so the click handler (fires right after) can read
    // `moved` to suppress a pin/state click that was really a drag.
    drag.current.active = false;
  }

  function handleSvgClick(e: React.MouseEvent<SVGSVGElement>) {
    if (drag.current.moved) {
      drag.current.moved = false;
      return;
    }
    if (mode !== "radius" || !onPick) return;
    const outer = toOuter(e.clientX, e.clientY);
    if (!outer) return;
    // Outer -> g-space (undo the zoom transform) -> projection.invert.
    const gx = (outer[0] - view.x) / view.k;
    const gy = (outer[1] - view.y) / view.k;
    const inverted = projection.invert?.([gx, gy]);
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
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="xMidYMid meet"
          className={`absolute inset-0 h-full w-full touch-none select-none ${
            view.k > 1 ? "cursor-grab" : mode === "radius" ? "cursor-crosshair" : ""
          }`}
          role="img"
          aria-label={
            isExplore
              ? "US alumni distribution by state. Scroll to zoom, drag to pan."
              : "Click the map to set the search center. Scroll to zoom, drag to pan."
          }
          onClick={handleSvgClick}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <g transform={`translate(${view.x}, ${view.y}) scale(${view.k})`}>
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
                  vectorEffect="non-scaling-stroke"
                  className={
                    interactive
                      ? "cursor-pointer outline-none transition-[fill,opacity] hover:opacity-80"
                      : "transition-[fill] hover:opacity-90"
                  }
                  tabIndex={interactive ? 0 : undefined}
                  role={interactive ? "button" : undefined}
                  aria-label={p.name ? `${p.name}: ${count} alumni` : undefined}
                  onMouseEnter={(e) => moveHover(e, p.name, count)}
                  onMouseMove={(e) => moveHover(e, p.name, count)}
                  onMouseLeave={() => setHover(null)}
                  onClick={
                    interactive
                      ? (e) => {
                          e.stopPropagation();
                          if (drag.current.moved) {
                            drag.current.moved = false;
                            return;
                          }
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
          </g>

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

        {view.k > 1 ? (
          <button
            type="button"
            onClick={() => setView({ k: 1, x: 0, y: 0 })}
            className="absolute right-2 top-2 z-10 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 shadow-card hover:bg-gray-50"
          >
            Reset zoom
          </button>
        ) : null}
      </div>

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
        <span className="text-gray-400">· scroll to zoom, drag to pan</span>
      </div>
    </div>
  );
}
