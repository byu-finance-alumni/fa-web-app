"use server";

import cityCrosswalk from "@/lib/geo/city-crosswalk.json";
import majorCities from "@/lib/geo/major-cities.json";
import { lookupCityGeo, STATE_FIPS } from "@/lib/geo/counties-data";
import { apiGet, ApiError } from "@/lib/api";
import type {
  CountryDetail,
  GeoAlumniPage,
  StateDetail,
} from "@/types/geography";

const GEO_FILTER_KEYS = [
  "industry",
  "employer",
  "year",
  "region",
  "tag",
] as const;

/** Result of a world-view country drill-down fetch. `forbidden` distinguishes a
 * 403 (not provisioned) from a generic failure so the panel can explain it. */
export type CountryDetailResult =
  | { ok: true; detail: CountryDetail }
  | { ok: false; forbidden: boolean };

/**
 * Fetch the aggregate drill-down for one country (world view), passing through
 * the same map-wide filters the choropleth uses so the panel stays consistent
 * with the shading. Aggregate only (view-access) — never throws; returns a
 * typed ok/error the client renders.
 */
export async function getCountryDetail(
  country: string,
  filters: Partial<Record<(typeof GEO_FILTER_KEYS)[number], string>> = {},
): Promise<CountryDetailResult> {
  const name = (country ?? "").trim();
  if (!name) return { ok: false, forbidden: false };
  const p = new URLSearchParams();
  for (const k of GEO_FILTER_KEYS) {
    const v = filters[k];
    if (v) p.set(k, v);
  }
  const qs = p.toString();
  try {
    const detail = await apiGet<CountryDetail>(
      `/geography/countries/${encodeURIComponent(name)}${qs ? `?${qs}` : ""}`,
      { revalidate: 60, tags: ["geography"] },
    );
    return { ok: true, detail };
  } catch (e) {
    return { ok: false, forbidden: e instanceof ApiError && e.status === 403 };
  }
}

/** Result of a world-view country alumni-list fetch (the individual alumni
 * behind a country). `forbidden` is a 403 — the list is full-access only. */
export type CountryAlumniResult =
  | { ok: true; page: GeoAlumniPage }
  | { ok: false; forbidden: boolean };

/**
 * Fetch the individual alumni in one country (world-view drill-down), paginated
 * + filtered like the choropleth. Full-access only (view-only gets a 403, which
 * the panel explains). Never throws.
 */
export async function getCountryAlumni(
  country: string,
  filters: Partial<Record<(typeof GEO_FILTER_KEYS)[number], string>> = {},
  { limit = 50, offset = 0 }: { limit?: number; offset?: number } = {},
): Promise<CountryAlumniResult> {
  const name = (country ?? "").trim();
  if (!name) return { ok: false, forbidden: false };
  const p = new URLSearchParams();
  p.set("limit", String(limit));
  p.set("offset", String(offset));
  for (const k of GEO_FILTER_KEYS) {
    const v = filters[k];
    if (v) p.set(k, v);
  }
  try {
    const page = await apiGet<GeoAlumniPage>(
      `/geography/countries/${encodeURIComponent(name)}/alumni?${p.toString()}`,
    );
    return { ok: true, page };
  } catch (e) {
    return { ok: false, forbidden: e instanceof ApiError && e.status === 403 };
  }
}

/**
 * Top cities (by alumni count) for one US state, for the map's contextual ranked
 * widget when a state is focused. Reuses the SAME `/geography/states/{code}`
 * endpoint the state-detail page already renders its top-cities rail from — the
 * per-city breakdown isn't in the per-state/per-county data already flowing to
 * the map, so this is a client-triggered read of an existing endpoint (no
 * backend/API change), passing the active map filters so the ranking matches the
 * shading. Never throws — returns [] on any error so the widget degrades quietly.
 */
export async function getStateTopCities(
  code: string,
  filters: Partial<Record<(typeof GEO_FILTER_KEYS)[number], string>> = {},
): Promise<{ city: string; count: number }[]> {
  const usps = (code ?? "").trim().toUpperCase();
  if (!usps) return [];
  const p = new URLSearchParams();
  for (const k of GEO_FILTER_KEYS) {
    const v = filters[k];
    if (v) p.set(k, v);
  }
  const qs = p.toString();
  try {
    const detail = await apiGet<StateDetail>(
      `/geography/states/${encodeURIComponent(usps)}${qs ? `?${qs}` : ""}`,
      { revalidate: 60, tags: ["geography"] },
    );
    return [...(detail.cities ?? [])].sort((a, b) => b.count - a.count);
  } catch {
    return [];
  }
}

/**
 * Result of geocoding a typed "City, ST" (or bare "City") string to a center
 * point for the radius search. `label` is a tidy "City, ST" for display.
 *
 * `spannedStates` (optional) lists the OTHER states a bare city name also
 * matched, so the UI can note the search spans states while still resolving.
 */
export type GeocodeResult =
  | {
      ok: true;
      lat: number;
      lng: number;
      label: string;
      spannedStates?: string[];
    }
  | { ok: false; error: string };

/** The compact generated crosswalk, keyed "<cityLowercased>|<ST>". Server-only. */
const CROSSWALK = cityCrosswalk as unknown as Record<
  string,
  [string, number, number] | undefined
>;

const VALID_STATES = new Set(Object.keys(STATE_FIPS));

/**
 * Population-rank proxy for tie-breaking a bare city name across states. The
 * major-cities list is ordered most-populous-first; map "<city>|<ST>" → its
 * index so a smaller rank wins. Cities absent from the list share the worst
 * rank (Infinity) and fall back to deterministic (alphabetical-state) order.
 */
