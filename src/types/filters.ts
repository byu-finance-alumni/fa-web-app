/**
 * Option lists for the alumni advanced-filter panel, derived from the backend
 * OpenAPI schema (`GET /alumni/filter-options`). See `src/types/api.ts`.
 */
import type { Schema } from "./api";

export type FilterOptions = Schema<"FilterOptions">;
