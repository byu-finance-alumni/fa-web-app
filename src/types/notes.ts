/**
 * Unified-notes types (`/notes`), derived from the backend OpenAPI schema via
 * the generated types — see `src/types/api.ts`. A backend shape change flows in
 * on the next `npm run gen:api-types`.
 */
import type { Schema } from "./api";

export type Note = Schema<"NoteRead">;
export type NoteEntityType = Schema<"NoteEntityType">;
