/**
 * Cross-alumni admin task list types.
 *
 * Derived from the backend `AdminTaskItem` / `AdminTaskPage` schemas via the
 * generated OpenAPI types — see `src/types/api.ts`. Do not hand-edit the shape;
 * a backend change flows in on the next `npm run gen:api-types`.
 */
import type { Schema } from "./api";

export type AdminTask = Schema<"AdminTaskItem">;
export type AdminTaskPage = Schema<"AdminTaskPage">;
