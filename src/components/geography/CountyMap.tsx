"use client";

import { useRef, useState } from "react";
import type { CountyMapData } from "@/lib/geo/county-map";

/**
 * Renders a single state's COUNTIES as precomputed SVG (built on the server by
 * `buildCountyMap`), colored by an absolute alumni-count bucket scale, with the
 * state's top cities plotted as labeled markers on top. No d3/topojson in the
 * browser — this only receives plain path strings + projected marker points.
 *
 * The bucket palette / legend mirror `UsStateMap` so the two maps look identical.
 */

// Absolute heatmap buckets — same fixed thresholds + palette as UsStateMap so the
// county choropleth matches the 50-state map.
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

export function CountyMap({
  paths,
  markers,
  width,
  height,
  stateName,
}: CountyMapData & { stateName: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{
    name: string;
    count: number;
    x: number;
    y: number;
  } | null>(null);

  function move(e: React.MouseEvent, name: string, count: number) {
    const rect = ref.current?.getBoundingClientRect();
    setHover({
      name,
      count,
      x: e.clientX - (rect?.left ?? 0),
      y: e.clientY - (rect?.top ?? 0),
    });
  }

  return (
    <div ref={ref} className="relative flex h-full w-full flex-col">
      <div className="relative min-h-0 flex-1">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          className="absolute inset-0 h-full w-full"
          role="img"
          aria-label={`${stateName} alumni distribution by county`}
        >
          {/* County choropleth — every county of the state is drawn; only those
              with mapped alumni get a darker fill (the rest stay lightest). */}
          {paths.map((c) => (
            <path
              key={c.fips}
              d={c.d}
              fill={fillFor(c.count)}
              stroke="#FFFFFF"
              strokeWidth={0.5}
              className="outline-none transition-[fill] hover:opacity-80"
              onMouseEnter={(e) => move(e, c.name, c.count)}
              onMouseMove={(e) => move(e, c.name, c.count)}
              onMouseLeave={() => setHover(null)}
            />
          ))}

          {/* City markers, rendered ABOVE the counties: white-haloed brand-blue
              dot (sized slightly by count) + a legible label. */}
          {markers.map((m, i) => {
            const r = 4 + Math.min(4, Math.sqrt(Math.max(0, m.count)));
            return (
              <g
                key={`${m.label}-${i}`}
                className="pointer-events-none"
                aria-label={`${m.label}: ${m.count} alumni`}
              >
                <circle
                  cx={m.x}
                  cy={m.y}
                  r={r + 1.5}
                  fill="#FFFFFF"
                  opacity={0.9}
                />
                <circle cx={m.x} cy={m.y} r={r} fill="#2E4A86" />
                <text
                  x={m.x + r + 3}
                  y={m.y + 3.5}
                  className="fill-navy-900 text-[10px] font-semibold"
                  style={{
                    paintOrder: "stroke",
                    stroke: "#FFFFFF",
                    strokeWidth: 2.5,
                    strokeLinejoin: "round",
                  }}
                >
                  {m.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {hover ? (
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

      {/* Heatmap legend (absolute thresholds) — same as UsStateMap. */}
      <div className="mt-2 flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
        <span className="font-medium">Alumni</span>
        {[...BUCKETS].reverse().map((b) => (
          <span key={b.label} className="flex items-center gap-1.5">
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
