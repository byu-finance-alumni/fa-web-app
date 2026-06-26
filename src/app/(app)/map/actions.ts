"use server";

import cityCrosswalk from "@/lib/geo/city-crosswalk.json";
import { lookupCityGeo, STATE_FIPS } from "@/lib/geo/counties-data";

/**
 * Result of geocoding a typed "City, ST" (or bare "City") string to a center
 * point for the radius search. `label` is a tidy "City, ST" for display.
 */
export type GeocodeResult =
  | { ok: true; lat: number; lng: number; label: string }
  | { ok: false; error: string };

/** The compact generated crosswalk, keyed "<cityLowercased>|<ST>". Server-only. */
const CROSSWALK = cityCrosswalk as unknown as Record<
  string,
  [string, number, number] | undefined
>;

const VALID_STATES = new Set(Object.keys(STATE_FIPS));

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

  // Bare "City" — resolve only if unambiguous across states.
  const city = parts[0];
  const cityKey = city.toLowerCase();
  const matches: { state: string; lat: number; lng: number }[] = [];
  for (const state of VALID_STATES) {
    const row = CROSSWALK[`${cityKey}|${state}`];
    if (row) matches.push({ state, lat: row[1], lng: row[2] });
  }

  if (matches.length === 0) {
    return {
      ok: false,
      error: `Couldn't find "${titleCase(city)}". Try "City, ST" (e.g. Provo, UT), or drop a pin on the map.`,
    };
  }
  if (matches.length > 1) {
    const states = matches
      .map((m) => m.state)
      .sort()
      .slice(0, 6)
      .join(", ");
    return {
      ok: false,
      error: `"${titleCase(city)}" exists in several states (${states}${
        matches.length > 6 ? ", …" : ""
      }). Add a state — e.g. "${titleCase(city)}, ${matches[0].state}".`,
    };
  }

  const only = matches[0];
  return {
    ok: true,
    lat: only.lat,
    lng: only.lng,
    label: `${titleCase(city)}, ${only.state}`,
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
