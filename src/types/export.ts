/**
 * Alumni CSV export types (`/alumni/export`), derived from the backend OpenAPI
 * schema via the generated types — see `src/types/api.ts`. A backend shape
 * change flows in on the next `npm run gen:api-types`.
 */
import type { Schema } from "./api";

export type ExportColumn = Schema<"ExportColumn">;
export type ExportColumnCatalog = Schema<"ExportColumnCatalog">;
export type AlumniExportFilters = Schema<"AlumniExportFilters">;
export type AlumniExportRequest = Schema<"AlumniExportRequest">;
