"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import usa from "@svg-maps/usa";

/**
 * Real, self-contained US choropleth — actual state shapes from the bundled
 * `@svg-maps/usa` path data (no map API, no network). Each state is filled by an
 * ABSOLUTE alumni-count threshold (designed for thousands of alumni, not the
 * current mock set), with a hover tooltip and a legend. Clicking a state drives
 * the URL (?state=) so the server renders its drawer; active filters are kept.
 */

// Absolute heatmap buckets — fixed thresholds so the scale is meaningful at
// 8,000+ alumni and hundreds of cities (not normalized to the current max).
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

export function UsStateMap({
  counts,
  selected,
  filterQuery = "",
  onSelect,
  fit = false,
}: {
  counts: Record<string, number>;
  selected: string | null;
  /** Current filter query string (without state), preserved on navigation. */
  filterQuery?: string;
  /** If provided, clicking a state calls this (client drawer) instead of
   * navigating. Used by the geography explorer; the dashboard omits it. */
  onSelect?: (code: string) => void;
  /** Scale the map to fill its container's HEIGHT (so the whole map is visible
   * without scrolling) instead of sizing by width. */
  fit?: boolean;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{
    name: string;
    count: number;
    x: number;
    y: number;
  } | null>(null);

  function go(id: string) {
    const code = id.toUpperCase();
    if (onSelect) {
      onSelect(code);
      return;
    }
    const qs = filterQuery ? `${filterQuery}&` : "";
    router.push(`/map?${qs}state=${code}`);
  }

  function move(e: React.MouseEvent, name: string, count: number) {
    const rect = ref.current?.getBoundingClientRect();
    setHover({
      name,
      count,
      x: e.clientX - (rect?.left ?? 0),
      y: e.clientY - (rect?.top ?? 0),
    });
  }

  const svg = (
    <svg
      viewBox={usa.viewBox}
      preserveAspectRatio="xMidYMid meet"
      className={fit ? "absolute inset-0 h-full w-full" : "h-auto w-full"}
      role="img"
      aria-label="US alumni distribution by state"
    >
      {usa.locations.map((loc) => {
        const code = loc.id.toUpperCase();
        const count = counts[code] ?? 0;
        const isSel = selected === code;
        return (
          <path
            key={loc.id}
            d={loc.path}
            fill={fillFor(count)}
            stroke={isSel ? "#2E4A86" : "#FFFFFF"}
            strokeWidth={isSel ? 2.5 : 0.75}
            className="cursor-pointer outline-none transition-[fill,stroke] hover:opacity-80"
            tabIndex={0}
            role="button"
            aria-label={`${loc.name}: ${count} alumni`}
            onMouseEnter={(e) => move(e, loc.name, count)}
            onMouseMove={(e) => move(e, loc.name, count)}
            onMouseLeave={() => setHover(null)}
            onClick={() => go(loc.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") go(loc.id);
            }}
          />
        );
      })}
    </svg>
  );

  return (
    <div
      ref={ref}
      className={
        fit ? "relative flex h-full w-full flex-col" : "relative w-full"
      }
    >
      {fit ? (
        <div className="relative min-h-0 flex-1">{svg}</div>
      ) : (
        svg
      )}

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

      {/* Heatmap legend (absolute thresholds) */}
      <div
        className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-500 ${fit ? "mt-2 shrink-0" : "mt-3"}`}
      >
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
