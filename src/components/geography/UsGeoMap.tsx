"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { geoAlbersUsa, geoContains, geoPath, type GeoProjection } from "d3-geo";
import type { Feature } from "geojson";
import { feature, mesh } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";
import statesTopo from "us-atlas/states-10m.json";
import majorCities from "@/lib/geo/major-cities.json";
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
 * Scroll to zoom toward the cursor; drag to pan. County borders are always drawn
 * at the same weight/color as the state borders (lazily loaded as a single mesh
 * path so the ~800KB counties topojson never ships in the initial bundle).
 * Alumni density is a COUNTY-level choropleth (`countyCounts`): only the counties
 * where alumni work are shaded; states render as a neutral base. A radius search
 * additionally rings the result counties (`matchCounties`). Major-city dots +
 * labels appear past `CITY_ZOOM` (only for cities inside the visible view, so
 * labels never crowd the map). Choropleth palette + buckets are ported from the
 * old `UsStateMap`.
 */

const WIDTH = 960;
const HEIGHT = 600;
const MIN_K = 1;
const MAX_K = 12;
/** Zoom level at which major-city dots + labels start rendering. */
const CITY_ZOOM = 4;

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

// States are no longer choropleth-shaded — alumni density is shown at the COUNTY
// level (see `countyCounts`). States render as a neutral base so only the
// counties where people actually work carry color.
const NEUTRAL_STATE = "#F8FAFC";

type City = { name: string; state: string; lat: number; lng: number };

// Module-level cache so the counties topojson is fetched/parsed at most once for
// the lifetime of the page, no matter how many times we cross the zoom threshold.
let countiesTopoCache: Topology | null = null;
let countiesPromise: Promise<Topology> | null = null;
function loadCounties(): Promise<Topology> {
  if (countiesTopoCache) return Promise.resolve(countiesTopoCache);
  if (!countiesPromise) {
    countiesPromise = import("us-atlas/counties-10m.json").then((m) => {
      countiesTopoCache = (m.default ?? m) as unknown as Topology;
      return countiesTopoCache;
    });
  }
  return countiesPromise;
}

export interface UsGeoMapProps {
  mode: "explore" | "radius";
  /** Per-state alumni totals — used for the state hover tooltip (not shading). */
  counts: Record<string, number>;
  /** Per-county alumni counts (5-digit FIPS → count) — the choropleth shading. */
  countyCounts?: Record<string, number>;
  center?: { lat: number; lng: number } | null;
  onStateClick?: (code: string) => void;
  onPick?: (lat: number, lng: number) => void;
  /** Clear the current radius center/pin (renders a "Reset pin" button). */
  onResetCenter?: () => void;
  /** 5-digit county FIPS that contain a matched alumnus — ringed at all zooms. */
  matchCounties?: string[];
}

type StatePath = { id: string; usps: string; name: string; d: string };
type ProjectedCity = City & { x: number; y: number };

