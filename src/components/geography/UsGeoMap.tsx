"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  geoAlbersUsa,
  geoCircle,
  geoContains,
  geoPath,
  type GeoProjection,
} from "d3-geo";
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
 * Scroll to zoom toward the cursor; drag to pan. The map is level-of-detail:
 * zoomed out (below `COUNTY_ZOOM`) it shades whole STATES by `counts`; zoom in a
 * little and it switches to a COUNTY choropleth (`countyCounts`) — only the
 * counties where alumni work are shaded, states drop to a neutral base, and
 * every county border draws at the same weight/color as the state borders. The
 * ~800KB counties topojson (mesh + fills) is lazily loaded only once you cross
 * into county detail, so it never ships in the initial bundle. A radius search
 * additionally rings the result counties (`matchCounties`). Major-city dots +
 * labels appear past `CITY_ZOOM` (only for cities inside the visible view, so
 * labels never crowd the map). Choropleth palette + buckets are ported from the
 * old `UsStateMap`.
 */

const WIDTH = 960;
const HEIGHT = 600;
const MIN_K = 1;
const MAX_K = 12;
/** Per-notch wheel zoom tuning (#377) — gentle enough to frame a single state
 *  (e.g. California) without overshooting. `SENSITIVITY` scales normalized wheel
 *  pixels into an exponential zoom step; `MAX_STEP` caps any single event so a
 *  fast trackpad fling can't leap past the target. */
const WHEEL_ZOOM_SENSITIVITY = 0.0015;
const MAX_WHEEL_STEP = 0.08;
/** Zoom level at which the map switches from state shading to COUNTY shading
 *  (zoomed out = shaded states only; zoom in a little = shaded counties). */
const COUNTY_ZOOM = 2;
/** Zoom level at which major-city dots + labels start rendering. */
const CITY_ZOOM = 4;
/** At/above this zoom the radius map is "viewing a single state" (#378 follow-up):
 *  alumni city dots are visible and a click on land drops a radius pin. BELOW it
 *  (the US overview) a click on a state focuses/zooms into that state instead —
 *  so pin-drop only becomes available AFTER you've drilled into a state. Tied to
 *  the dot-reveal zoom so "pin-drop" and "populated areas visible" coincide. */
