/**
 * Types for the event attendee SPREADSHEET import (api#693).
 *
 * Read from the generated OpenAPI contract (`api.gen.ts`) so the CI drift
 * guard covers them. Keep in sync with fa-web-api/app/schemas/attendee_sheet.py.
 *
 * Routes:
 *   GET  /events/attendees/sheet/template          → CSV text
 *   POST /events/{id}/attendees/sheet/preview      multipart `file` → SheetPreview (no writes)
 *   POST /events/{id}/attendees/sheet/commit       JSON SheetCommitRequest → SheetCommitResult
 */

import type { Schema } from "@/types/api";

export type SheetPreview = Schema<"SheetPreview">;
export type SheetPreviewRow = Schema<"SheetPreviewRow">;
export type SheetCandidate = Schema<"SheetCandidate">;
export type SheetStatus = SheetPreviewRow["status"];
export type SheetAction = SheetPreviewRow["action"];
export type SheetCommitRow = Schema<"SheetCommitRow">;
export type SheetCommitRequest = Schema<"SheetCommitRequest">;
export type SheetCommitResult = Schema<"SheetCommitResult">;
export type SheetCommitItem = Schema<"SheetCommitItem">;
