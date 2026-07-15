/**
 * Type-ahead suggestions for the world/US map search box (#406).
 *
 * All suggestion sources here are LOCAL and client-safe — the bundled major-city
 * list (with coordinates), the US state list, the industry vocabulary, and the
 * country display names the map already holds. No external geocoding is called
 * (the app's CSP blocks third-party hosts); city coordinates come straight from
 * the bundled `major-cities.json`, and everything else resolves through the
 * existing server actions / the map's own data. Alumni-name suggestions are
 * fetched separately (debounced) by the search box and merged in.
 */
import majorCities from "@/lib/geo/major-cities.json";
import { US_STATES } from "@/lib/geo/us-states";
import { INDUSTRY_OPTIONS } from "@/constants/dropdowns";
import { normalizeCountryName } from "@/lib/geo/world-countries";

type MajorCity = { name: string; state: string; lat: number; lng: number };

/** A single autocomplete row. `kind` drives how the box acts when it's picked. */
export type MapSuggestion =
  | {
      kind: "city";
      label: string;
      city: string;
      state: string;
      lat: number;
      lng: number;
    }
  | { kind: "state"; label: string; code: string }
  | { kind: "country"; label: string; key: string; display: string }
  | { kind: "industry"; label: string; value: string }
  | { kind: "company"; label: string; value: string };

/** Case-insensitive "does `haystack` start with `q`" (word-aware for cities). */
function startsWith(haystack: string, q: string): boolean {
  return haystack.toLowerCase().startsWith(q);
}
function includesWord(haystack: string, q: string): boolean {
  return haystack.toLowerCase().includes(q);
}

const CITIES = majorCities as MajorCity[];

export interface LocalSuggestionInput {
  /** Raw query text. */
  query: string;
  /** Country display names the world map knows about (topojson + counts). */
  countryNames: readonly string[];
  /** True when the world view is active — surfaces country matches first. */
  worldActive: boolean;
  /** Per-category cap (defaults tuned so the dropdown stays compact). */
  perGroup?: number;
}

/**
 * Build the LOCAL (non-alumni) suggestions for a query, ranked prefix-first then
 * substring. Returns an ordered, de-duplicated list the box renders under any
 * async alumni matches. Empty query → no local suggestions.
 */
export function buildLocalSuggestions({
  query,
  countryNames,
  worldActive,
  perGroup = 4,
}: LocalSuggestionInput): MapSuggestion[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  // Cities — prefix matches first (by name), then "City, ST" substring.
  const cityMatches = rank(
    CITIES,
    (c) => `${c.name}, ${c.state}`,
    (c) => c.name,
    q,
  )
    .slice(0, perGroup)
    .map<MapSuggestion>((c) => ({
      kind: "city",
      label: `${c.name}, ${c.state}`,
      city: c.name,
      state: c.state,
      lat: c.lat,
      lng: c.lng,
    }));

  // States — by full name, or an exact 2-letter code.
  const stateMatches = US_STATES.filter(
    (s) => includesWord(s.name, q) || s.code.toLowerCase() === q,
  )
    .sort(
      (a, b) => Number(!startsWith(a.name, q)) - Number(!startsWith(b.name, q)),
    )
    .slice(0, perGroup)
    .map<MapSuggestion>((s) => ({ kind: "state", label: s.name, code: s.code }));

  // Countries — from the names the world map holds; de-duped by canonical key.
  const seenCountry = new Set<string>();
  const countryMatches: MapSuggestion[] = [];
  for (const name of [...countryNames].sort((a, b) =>
    Number(!startsWith(a, q)) - Number(!startsWith(b, q)),
  )) {
    if (!includesWord(name, q)) continue;
    const key = normalizeCountryName(name);
    if (!key || seenCountry.has(key)) continue;
    seenCountry.add(key);
    countryMatches.push({ kind: "country", label: name, key, display: name });
    if (countryMatches.length >= perGroup) break;
  }

  // Industries — the controlled vocabulary that re-shades the map.
  const industryMatches = INDUSTRY_OPTIONS.filter((o) => includesWord(o, q))
    .sort((a, b) => Number(!startsWith(a, q)) - Number(!startsWith(b, q)))
    .slice(0, perGroup)
    .map<MapSuggestion>((o) => ({ kind: "industry", label: o, value: o }));

  // Order groups by what's most useful for the active view. Places lead; on the
  // world view countries lead the places.
  const places = worldActive
    ? [...countryMatches, ...cityMatches, ...stateMatches]
    : [...cityMatches, ...stateMatches, ...countryMatches];

  return [...places, ...industryMatches];
}

/**
 * Rank a list so prefix matches on `primary` come first, then substring matches
 * on `full`. Non-matches are dropped.
 */
function rank<T>(
  items: readonly T[],
  full: (t: T) => string,
  primary: (t: T) => string,
  q: string,
): T[] {
  const scored: { t: T; score: number }[] = [];
  for (const t of items) {
    const p = primary(t).toLowerCase();
    const f = full(t).toLowerCase();
    if (p.startsWith(q)) scored.push({ t, score: 0 });
    else if (f.includes(q)) scored.push({ t, score: 1 });
  }
  scored.sort((a, b) => a.score - b.score);
  return scored.map((s) => s.t);
}