export function UsGeoMap({
  mode,
  counts,
  countyCounts,
  center = null,
  onStateClick,
  onPick,
  onResetCenter,
  matchCounties,
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

  const { paths, projection, features } = useMemo(() => {
    const topo = statesTopo as unknown as Topology;
    const fc = feature(
      topo,
      topo.objects.states,
    ) as unknown as FeatureCollection<Geometry>;
    // Generous padding so the whole US starts comfortably in view (zoomed out)
    // and the landmass sits clear of the floating control panels in the corners.
    const proj = geoAlbersUsa().fitExtent(
      [
        [110, 80],
        [WIDTH - 110, HEIGHT - 80],
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
    return {
      paths: ds,
      projection: proj as GeoProjection,
      features: fc.features as Feature[],
    };
  }, []);

  // --- Matched counties (lazy) ------------------------------------------------
  // Only the counties that contain a matched alumnus are outlined — shown at
  // EVERY zoom level (not just when zoomed in). We lazily load the ~800KB
  // counties topojson the first time there's a match, then keep only the wanted
  // county geometries (by 5-digit FIPS).
  const [matchCountyPaths, setMatchCountyPaths] = useState<string[] | null>(null);
  const matchKey =
    matchCounties && matchCounties.length ? [...matchCounties].sort().join(",") : "";
  useEffect(() => {
    if (!matchKey) {
      setMatchCountyPaths(null);
      return;
    }
    let cancelled = false;
    const want = new Set(matchKey.split(","));
    loadCounties().then((topo) => {
      if (cancelled) return;
      const fc = feature(
        topo,
        topo.objects.counties,
      ) as unknown as FeatureCollection<Geometry>;
      const path = geoPath(projection);
      const ds = fc.features
        .filter((f) => want.has(String(f.id ?? "").padStart(5, "0")))
        .map((f) => path(f))
        .filter((d): d is string => !!d);
      setMatchCountyPaths(ds);
    });
    return () => {
      cancelled = true;
    };
  }, [matchKey, projection]);

  // --- County borders (lazy) --------------------------------------------------
  // Every county outline, always shown at the same weight/color as the state
  // borders. We render them as ONE mesh path (all interior county-county borders)
  // rather than thousands of polygons, so it stays cheap. The ~800KB counties
  // topojson is dynamically imported (never in the initial bundle).
  const [countyMesh, setCountyMesh] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadCounties().then((topo) => {
      if (cancelled) return;
      const path = geoPath(projection);
      const borders = mesh(
        topo,
        topo.objects.counties as GeometryCollection,
        (a, b) => a !== b,
      );
      setCountyMesh(path(borders) || null);
    });
    return () => {
      cancelled = true;
    };
  }, [projection]);

  // --- County choropleth fills (lazy) -----------------------------------------
  // Shade ONLY the counties where alumni work, by `countyCounts` (5-digit FIPS →
  // count), using the same absolute bucket palette the old state choropleth used.
  // Counties with no alumni get no fill (the neutral state base shows through).
  const [countyFills, setCountyFills] = useState<
    { d: string; count: number }[] | null
  >(null);
  const countyCountsKey = useMemo(() => {
    const cc = countyCounts ?? {};
    return Object.keys(cc)
      .sort()
      .map((k) => `${k}:${cc[k]}`)
      .join(",");
  }, [countyCounts]);
  useEffect(() => {
    if (!countyCountsKey) {
      setCountyFills(null);
      return;
    }
    let cancelled = false;
    const cc = countyCounts ?? {};
    loadCounties().then((topo) => {
      if (cancelled) return;
      const fc = feature(
        topo,
        topo.objects.counties,
      ) as unknown as FeatureCollection<Geometry>;
      const path = geoPath(projection);
      const ds = fc.features
        .map((f) => {
          const fips = String(f.id ?? "").padStart(5, "0");
          const count = cc[fips];
          if (!count) return null;
          const d = path(f);
          return d ? { d, count } : null;
        })
        .filter((x): x is { d: string; count: number } => x !== null);
      setCountyFills(ds);
    });
    return () => {
      cancelled = true;
    };
  }, [countyCountsKey, countyCounts, projection]);

  // --- City labels (zoom-gated, viewport-culled) ------------------------------
  // Project every city once; cull to the current visible view at render time so
  // labels never crowd the map.
  const projectedCities = useMemo<ProjectedCity[]>(() => {
    return (majorCities as City[])
      .map((c) => {
        const pt = projection([c.lng, c.lat]);
        return pt ? { ...c, x: pt[0], y: pt[1] } : null;
      })
      .filter((c): c is ProjectedCity => c !== null);
  }, [projection]);

  const visibleCities = useMemo<ProjectedCity[]>(() => {
    if (view.k < CITY_ZOOM) return [];
    // The visible window in g-space (undo the zoom transform on the viewBox).
    const x0 = (0 - view.x) / view.k;
    const y0 = (0 - view.y) / view.k;
    const x1 = (WIDTH - view.x) / view.k;
    const y1 = (HEIGHT - view.y) / view.k;
    return projectedCities.filter(
      (c) => c.x >= x0 && c.x <= x1 && c.y >= y0 && c.y <= y1,
    );
  }, [projectedCities, view]);

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
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
    // Only drop a pin on US soil — ignore clicks in the ocean / off the map.
    if (!features.some((f) => geoContains(f, [lng, lat]))) return;
    onPick(lat, lng);
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
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden">
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
                fill={NEUTRAL_STATE}
                stroke="#9CA3AF"
                strokeWidth={1}
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

          {/* County choropleth — shade ONLY the counties where alumni work,
              by alumni count. pointer-events-none so the map click/pin still
              works underneath. */}
          {countyFills ? (
            <g className="pointer-events-none">
              {countyFills.map((c, i) => (
                <path key={i} d={c.d} fill={fillFor(c.count)} />
              ))}
            </g>
          ) : null}

          {/* All county borders — drawn at the same weight/color as the state
              borders, on top of the shading so every county reads uniformly. */}
          {countyMesh ? (
            <path
              className="pointer-events-none"
              d={countyMesh}
              fill="none"
              stroke="#9CA3AF"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ) : null}

          {/* Matched counties (radius search) — ring the counties that contain a
              result so the current search stands out over the choropleth. */}
          {matchCountyPaths ? (
            <g
              className="pointer-events-none"
              fill="none"
              stroke="#1C2E54"
              strokeWidth={1.75}
              vectorEffect="non-scaling-stroke"
            >
              {matchCountyPaths.map((d, i) => (
                <path key={i} d={d} vectorEffect="non-scaling-stroke" />
              ))}
            </g>
          ) : null}

          {/* City dots — drawn in g-space so they pan/zoom with the map. The dot
              radius is divided by the zoom so it stays a constant on-screen size. */}
          {visibleCities.length > 0 ? (
            <g className="pointer-events-none">
              {visibleCities.map((c) => (
                <circle
                  key={`${c.name}-${c.state}`}
                  cx={c.x}
                  cy={c.y}
                  r={2.2 / view.k}
                  fill="#2E4A86"
                  stroke="#FFFFFF"
                  strokeWidth={0.8 / view.k}
                />
              ))}
            </g>
          ) : null}
        </g>

        {/* City labels — drawn in OUTER viewBox space (after the zoom transform)
            so the text stays a constant on-screen size and never scales huge.
            pointer-events-none so the map click/pin still fires under them. */}
        {visibleCities.length > 0 ? (
          <g className="pointer-events-none" aria-hidden="true">
            {visibleCities.map((c) => {
              const sx = view.x + view.k * c.x;
              const sy = view.y + view.k * c.y;
              return (
                <text
                  key={`${c.name}-${c.state}-label`}
                  x={sx + 4}
                  y={sy - 3}
                  fontSize={10}
                  fontWeight={600}
                  fill="#1C2E54"
                  stroke="#FFFFFF"
                  strokeWidth={2.5}
                  paintOrder="stroke"
                  strokeLinejoin="round"
                >
                  {c.name}
                </text>
              );
            })}
          </g>
        ) : null}

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

      {(center && onResetCenter) || view.k > 1 ? (
        <div className="absolute right-3 top-3 z-10 flex gap-2">
          {center && onResetCenter ? (
            <button
              type="button"
              onClick={onResetCenter}
              className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 shadow-card hover:bg-gray-50"
            >
              Reset pin
            </button>
          ) : null}
          {view.k > 1 ? (
            <button
              type="button"
              onClick={() => setView({ k: 1, x: 0, y: 0 })}
              className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 shadow-card hover:bg-gray-50"
            >
              Reset zoom
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
