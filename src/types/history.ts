/**
 * Per-record version history types (`GET /alumni/{id}/history`, #45), derived
 * from the backend OpenAPI schema via the generated types — see
 * `src/types/api.ts`.
 */
import type { Schema } from "./api";

export type AlumniHistoryPage = Schema<"AlumniHistoryPage">;
export type AlumniHistoryGroup = Schema<"AlumniHistoryGroup">;
export type AlumniHistoryChange = Schema<"AlumniHistoryChange">;
