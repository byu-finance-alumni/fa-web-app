/**
 * build-city-crosswalk.mjs
 *
 * Reproducible generator for the full US city -> {county FIPS, lat, lng}
 * crosswalk consumed (SERVER-SIDE ONLY) by `src/lib/geo/county-map.ts`.
 *
 * Source of truth: US Census 2023 Gazetteer "Places" national file, which lists
 * every incorporated place / CDP with its USPS state and interior-point
 * latitude/longitude (INTPTLAT / INTPTLONG):
 *
 *   https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2023_Gazetteer/2023_Gaz_place_national.zip
 *
 * The county FIPS is NOT in that file, so we derive it with a point-in-polygon
 * spatial join against the county polygons we ALREADY ship (`us-atlas`
 * counties-10m.json, decoded via topojson-client) using d3-geo's geoContains.
 * No second dataset is required.
 *
 * Output: `src/lib/geo/city-crosswalk.json`
 *   {
 *     "<cityLowercased>|<ST>": [countyFips, lat, lng],
 *     ...
 *   }
 * keyed/valued compactly to keep the file small (a few MB, server-side only).
 *
 * Usage:
 *   node scripts/build-city-crosswalk.mjs
 *
 * Optionally re-download the gazetteer (otherwise a cached copy under
 * .tmp-geo/ is reused if present):
 *   node scripts/build-city-crosswalk.mjs --download
 */

import { feature } from "topojson-client";
import { geoContains } from "d3-geo";
import countiesTopo from "us-atlas/counties-10m.json" with { type: "json" };
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const TMP = path.join(ROOT, ".tmp-geo");
const TXT = path.join(TMP, "2023_Gaz_place_national.txt");
const ZIP = path.join(TMP, "places.zip");
const GAZ_URL =
  "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2023_Gazetteer/2023_Gaz_place_national.zip";
const OUT = path.join(ROOT, "src", "lib", "geo", "city-crosswalk.json");

const wantDownload = process.argv.includes("--download");

// ---------------------------------------------------------------------------
// 1. Ensure the gazetteer text file is available locally.
// ---------------------------------------------------------------------------
function ensureGazetteer() {
  if (fs.existsSync(TXT) && !wantDownload) return;
  fs.mkdirSync(TMP, { recursive: true });
  console.error("Downloading Census 2023 Gazetteer places file...");
  execFileSync("curl", ["-sSL", "-o", ZIP, GAZ_URL], { stdio: "inherit" });
  console.error("Unzipping...");
  // `unzip` is available on the build machine; fall back to PowerShell Expand-Archive.
  try {
    execFileSync("unzip", ["-o", ZIP, "-d", TMP], { stdio: "inherit" });
  } catch {
    execFileSync(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        `Expand-Archive -Force -Path '${ZIP}' -DestinationPath '${TMP}'`,
      ],
      { stdio: "inherit" },
    );
  }
}

// ---------------------------------------------------------------------------
// 2. Strip the trailing LSAD descriptor from a Census place NAME so we get a
//    bare, human-style city name (e.g. "Provo city" -> "Provo",
//    "Nashville-Davidson metropolitan government (balance)" -> "Nashville").
// ---------------------------------------------------------------------------
const LSAD_TAIL =
  /\s+(?:CDP|city|town|village|borough|comunidad|zona urbana|municipality|metro township|township|metropolitan government|consolidated government|unified government|urban county|corporation|metropolitan)?\s*(?:\(balance\))?$/i;

function cleanName(raw) {
  // Single strip only: the regex optionally absorbs a trailing "(balance)" in the
  // same pass, so "Indianapolis city (balance)" -> "Indianapolis". A repeated
  // loop would wrongly eat real name words, e.g. "Salt Lake City city" -> "Salt
  // Lake" (the "City" token matches /city/i on the second pass).
  let name = raw.trim().replace(LSAD_TAIL, "").trim();
  // Consolidated city-counties often appear as "A-B County" / "A/B County";
  // keep the leading place token before the hyphen/slash so the common city name
  // still resolves (e.g. "Macon-Bibb County" -> "Macon").
  const m = name.match(/^([^/-]+?)[/-].*\bCounty\b.*$/i);
  if (m) name = m[1].trim();
  return name;
}