const MAJOR_CITY_RANK: Record<string, number> = (() => {
  const rank: Record<string, number> = {};
  (majorCities as { name: string; state: string }[]).forEach((c, i) => {
    const key = `${c.name.toLowerCase()}|${c.state.toUpperCase()}`;
    if (!(key in rank)) rank[key] = i;
  });
  return rank;
})();

/** Title-case a city for display ("salt lake city" → "Salt Lake City"). */
function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/**
 * Geocode a typed place to a center point, using the SERVER-ONLY city crosswalk
 * (`lookupCityGeo`). Accepts:
 *   - "City, ST"  → exact lookup for that state.
 *   - "City"      → resolves only if exactly ONE state has that city; otherwise
 *                   returns a helpful error listing the ambiguity.
 *
 * Never throws — always returns a typed ok/error result the client renders.
 */
export async function geocodePlace(place: string): Promise<GeocodeResult> {
  const raw = (place ?? "").trim();
  if (!raw) return { ok: false, error: "Enter a city to search." };

  const parts = raw.split(",").map((p) => p.trim());

  // "City, ST" — explicit state.
  if (parts.length >= 2 && parts[1]) {
    const city = parts[0];
    const state = parts[1].toUpperCase();
    if (!city) return { ok: false, error: "Enter a city to search." };
    if (!VALID_STATES.has(state)) {
      return {
        ok: false,
        error: `"${parts[1]}" isn't a US state abbreviation (e.g. NY, CA, UT).`,
      };
    }
    const geo = lookupCityGeo(city, state);
    if (!geo) {
      return {
        ok: false,
        error: `Couldn't find "${titleCase(city)}, ${state}". Check the spelling, or drop a pin on the map.`,
      };
    }
    return {
      ok: true,
      lat: geo.lat,
      lng: geo.lng,
      label: `${titleCase(city)}, ${state}`,
    };
  }

  // Bare "City" — resolve even when the name spans several states (#210). We no
  // longer fail on ambiguity: pick the most prominent match (major-city
  // population rank, then alphabetical state as a stable fallback) and report
  // the other states so the UI can note the search spans states.
  const city = parts[0];
  const cityKey = city.toLowerCase();
  const matches: { state: string; lat: number; lng: number; rank: number }[] =
    [];
  for (const state of VALID_STATES) {
    const row = CROSSWALK[`${cityKey}|${state}`];
    if (row) {
      const rank = MAJOR_CITY_RANK[`${cityKey}|${state}`] ?? Infinity;
      matches.push({ state, lat: row[1], lng: row[2], rank });
    }
  }

  if (matches.length === 0) {
    return {
      ok: false,
      error: `Couldn't find "${titleCase(city)}". Try "City, ST" (e.g. Provo, UT), or drop a pin on the map.`,
    };
  }

  // Best match: lowest population rank wins; ties (and unranked) break by state
  // alphabetically so the result is deterministic.
  matches.sort((a, b) => a.rank - b.rank || a.state.localeCompare(b.state));
  const best = matches[0];
  const otherStates = matches
    .slice(1)
    .map((m) => m.state)
    .sort();

  // Apply the curated overrides (e.g. New York → Manhattan) for the chosen match
  // so a bare city resolves to the same point "City, ST" would.
  const geo = lookupCityGeo(city, best.state);
  return {
    ok: true,
    lat: geo?.lat ?? best.lat,
    lng: geo?.lng ?? best.lng,
    label: `${titleCase(city)}, ${best.state}`,
    ...(otherStates.length ? { spannedStates: otherStates } : {}),
  };
}

/** Full state name → USPS abbreviation, for the map's State search (#214). DC
 *  included so the typed search covers the same 51 the crosswalk does. */
const STATE_NAME_TO_USPS: Record<string, string> = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  "district of columbia": "DC",
  "washington dc": "DC",
  "washington d.c.": "DC",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY",
};

/**
 * Resolve a typed state (a 2-letter USPS code OR a full state name) to its USPS
 * abbreviation for the map's State search. Returns null when it isn't a US
 * state, so the caller can show a tidy error. Never throws.
 */
export async function resolveState(
  query: string,
): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  const raw = (query ?? "").trim();
  if (!raw) return { ok: false, error: "Enter a state to search." };
  const upper = raw.toUpperCase();
  if (VALID_STATES.has(upper)) return { ok: true, code: upper };
  const byName = STATE_NAME_TO_USPS[raw.toLowerCase()];
  if (byName) return { ok: true, code: byName };
  return {
    ok: false,
    error: `"${raw}" isn't a US state. Try a name (e.g. Utah) or code (e.g. UT).`,
  };
}

/**
 * Reverse-geocode a dropped-pin (lat, lng) to the NEAREST city in the crosswalk,
 * returned as a tidy "City, ST" for display. Longitude is scaled by cos(lat) so
 * the nearest-by-degrees comparison is reasonable. Returns null if nothing fits.
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<string | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const cosLat = Math.cos((lat * Math.PI) / 180);
  let bestKey: string | null = null;
  let bestD = Infinity;
  for (const key in CROSSWALK) {
    const row = CROSSWALK[key];
    if (!row) continue;
    const dLat = lat - row[1];
    const dLng = (lng - row[2]) * cosLat;
    const d = dLat * dLat + dLng * dLng;
    if (d < bestD) {
      bestD = d;
      bestKey = key;
    }
  }
  if (!bestKey) return null;
  const i = bestKey.lastIndexOf("|");
  return `${titleCase(bestKey.slice(0, i))}, ${bestKey.slice(i + 1).toUpperCase()}`;
}
