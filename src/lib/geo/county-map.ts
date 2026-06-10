/**
 * SERVER-ONLY helper that turns a state abbreviation + its city alumni counts
 * into plain SVG geometry (county paths + city markers). All d3-geo / topojson
 * work happens here so the browser only receives precomputed strings/numbers —
 * d3-geo, topojson-client and us-atlas are NOT shipped to the client.
 */

import { geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { Topology } from "topojson-specification";
import countiesTopo from "us-atlas/counties-10m.json";
import { STATE_FIPS, lookupCityGeo } from "./counties-data";

/** Fixed SVG canvas the projection is fitted into (matches CountyMap's viewBox). */
const WIDTH = 800;
const HEIGHT = 520;
const PAD = 10;

export interface CountyPath {
  fips: string;
  d: string;
  name: string;
  count: number;
}

export interface CityMarker {
  x: number;
  y: number;
  label: string;
  count: number;
}

export interface CountyMapData {
  paths: CountyPath[];
  markers: CityMarker[];
  width: number;
  height: number;
}

interface CountyProps {
  name?: string;
}

export function buildCountyMap(
  stateAbbr: string,
  cities: { city: string; count: number }[],
): CountyMapData | null {
  const stateFips = STATE_FIPS[stateAbbr.toUpperCase()];
  if (!stateFips) return null;

  const topo = countiesTopo as unknown as Topology;

  // Decode every county to GeoJSON, then keep only this state's counties
  // (their 5-digit id starts with the state's 2-digit FIPS).
  const all = feature(topo, "counties") as unknown as FeatureCollection<
    Geometry,
    CountyProps
  >;
  const stateFeatures = all.features.filter(
    (f) => typeof f.id === "string" && f.id.startsWith(stateFips),
  );
  if (stateFeatures.length === 0) return null;

  // Sum alumni per county via the city → county crosswalk. Cities that don't
  // resolve contribute no fill (they still appear in the right rail). The
  // crosswalk now covers every US Census place, so essentially any real alumni
  // city resolves to a county; unresolved cities fall back to the lightest (0)
  // bucket exactly as before.
  const st = stateAbbr.toUpperCase();
  const countyCount: Record<string, number> = {};
  for (const { city, count } of cities) {
    const geo = lookupCityGeo(city, st);
    if (!geo) continue;
    countyCount[geo.countyFips] = (countyCount[geo.countyFips] ?? 0) + count;
  }

  const fc: FeatureCollection<Geometry, CountyProps> = {
    type: "FeatureCollection",
    features: stateFeatures as Feature<Geometry, CountyProps>[],
  };

  // Fit a Mercator projection to JUST this state's counties (padded), then use
  // geoPath to emit an SVG "d" for each county. geoMercator (not geoAlbersUsa)
  // so a single state isn't distorted by AK/HI insets.
  const projection = geoMercator().fitExtent(
    [
      [PAD, PAD],
      [WIDTH - PAD, HEIGHT - PAD],
    ],
    fc,
  );
  const path = geoPath(projection);

  const paths: CountyPath[] = [];
  for (const f of fc.features) {
    const fips = String(f.id);
    const d = path(f);
    if (!d) continue;
    paths.push({
      fips,
      d,
      name: f.properties?.name ?? fips,
      count: countyCount[fips] ?? 0,
    });
  }

  // Project each resolved city's coordinate using the SAME projection so pins
  // land on top of the right county. Cities that don't resolve are skipped.
  const markers: CityMarker[] = [];
  for (const { city, count } of cities) {
    const geo = lookupCityGeo(city, st);
    if (!geo) continue;
    const pt = projection([geo.lng, geo.lat]);
    if (!pt) continue;
    markers.push({ x: pt[0], y: pt[1], label: city, count });
  }

  return { paths, markers, width: WIDTH, height: HEIGHT };
}
