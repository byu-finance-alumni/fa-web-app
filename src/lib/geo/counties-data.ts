/**
 * Static geo crosswalks for the county-level state map.
 *
 * `STATE_FIPS` maps a 2-letter USPS abbreviation to its 2-digit state FIPS code
 * (matching the first two digits of every county id in `us-atlas`).
 *
 * `CITY_GEO` maps "<City>|<ST>" → coordinates + the 5-digit county FIPS the city
 * sits in. It is used to (a) plot a labeled marker for the city and (b) attribute
 * the city's alumni count to its county for the choropleth fill.
 *
 * NOTE: `CITY_GEO` currently covers ONLY the cities present in the mock data, so
 * for now only those counties get colored + pinned. This hand-seeded crosswalk
 * should later be replaced by a full city → county + coordinates dataset (e.g. the
 * US Census Gazetteer place file or SimpleMaps US Cities) so every alumni city
 * resolves automatically.
 */

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
 * "<City>|<ST>" → coordinates + county FIPS.
 *
 * Seeded with the cities present in the mock data so the demo renders real
 * markers and colored counties. Replace with a full city dataset later.
 */
export const CITY_GEO: Record<string, CityGeo> = {
  "New York|NY": { lng: -73.9857, lat: 40.7484, countyFips: "36061" }, // New York County
  "San Francisco|CA": { lng: -122.4194, lat: 37.7749, countyFips: "06075" }, // San Francisco County
  "San Jose|CA": { lng: -121.8863, lat: 37.3382, countyFips: "06085" }, // Santa Clara County
  "Chicago|IL": { lng: -87.6298, lat: 41.8781, countyFips: "17031" }, // Cook County
  "Dallas|TX": { lng: -96.797, lat: 32.7767, countyFips: "48113" }, // Dallas County
  "Austin|TX": { lng: -97.7431, lat: 30.2672, countyFips: "48453" }, // Travis County
  "Boston|MA": { lng: -71.0589, lat: 42.3601, countyFips: "25025" }, // Suffolk County
  "Provo|UT": { lng: -111.6585, lat: 40.2338, countyFips: "49049" }, // Utah County
  "Salt Lake City|UT": { lng: -111.891, lat: 40.7608, countyFips: "49035" }, // Salt Lake County
  "Lehi|UT": { lng: -111.8508, lat: 40.3916, countyFips: "49049" }, // Utah County
};
