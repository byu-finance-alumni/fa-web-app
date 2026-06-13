/**
 * Static geo crosswalks for the county-level state map.
 *
 * `STATE_FIPS` maps a 2-letter USPS abbreviation to its 2-digit state FIPS code
 * (matching the first two digits of every county id in `us-atlas`).
 *
 * The city -> county+coordinates crosswalk maps a city to the coordinates used
 * to plot its labeled marker plus the 5-digit county FIPS the city sits in
 * (used to attribute the city's alumni count to its county for the choropleth
 * fill).
 *
 * ---------------------------------------------------------------------------
 * SERVER-SIDE ONLY
 * ---------------------------------------------------------------------------
 * The comprehensive crosswalk lives in `./city-crosswalk.json` (~1.3 MB, every
 * US Census place). This module imports that JSON, so this module — and the
 * JSON — must ONLY ever be imported by server code (the projection helper
 * `county-map.ts`, which is itself server-only). It must NEVER be imported by a
 * client component, or the dataset would be shipped to the browser bundle.
 * `CountyMap.tsx` (the client component) imports only the `CountyMapData` *type*
 * from `county-map.ts`, never this module — keep it that way.
 *
 * The crosswalk JSON is generated reproducibly by
 * `scripts/build-city-crosswalk.mjs` from the US Census 2023 Gazetteer "Places"
 * file (place name + USPS state + interior lat/lng), with county FIPS derived by
 * a point-in-polygon spatial join against the `us-atlas` county polygons we
 * already ship. Regenerate with: `node scripts/build-city-crosswalk.mjs`.
 */

import cityCrosswalk from "./city-crosswalk.json";

/** USPS abbreviation → 2-digit state FIPS code (all 50 states + DC). */
export const STATE_FIPS: Record<string, string> = {
  AL: "01",
  AK: "02",
  AZ: "04",
  AR: "05",
  CA: "06",
  CO: "08",
  CT: "09",
  DE: "10",
  DC: "11",
  FL: "12",
  GA: "13",
  HI: "15",
  ID: "16",
  IL: "17",
  IN: "18",
  IA: "19",
  KS: "20",
  KY: "21",
  LA: "22",
  ME: "23",
  MD: "24",
  MA: "25",
  MI: "26",
  MN: "27",
  MS: "28",
  MO: "29",
  MT: "30",
  NE: "31",
  NV: "32",
  NH: "33",
  NJ: "34",
  NM: "35",
  NY: "36",
  NC: "37",
  ND: "38",
  OH: "39",
  OK: "40",
  OR: "41",
  PA: "42",
  RI: "44",
  SC: "45",
  SD: "46",
  TN: "47",
  TX: "48",
  UT: "49",
  VT: "50",
  VA: "51",
  WA: "53",
  WV: "54",
  WI: "55",
  WY: "56",
};

export interface CityGeo {
  lng: number;
  lat: number;
  /** 5-digit county FIPS the city sits in. */
  countyFips: string;
}

/**
 * Compact generated crosswalk: "<cityLowercased>|<ST>" → [countyFips, lat, lng].
 * Server-only (see file header). Typed loosely because it comes from JSON.
 */
const CROSSWALK = cityCrosswalk as unknown as Record<
  string,
  [string, number, number] | undefined
>;

/**
 * Hand-curated overrides that take precedence over the generated data. These
 * preserve the exact county + coordinates the original mock-seeded crosswalk
 * used, for cities where the Census single interior point diverges from intent:
 *   - New York City spans 5 counties; the mock attributes it to Manhattan
 *     (New York County, 36061) rather than the city's overall interior point,
 *     which falls in Brooklyn.
 *   - San Francisco's Census interior point sits offshore (Farallon Islands);
 *     pin it at the city proper in San Francisco County (06075).
 * Keyed identically to the generated data ("<cityLowercased>|<ST>").
 */
const OVERRIDES: Record<string, CityGeo> = {
  "new york|NY": { lng: -73.9857, lat: 40.7484, countyFips: "36061" },
  "san francisco|CA": { lng: -122.4194, lat: 37.7749, countyFips: "06075" },
  "san jose|CA": { lng: -121.8863, lat: 37.3382, countyFips: "06085" },
  "chicago|IL": { lng: -87.6298, lat: 41.8781, countyFips: "17031" },
  "dallas|TX": { lng: -96.797, lat: 32.7767, countyFips: "48113" },
  "austin|TX": { lng: -97.7431, lat: 30.2672, countyFips: "48453" },
  "boston|MA": { lng: -71.0589, lat: 42.3601, countyFips: "25025" },
  "provo|UT": { lng: -111.6585, lat: 40.2338, countyFips: "49049" },
  "salt lake city|UT": { lng: -111.891, lat: 40.7608, countyFips: "49035" },
  "lehi|UT": { lng: -111.8508, lat: 40.3916, countyFips: "49049" },
};

/**
 * Resolve a city + 2-letter state to its county FIPS + marker coordinates, or
 * `undefined` if the city is unknown (callers must treat that exactly like the
 * old behavior for an unseeded city: no fill contribution, no pin — never crash).
 *
 * SERVER-ONLY: importing this pulls in the full crosswalk JSON. Do not call it
 * from client components.
 */
export function lookupCityGeo(
  city: string,
  state: string,
): CityGeo | undefined {
  const key = `${city.toLowerCase()}|${state.toUpperCase()}`;
  const override = OVERRIDES[key];
  if (override) return override;
  const row = CROSSWALK[key];
  if (!row) return undefined;
  return { countyFips: row[0], lat: row[1], lng: row[2] };
}
