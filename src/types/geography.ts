/**
 * Geography dashboard types (`/geography/*`).
 *
 * Derived from the backend OpenAPI schema via the generated types — see
 * `src/types/api.ts`. These routes now have real `response_model`s in
 * fa-web-api (#88), so a backend shape change flows in on the next
 * `npm run gen:api-types` and surfaces as a `tsc` error on stale usage.
 */
import type { Schema } from "./api";

export type StateCount = Schema<"StateCount">;
export type CountyCount = Schema<"CountyCount">;
export type GeoSummary = Schema<"GeoSummary">;
export type StateDetail = Schema<"StateDetail">;
export type GeoAlumniRow = Schema<"GeoAlumniRow">;
export type GeoAlumniPage = Schema<"GeoAlumniPage">;
export type Breakdown = Schema<"Breakdown">;
export type CityDetail = Schema<"CityDetail">;
