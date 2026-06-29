/**
 * Engineer / super-admin-managed dashboard quick-filter preset type, derived
 * from the backend OpenAPI schema — see `src/types/api.ts`. Shown on the
 * dashboard Quick search tab; managed at `/admin/quick-filters`.
 */
import type { Schema } from "./api";

export type DashboardPreset = Schema<"DashboardPresetRead">;