const FOCUS_ZOOM = CITY_ZOOM;

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
  /** Radius distance in miles — when a `center` is set, the search area is drawn
   *  as a geodesic circle around it. */
  miles?: number;
  onStateClick?: (code: string) => void;
  onPick?: (lat: number, lng: number) => void;
  /** Clear the current radius center/pin (renders a "Reset pin" button). */
  onResetCenter?: () => void;
  /** Fires with the focused state when the user zooms into one on the map (the
   *  in-map focus flow), and null when they zoom back out to the overview. Lets a
   *  parent drive a contextual "top cities for this state" panel. */
  onFocusChange?: (focus: { code: string } | null) => void;
  /** Imperative focus request from the parent (e.g. a ranked-state row click).
   *  The bumped nonce re-triggers even when the same state is requested again. */
  focusRequest?: { code: string; n: number } | null;
  /** Draw the county BOUNDARY LINE overlay (the county mesh strokes) when zoomed
   *  into county detail. Default true; false hides just the lines — the county
   *  choropleth shading, matched-alumni rings, and city dots are unaffected. */
  showCountyLines?: boolean;
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
  miles,
  onStateClick,
  onPick,
  onResetCenter,
  onFocusChange,
  focusRequest,
  showCountyLines = true,
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
  // Which state the map is currently framing (null on the US overview). Set by
  // the in-map focus flow, cleared on zoom-out; mirrored to the parent so it can
  // switch its ranked widget from "top states" to "top cities" for this state.
  const [focusedCode, setFocusedCode] = useState<string | null>(null);
  // Drag state + a "did we actually drag" flag so a drag never fires a click.
  // `captured` mirrors WorldGeoMap: we defer pointer-capture until a real drag
  // starts, because capturing on pointerdown redirects the click to the SVG and
  // a plain click would never reach the state <path> (where focus-a-state lives).
  const drag = useRef<{
    active: boolean;
    ox: number;
    oy: number;
    moved: boolean;
    captured: boolean;
  }>({ active: false, ox: 0, oy: 0, moved: false, captured: false });

  // Level-of-detail: shaded STATES when zoomed out, shaded COUNTIES once you
  // zoom in past COUNTY_ZOOM. Gates both the county-topojson load and rendering.
  const showCounties = view.k >= COUNTY_ZOOM;

  const { paths, projection, features, boundsByUsps } = useMemo(() => {
    const topo = statesTopo as unknown as Topology;
    const fc = feature(
      topo,
      topo.objects.states,
    ) as unknown as FeatureCollection<Geometry>;
    // Zoomed-OUT default framing: generous padding shrinks the landmass into the
    // middle of the viewBox with wide margins on every side, so the floating
    // overlays never sit on the US at the overview — extra room on the LEFT (the
    // controls box) and at top/bottom corners (view toggle + ranked widget /
    // radius results). Slightly more left than right inset nudges the landmass a
    // touch right of the controls while still reading centered. The AK/HI insets
    // are part of the fitted bounds, so the larger padding never clips them. This
    // only sets the OVERVIEW frame; click-to-focus recomputes its own zoom from
    // the (same) projection, so FOCUS_ZOOM / dot-reveal / pin-drop are unchanged.
    const proj = geoAlbersUsa().fitExtent(
      [
        [260, 150],
        [WIDTH - 190, HEIGHT - 150],
      ],
      fc,
    );
    const path = geoPath(proj);
    // Per-state projected bounding box (g-space) — used to frame a state on
    // click (#378 follow-up: click-to-focus computes a fit-to-state zoom).
    const bounds: Record<string, [[number, number], [number, number]]> = {};
    const ds = fc.features
      .map((f, i) => {
        const fips = String(f.id ?? i).padStart(2, "0");
        const usps = FIPS_TO_USPS[fips] ?? "";
        const props = (f.properties ?? {}) as { name?: string };
        if (usps) bounds[usps] = path.bounds(f as Feature);
        return {
          id: fips,
          usps,
          name: props.name ?? "",
          d: path(f),
        };
      })
      .filter((p): p is StatePath => !!p.d);
    return {
      paths: ds,
      projection: proj as GeoProjection,
      features: fc.features as Feature[],
      boundsByUsps: bounds,
    };
  }, []);

  // --- Matched counties (lazy) ------------------------------------------------
  // The counties that contain a matched alumnus, ringed at the county detail
  // level (zoomed in past COUNTY_ZOOM). We lazily load the ~800KB counties
  // topojson the first time there's a match while zoomed in, then keep only the
  // wanted county geometries (by 5-digit FIPS).
  const [matchCountyPaths, setMatchCountyPaths] = useState<string[] | null>(null);
  const matchKey =
    matchCounties && matchCounties.length ? [...matchCounties].sort().join(",") : "";
  useEffect(() => {
    if (!showCounties || !matchKey) {
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
  }, [matchKey, projection, showCounties]);

  // --- County borders (lazy) --------------------------------------------------
  // Every county outline, always shown at the same weight/color as the state
  // borders. We render them as ONE mesh path (all interior county-county borders)
  // rather than thousands of polygons, so it stays cheap. The ~800KB counties
  // topojson is dynamically imported (never in the initial bundle).
  const [countyMesh, setCountyMesh] = useState<string | null>(null);
  useEffect(() => {
    // Skip the mesh entirely when county lines are toggled off (#2) — no reason
    // to build the ~800KB border path we won't draw.
    if (!showCounties || !showCountyLines) return;
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
  }, [projection, showCounties, showCountyLines]);

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
    if (!showCounties || !countyCountsKey) {
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
  }, [countyCountsKey, countyCounts, projection, showCounties]);

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

  // Radius search area — a true geodesic circle around the center, projected
  // through the same Albers projection so it's drawn as a proper (warped) area
  // on the map rather than a screen-space oval. Radius is converted from miles
  // to degrees (~69 mi/deg). Drawn in g-space so it pans/zooms with the map; the
  // stroke uses vectorEffect="non-scaling-stroke" so it stays a constant weight.
  const radiusPath = useMemo(() => {
    if (!center || !miles || miles <= 0) return null;
    const circle = geoCircle()
      .center([center.lng, center.lat])
      .radius(miles / 69)();
    return geoPath(projection)(circle) || null;
  }, [center, miles, projection]);

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

  // In-map focus (#378 follow-up): zoom/pan to frame a single state from the US
  // overview, reusing the state's projected bounding box. We always land at
  // >= FOCUS_ZOOM (its alumni city dots become visible + land clicks now drop a
  // radius pin) and at most MAX_K, centered on the state. This replaces a route
  // navigation so the radius pin/results stack stays intact underneath, and marks
  // the state focused so the parent can show its top cities.
  const focusStateInMap = useCallback(
    (usps: string) => {
      const b = boundsByUsps[usps];
      if (!b) return;
      const [[x0, y0], [x1, y1]] = b;
      const w = x1 - x0;
      const h = y1 - y0;
      if (!(w > 0) || !(h > 0)) return;
      const PAD = 1.25; // ~12% breathing room around the state on each axis
      const fitK = Math.min(WIDTH / (w * PAD), HEIGHT / (h * PAD));
      const k = Math.min(MAX_K, Math.max(FOCUS_ZOOM, fitK));
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      setView({ k, x: WIDTH / 2 - k * cx, y: HEIGHT / 2 - k * cy });
      setFocusedCode(usps);
      onFocusChange?.({ code: usps });
    },
    [boundsByUsps, onFocusChange],
  );

  // Zooming back out to the overview clears the focused state (reverting the
  // parent's widget to "top states").
  useEffect(() => {
    if (view.k < FOCUS_ZOOM && focusedCode !== null) {
      setFocusedCode(null);
      onFocusChange?.(null);
    }
  }, [view.k, focusedCode, onFocusChange]);

  // Parent-driven focus (e.g. a ranked-state row click). The nonce bump re-runs
  // this even when the same state is requested again after zooming out.
  useEffect(() => {
    if (focusRequest) focusStateInMap(focusRequest.code);
  }, [focusRequest, focusStateInMap]);

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
      // Gentle, clamped multiplicative step so one wheel notch nudges the zoom
      // instead of leaping (#377 — was a fixed ×1.2 per notch, which overshot a
      // single state). Normalize by deltaMode so line/page-mode wheels don't
      // jump, and cap the per-event magnitude so a fast fling can't blow past.
      let delta = e.deltaY;
      if (e.deltaMode === 1) delta *= 16; // lines -> px
      else if (e.deltaMode === 2) delta *= HEIGHT; // pages -> px
      const step = Math.max(
        -MAX_WHEEL_STEP,
        Math.min(MAX_WHEEL_STEP, -delta * WHEEL_ZOOM_SENSITIVITY),
      );
      const factor = Math.exp(step);
      setView((v) => {
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
    // Don't capture yet (see `drag` note) — capture only once a real drag begins
    // so a plain click still lands on the state <path> under the cursor.
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
      // Now that we're really panning, capture so movement off the SVG tracks.
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
    if (drag.current.captured && e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
    // Defer clearing `active` so the click handler (fires right after) can read
    // `moved` to suppress a pin/state click that was really a drag.
    drag.current.active = false;
    drag.current.captured = false;
  }

  function handleSvgClick(e: React.MouseEvent<SVGSVGElement>) {
    if (drag.current.moved) {
      drag.current.moved = false;
      return;
    }
    if (mode !== "radius" || !onPick) return;
    // Pin-drop only once ZOOMED IN to a state (#378 follow-up). On the US
    // overview (below FOCUS_ZOOM) a land click focuses a state instead — the
    // per-state onClick handles that and stops propagation, so a stray click
    // that reaches here while zoomed out (e.g. an ocean click) drops nothing.
    if (view.k < FOCUS_ZOOM) return;
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
        // Center the map in its (now full-width) area. Click→coords math uses
        // getScreenCTM().inverse(), so it stays correct under any alignment.
        preserveAspectRatio="xMidYMid meet"
        className={`absolute inset-0 h-full w-full touch-none select-none ${
          view.k >= FOCUS_ZOOM && mode === "radius"
            ? "cursor-crosshair" // zoomed into a state: click a location to pin
            : view.k > 1
              ? "cursor-grab"
              : "" // overview: hover a state (pointer) to focus it
        }`}
        role="img"
        aria-label={
          isExplore
            ? "US alumni distribution by state. Scroll to zoom, drag to pan."
            : "Click a state to zoom in and reveal its alumni, then click a location to set the search center. Scroll to zoom, drag to pan."
        }
        onClick={handleSvgClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <g transform={`translate(${view.x}, ${view.y}) scale(${view.k})`}>
          {paths.map((p) => {
            const count = counts[p.usps] ?? 0;
            // States are hoverable/clickable in both modes (#378). In explore mode
            // a click drills into the state's detail page; on the radius map a
            // click from the US OVERVIEW focuses/zooms into the state, and once
            // zoomed in the click falls through to drop a radius pin instead.
            const interactive = !!p.usps;
            return (
              <path
                key={p.id}
                d={p.d}
                fill={showCounties ? NEUTRAL_STATE : fillFor(count)}
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
                        if (drag.current.moved) {
                          // A drag ended on this state — swallow the click so it
                          // neither focuses the state nor bubbles to drop a pin.
                          drag.current.moved = false;
                          e.stopPropagation();
                          return;
                        }
                        // Explore mode: drill into the state's detail page.
                        if (isExplore) {
                          e.stopPropagation();
                          onStateClick?.(p.usps);
                          return;
                        }
                        // Radius map, US overview (zoomed out): focus this state.
                        // Zoomed in: don't stop propagation — let the click reach
                        // the SVG handler so it drops a radius pin here instead.
                        if (view.k < FOCUS_ZOOM) {
                          e.stopPropagation();
                          focusStateInMap(p.usps);
                        }
                      }
                    : undefined
                }
                onKeyDown={
                  interactive
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          if (isExplore) onStateClick?.(p.usps);
                          else if (view.k < FOCUS_ZOOM) focusStateInMap(p.usps);
                        }
                      }
                    : undefined
                }
              />
            );
          })}

          {/* County choropleth — shade ONLY the counties where alumni work,
              by alumni count. Only once zoomed in past COUNTY_ZOOM (zoomed out
              shows shaded states instead). pointer-events-none so the map
              click/pin still works underneath. */}
          {showCounties && countyFills ? (
            <g className="pointer-events-none">
              {countyFills.map((c, i) => (
                <path key={i} d={c.d} fill={fillFor(c.count)} />
              ))}
            </g>
          ) : null}

          {/* All county borders — drawn at the same weight/color as the state
              borders, on top of the shading so every county reads uniformly.
              Only once zoomed in (zoomed out is state outlines only). */}
          {showCounties && showCountyLines && countyMesh ? (
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
              result so the current search stands out over the choropleth (county
              detail level only). */}
          {showCounties && matchCountyPaths ? (
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

          {/* Radius search area — the geodesic circle around the center, in
              g-space so it pans/zooms with the map. A translucent fill makes the
              covered area read clearly; the ring is a constant on-screen weight.
              pointer-events-none so the map click/pin still fires underneath. */}
          {radiusPath ? (
            <path
              className="pointer-events-none"
              d={radiusPath}
              fill="#2E4A86"
              fillOpacity={0.1}
              stroke="#2E4A86"
              strokeWidth={1.75}
              strokeOpacity={0.9}
              vectorEffect="non-scaling-stroke"
            />
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
        <div className="absolute right-4 top-4 z-10 flex gap-3">
          {center && onResetCenter ? (
            <button
              type="button"
              onClick={onResetCenter}
              className="rounded-lg border border-gray-200 bg-white px-5 py-3 text-base font-semibold text-gray-700 shadow-card hover:bg-gray-50"
            >
              Reset pin
            </button>
          ) : null}
          {view.k > 1 ? (
            <button
              type="button"
              onClick={() => setView({ k: 1, x: 0, y: 0 })}
              className="rounded-lg border border-gray-200 bg-white px-5 py-3 text-base font-semibold text-gray-700 shadow-card hover:bg-gray-50"
            >
              Reset zoom
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
