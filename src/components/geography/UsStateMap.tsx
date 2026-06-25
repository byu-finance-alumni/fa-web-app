"use client";

import { useRouter } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
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
  focusState,
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
  /** When set, the SVG viewBox is recomputed from this state's path bounding
   * box (padded) so the state is centered + enlarged while its neighbours stay
   * visible around the edges. When unset, the full-country viewBox is used. */
  focusState?: string;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const focusRef = useRef<SVGPathElement>(null);
  const [hover, setHover] = useState<{
    name: string;
    count: number;
    x: number;
    y: number;
  } | null>(null);
  // viewBox driving the SVG. Defaults to the full country; a focused state
  // swaps in a padded bounding box (computed after layout from getBBox()).
  const [viewBox, setViewBox] = useState<string>(usa.viewBox);

  const focusCode = focusState?.toUpperCase();

  // Borders are drawn in SVG user units, so when the viewBox zooms into one
  // state they'd render proportionally THICKER than on the full-country map and
  // the state would look different. Scale stroke widths by the zoom factor
  // (focused viewBox width ÷ full-country width) so every state's borders have
  // the SAME on-screen thickness they do on the whole-50-states map. Unfocused
  // (viewBox == country) → scale 1 → unchanged.
  const COUNTRY_WIDTH = Number(usa.viewBox.split(/\s+/)[2]) || 1028;
  const strokeScale =
    (Number(viewBox.split(/\s+/)[2]) || COUNTRY_WIDTH) / COUNTRY_WIDTH;

  // After the focused path renders, read its bounding box and pad it ~20% on
  // each side so the state is centered + enlarged with neighbours still in
  // frame. Falls back to the full-country viewBox when nothing is focused.
  useLayoutEffect(() => {
    if (!focusCode) {
      setViewBox(usa.viewBox);
      return;
    }
    const el = focusRef.current;
    if (!el) return;
    const b = el.getBBox();
    const padX = b.width * 0.2;
    const padY = b.height * 0.2;
    // Pad evenly, then expand the shorter axis so the box keeps the country's
    // ~1.38 aspect ratio — otherwise tall/narrow states get distorted by the
    // SVG's preserveAspectRatio "meet" fit and the centering drifts.
    let x = b.x - padX;
    let y = b.y - padY;
    let w = b.width + padX * 2;
    let h = b.height + padY * 2;
    const targetRatio = 1028 / 746;
    if (w / h < targetRatio) {
      const neededW = h * targetRatio;
      x -= (neededW - w) / 2;
      w = neededW;
    } else {
      const neededH = w / targetRatio;
      y -= (neededH - h) / 2;
      h = neededH;
    }
    setViewBox(`${x} ${y} ${w} ${h}`);
  }, [focusCode]);

  function go(id: string) {
    const code = id.toUpperCase();
    if (onSelect) {
      onSelect(code);
      return;
    }
    const qs = filterQuery ? `${filterQuery}&` : "";
    router.push(`/map/state/${code}?${qs}`.replace(/\?$/, ""));
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
      viewBox={viewBox}
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
            ref={code === focusCode ? focusRef : undefined}
            d={loc.path}
            fill={fillFor(count)}
            stroke={isSel ? "#2E4A86" : "#FFFFFF"}
            strokeWidth={(isSel ? 2.5 : 0.75) * strokeScale}
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
        className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 ${fit ? "mt-2 shrink-0" : "mt-3"}`}
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
