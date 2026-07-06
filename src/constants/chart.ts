/**
 * Data-viz palette from UX-UI.md (sequential brand blues, then on-brand
 * accents). Use ONLY for chart fills/strokes (SVG/canvas) where a Tailwind
 * token class can't be applied per-datum — UI surfaces must still use the named
 * Tailwind tokens. Deliberately not a rainbow (see UX-UI.md "no rainbow charts").
 */
export const DATA_VIZ_PALETTE = [
  "#1C2E54", // navy-800
  "#2E4A86", // brand-blue-600
  "#3B5C9A", // brand-blue-500
  "#5B7BC0",
  "#8AA4D6",
  "#15803D", // success-600 (accent)
  "#B45309", // warning-600 (accent)
  "#7C3AED", // violet (accent)
  "#0E7490", // teal (accent)
] as const;

/**
 * Neutral gray for a catch-all "Other"/uncategorized slice, so it reads as
 * "not a real category" instead of borrowing a brand accent (e.g. the green).
 * gray-400.
 */
export const CHART_MUTED_COLOR = "#9CA3AF";