// ---------------------------------------------------------------------------
// 3. Build a bounding-box index of county polygons for fast candidate lookup,
//    then point-in-polygon test only the candidates that contain the point.
// ---------------------------------------------------------------------------
function buildCountyIndex() {
  const fc = feature(countiesTopo, "counties");
  const counties = [];
  for (const f of fc.features) {
    const fips = String(f.id);
    // Compute a simple [minLng, minLat, maxLng, maxLat] bbox by walking coords.
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    const visit = (coords) => {
      for (const c of coords) {
        if (typeof c[0] === "number") {
          if (c[0] < minX) minX = c[0];
          if (c[0] > maxX) maxX = c[0];
          if (c[1] < minY) minY = c[1];
          if (c[1] > maxY) maxY = c[1];
        } else {
          visit(c);
        }
      }
    };
    visit(f.geometry.coordinates);
    counties.push({ fips, feature: f, bbox: [minX, minY, maxX, maxY] });
  }
  return counties;
}

function findCountyFips(counties, lng, lat) {
  for (const c of counties) {
    const [minX, minY, maxX, maxY] = c.bbox;
    if (lng < minX || lng > maxX || lat < minY || lat > maxY) continue;
    if (geoContains(c.feature, [lng, lat])) return c.fips;
  }
  return null;
}

/**
 * Fallback for the handful of places whose Census interior point lands just
 * offshore / outside its own polygon (e.g. San Francisco's interior point sits
 * over water near the Farallons): pick the county whose bbox is nearest to the
 * point. Bounded distance keeps this from mis-binning genuine non-50-state
 * places (PR / territories) that have no county at all.
 */
function nearestCountyFips(counties, lng, lat, maxDeg = 0.75) {
  let best = null;
  let bestD = Infinity;
  for (const c of counties) {
    const [minX, minY, maxX, maxY] = c.bbox;
    const dx = lng < minX ? minX - lng : lng > maxX ? lng - maxX : 0;
    const dy = lat < minY ? minY - lat : lat > maxY ? lat - maxY : 0;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = c.fips;
    }
  }
  return bestD <= maxDeg * maxDeg ? best : null;
}

// ---------------------------------------------------------------------------
// 4. Main.
// ---------------------------------------------------------------------------
function main() {
  ensureGazetteer();

  console.error("Indexing county polygons...");
  const counties = buildCountyIndex();

  console.error("Reading gazetteer + spatial joining places to counties...");
  const lines = fs.readFileSync(TXT, "utf8").split(/\r?\n/);
  // First line is the header.
  const header = lines[0].split("\t").map((h) => h.trim());
  const iState = header.indexOf("USPS");
  const iName = header.indexOf("NAME");
  const iLat = header.indexOf("INTPTLAT");
  const iLng = header.indexOf("INTPTLONG");
  if (iState < 0 || iName < 0 || iLat < 0 || iLng < 0) {
    throw new Error("Unexpected gazetteer header: " + header.join("|"));
  }

  /** @type {Record<string, [string, number, number]>} */
  const out = {};
  let total = 0;
  let matched = 0;
  let unmatched = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const cols = line.split("\t");
    if (cols.length <= iLng) continue;
    const st = cols[iState].trim();
    const rawName = cols[iName].trim();
    const lat = Number(cols[iLat]);
    const lng = Number(cols[iLng]);
    if (!st || !rawName || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      continue;
    }
    total++;

    const fips =
      findCountyFips(counties, lng, lat) ??
      nearestCountyFips(counties, lng, lat);
    if (!fips) {
      unmatched++;
      continue;
    }
    matched++;

    const city = cleanName(rawName);
    const key = `${city.toLowerCase()}|${st}`;
    // Keep round but precise-enough coords (5 dp ~= 1.1 m) to shrink the file.
    const value = [fips, round5(lat), round5(lng)];
    // First write wins for a given key. Census lists incorporated places
    // before/with CDPs; collisions on the same cleaned name+state are rare and
    // resolve to the same county in practice. Don't overwrite an existing key.
    if (!(key in out)) out[key] = value;
  }

  // Stable key order keeps diffs small across regenerations.
  const sorted = {};
  for (const k of Object.keys(out).sort()) sorted[k] = out[k];

  fs.writeFileSync(OUT, JSON.stringify(sorted));
  const bytes = fs.statSync(OUT).size;
  console.error(
    `Done. places=${total} matched=${matched} unmatched=${unmatched} ` +
      `keys=${Object.keys(sorted).length} file=${(bytes / 1024 / 1024).toFixed(2)}MB -> ${path.relative(ROOT, OUT)}`,
  );
}

function round5(n) {
  return Math.round(n * 1e5) / 1e5;
}

main();
