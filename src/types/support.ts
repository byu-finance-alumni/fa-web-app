/**
 * Engineer-managed support-contact type, derived from the backend OpenAPI
 * schema — see `src/types/api.ts`. Shown to logged-in users on the in-app error
 * screen; managed by the engineer at `/admin/support-contacts`.
 */
import type { Schema } from "./api";

export type SupportContact = Schema<"SupportContactRead">;
