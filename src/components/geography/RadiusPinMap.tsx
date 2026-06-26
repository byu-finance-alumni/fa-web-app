"use client";

import { useMemo } from "react";
import { geoAlbersUsa, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import type { Topology } from "topojson-specification";
import statesTopo from "us-atlas/states-10m.json";

/**
 * Click-to-drop-a-pin US map for the radius search center picker.
 *
 * Unlike the choropleth maps (which precompute geometry on the server), this is
 * an interactive PICKER: it needs `projection.invert()` in the browser to turn a
 * click position into [lng, lat], so it intentionally runs d3-geo + topojson
 * client-side. It draws state outlines only — no data fill, no choropleth logic.
 */

const WIDTH = 960;
const HEIGHT = 600;

export function RadiusPinMap({
  center,
  onPick,
}: {
  /** Current center [lng, lat] to mark with a pin, if any. */
  center: { lat: number; lng: number } | null;
  /** Called with the picked [lng, lat] when the user clicks the map. */
  onPick: (lng: number, lat: number) => void;
}) {
  // Build the projection + state outline paths once. geoAlbersUsa fit to the
  // fixed viewBox so AK/HI insets are placed correctly; the same projection is
  // reused to invert clicks and to project the current-center pin.
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
      .map((f, i) => ({ id: String(f.id ?? i), d: path(f) }))
      .filter((p): p is { id: string; d: string } => !!p.d);
    return { paths: ds, projection: proj };
  }, []);

  // Project the current center to a pin position (null if it falls outside the
  // AlbersUsa domain — e.g. an offshore coordinate).
  const pin = useMemo(() => {
    if (!center) return null;
    const pt = projection([center.lng, center.lat]);
    return pt ? { x: pt[0], y: pt[1] } : null;
  }, [center, projection]);

  function handleClick(e: React.MouseEvent<SVGSVGElement>) {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    // Map the click from rendered pixels into the fixed viewBox coordinate space.
    const x = ((e.clientX - rect.left) / rect.width) * WIDTH;
    const y = ((e.clientY - rect.top) / rect.height) * HEIGHT;
    const inverted = projection.invert?.([x, y]);
    if (!inverted) return;
    const [lng, lat] = inverted;
    if (Number.isFinite(lng) && Number.isFinite(lat)) onPick(lng, lat);
  }

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
      className="h-full w-full cursor-crosshair select-none"
      role="img"
      aria-label="Click the map to set the search center"
      onClick={handleClick}
    >
      {paths.map((p) => (
        <path
          key={p.id}
          d={p.d}
          fill="#F3F4F6"
          stroke="#FFFFFF"
          strokeWidth={0.75}
          className="transition-[fill] hover:fill-brand-blue-50"
        />
      ))}

      {pin ? (
        <g
          className="pointer-events-none"
          transform={`translate(${pin.x}, ${pin.y})`}
          aria-label="Selected center"
        >
          {/* Soft radius halo + pin marker (white-haloed brand-blue). */}
          <circle r={11} fill="#2E4A86" opacity={0.12} />
          <circle r={6} fill="#FFFFFF" />
          <circle r={4.5} fill="#2E4A86" />
        </g>
      ) : null}
    </svg>
  );
}
