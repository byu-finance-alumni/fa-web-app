/**
 * World-map country helpers (#238/#239).
 *
 * The world view joins backend per-country alumni counts (keyed by the country
 * string stored on the alumnus, e.g. "United Kingdom") to the `world-atlas`
 * countries-110m polygons (whose `properties.name` uses its own spellings, e.g.
 * "United States of America"). We normalize both sides to a single canonical
 * key so the two datasets line up regardless of spelling.
 *
 * Centroids are computed at runtime from each polygon (d3-geo `geoCentroid`), so
 * no centroid table is needed for countries present in the topojson. A few
 * financial hubs are too small to appear in the low-res 110m dataset (Singapore,
 * Hong Kong, …) — for those we fall back to a hand-kept centroid so their bubble
 * still plots. See `FALLBACK_CENTROIDS`.
 */

/**
 * Canonicalize a country name for joining backend counts to topojson features:
 * lower-cased, trimmed, punctuation stripped, with common spelling variants
 * folded to one key. Applied identically to both sides before matching.
 */
export function normalizeCountryName(value: string | null | undefined): string {
  const v = (value ?? "")
    .toLowerCase()
    .replace(/[.'’]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return NAME_ALIASES[v] ?? v;
}

// Common spelling variants → a single canonical key. Kept small: only the
// divergences that actually occur between our data and the 110m atlas plus the
// obvious user-facing synonyms.
const NAME_ALIASES: Record<string, string> = {
  usa: "united states",
  us: "united states",
  "united states of america": "united states",
  america: "united states",
  uk: "united kingdom",
  "great britain": "united kingdom",
  england: "united kingdom",
  "republic of korea": "south korea",
  korea: "south korea",
  "democratic republic of the congo": "dem rep congo",
  "republic of the congo": "congo",
  "czech republic": "czechia",
  uae: "united arab emirates",
};

// Centroid [lng, lat] for countries absent from the low-res countries-110m
// dataset (mostly microstates / city-states that are common finance hubs), so
// their count bubble still plots even without a polygon to shade.
export const FALLBACK_CENTROIDS: Record<string, [number, number]> = {
  singapore: [103.82, 1.35],
  "hong kong": [114.17, 22.32],
  macau: [113.55, 22.2],
  luxembourg: [6.13, 49.61],
  bahrain: [50.55, 26.07],
  qatar: [51.23, 25.3],
  malta: [14.4, 35.9],
  monaco: [7.42, 43.74],
  liechtenstein: [9.55, 47.16],
  mauritius: [57.55, -20.35],
  "cayman islands": [-81.25, 19.31],
  bermuda: [-64.75, 32.32],
};

// Country names that mean the United States — the world view is international,
// so these are never shaded/plotted here (the US view covers them).
export const US_CANONICAL = "united states";
