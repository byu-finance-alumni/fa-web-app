// Regenerates src/types/api.gen.ts from the FastAPI backend's OpenAPI schema.
//
// The backend (fa-web-api) is the source of truth for every request/response
// shape. We pull its `/openapi.json` and emit TypeScript types so the frontend
// can be type-checked against the *real* contract — a backend field rename or
// removal then surfaces as a `tsc` failure on the stale frontend usage instead
// of a runtime crash in the browser.
//
// Source URL resolution (first match wins):
//   1. API_SCHEMA_URL env var (full URL to openapi.json) — used by CI
//   2. NEXT_PUBLIC_API_URL env var + "/openapi.json"
//   3. the dev deployment (default)
//
// Usage:
//   npm run gen:api-types
//   API_SCHEMA_URL=http://localhost:8000/openapi.json npm run gen:api-types
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import openapiTS, { astToString } from "openapi-typescript";

const DEV_API = "https://dev-fa-web-api.vercel.app";

const schemaUrl =
  process.env.API_SCHEMA_URL ||
  `${process.env.NEXT_PUBLIC_API_URL || DEV_API}/openapi.json`;

const outPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../src/types/api.gen.ts",
);

const BANNER = `/**
 * AUTO-GENERATED — DO NOT EDIT BY HAND.
 *
 * Regenerate with:  npm run gen:api-types
 * Source schema:    ${schemaUrl.replace(/^https?:\/\/[^/]+/, "<API>")}
 *
 * Types are derived from the fa-web-api FastAPI OpenAPI schema. CI regenerates
 * this file from the served schema and fails on drift, so it always reflects
 * the deployed backend contract. See scripts/gen-api-types.mjs.
 *
 * (eslint ignores this path; see eslint.config.mjs.)
 */

`;

/**
 * A request-body model — one the client *sends*. Optionality is meaningful here
 * (partial updates omit fields), so we leave these untouched. Everything else
 * is a response model the client *reads*.
 */
function isRequestModel(name) {
  return /(?:Create|Update|Request|Assign)$/.test(name) || name.startsWith("Body_");
}

/**
 * Pydantic emits response fields that default to `None` as *optional* in
 * OpenAPI (absent from `required`), which openapi-typescript turns into
 * `field?: T | null` — i.e. the read type gains a spurious `undefined`. But
 * FastAPI always serializes declared response fields (just possibly null), and
 * the frontend has always modeled them as required-nullable (`field: T | null`).
 *
 * So for response models only, mark every declared property required. This
 * keeps `| null` (nullability is encoded in the property schema, not `required`)
 * while dropping the bogus `undefined`. The contract guard is unaffected: a
 * renamed/removed backend field still disappears from `properties` and breaks
 * `tsc` at the call site — which is the whole point (issue #99).
 */
function normalizeResponseRequired(schema) {
  const schemas = schema?.components?.schemas;
  if (!schemas) return;
  for (const [name, model] of Object.entries(schemas)) {
    if (isRequestModel(name)) continue;
    if (model && typeof model === "object" && model.properties) {
      model.required = Object.keys(model.properties);
    }
  }
}

console.log(`Generating API types from ${schemaUrl} ...`);
const res = await fetch(new URL(schemaUrl));
if (!res.ok) {
  throw new Error(`Failed to fetch ${schemaUrl}: HTTP ${res.status}`);
}
const schema = await res.json();
normalizeResponseRequired(schema);
const ast = await openapiTS(schema);
writeFileSync(outPath, BANNER + astToString(ast));
console.log(`Wrote ${outPath}`);
