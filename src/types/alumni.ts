/**
 * Core alumni types, derived from the backend OpenAPI schema — see
 * `src/types/api.ts`. The data-hygiene and CSV-import types further down are
 * still hand-written because those endpoints return untyped dicts in the
 * backend (no `response_model`), so the generated schema has nothing to derive
 * them from.
 */
import type { Schema } from "./api";

/**
 * An alumni list row (`GET /alumni`). Superset of the single-record read shape
 * (`AlumniRead`) plus the joined `current_employer` / `current_industry`.
 */
export type Alumni = Schema<"AlumniListItem">;

export type AlumniPage = Schema<"AlumniPage">;

/**
 * The signed-in user's DB identity + roles (`GET /auth/context`).
 * `must_change_password` is true when they signed in with a temporary password
 * and must set a new one before using the app (the shell gates on it and
 * forces `/set-password`, cleared via `POST /auth/password/complete`).
 */
export type UserContext = Schema<"UserContext">;

/* ----------------------------------------------------------- data hygiene ----- */

/** Which nested section of the alumni payload a hygiene item belongs to. */
export type HygieneSection =
  | "core"
  | "contact"
  | "career"
  | "education"
  | "engagement";

/** One auto-clean diff: how a single field's value changed (before → after). */
export interface HygieneChange {
  section: HygieneSection;
  field: string;
  /** Human-readable field label for display (e.g. "First name"). */
  label: string;
  before: unknown;
  after: unknown;
}

/**
 * A non-fatal advisory — a fuzzy/possible duplicate or a missing recommended
 * field. Warnings never block saving. When `alumni_id` is present, the warning
 * points at an existing record (e.g. a likely duplicate) the admin can review.
 */
export interface HygieneWarning {
  code: string;
  message: string;
  alumni_id: number | null;
}

/**
 * A fatal issue — an exact duplicate byu_id/net_id that must be resolved before
 * saving. Blocks the Save button. `field` names the offending input when known;
 * `alumni_id` links to the conflicting existing record.
 */
export interface HygieneBlocker {
  code: string;
  field: string | null;
  message: string;
  alumni_id: number | null;
}

/**
 * Server-side data-hygiene preview returned by `POST /alumni/preview` and
 * `POST /alumni/{id}/preview`. The backend cleans + checks the proposed payload
 * and reports what it would change and any duplicate/missing-field findings.
 * The same cleaning runs authoritatively on the real save, so the stored record
 * matches `cleaned`.
 */
export interface HygienePreview {
  /** The proposed payload after the backend's auto-clean (same shape as create). */
  cleaned: Record<string, unknown>;
  changes: HygieneChange[];
  warnings: HygieneWarning[];
  blockers: HygieneBlocker[];
}

/* -------------------------------------------------------- CSV bulk import ----- */

/** Headline counts for a preview report (POST /alumni/import/preview). */
export interface ImportSummary {
  total: number;
  importable: number;
  rejected: number;
  with_warnings: number;
  cleaned: number;
}

/** One auto-clean diff on an import row (before → after for a single field). */
export interface ImportChange {
  section: string;
  field: string;
  label: string;
  before: unknown;
  after: unknown;
}

/** A non-fatal advisory on an import row (e.g. a possible duplicate). */
export interface ImportWarning {
  code: string;
  message: string;
  alumni_id: number | null;
}

/** A fatal issue on an import row — blocks that row from being imported. */
export interface ImportBlocker {
  code: string;
  field: string | null;
  message: string;
  alumni_id: number | null;
}

/** One row of the import preview: its status plus changes/warnings/blockers. */
export interface ImportRow {
  row: number;
  name: string;
  status: "importable" | "rejected";
  changes: ImportChange[];
  warnings: ImportWarning[];
  blockers: ImportBlocker[];
  error: string | null;
}

/**
 * Dry-run report for an uploaded CSV (POST /alumni/import/preview, multipart
 * `file`). `columns_ok` gates the whole import: when false, `header_errors`
 * explains why and no rows may be imported.
 */
export interface ImportPreview {
  columns_ok: boolean;
  header_errors: string[];
  summary: ImportSummary;
  rows: ImportRow[];
}

/** A row the backend skipped during the real import, with the reason. */
export interface ImportReject {
  row: number;
  name: string;
  reason: string;
}

/** Outcome of the committed import (POST /alumni/import, multipart `file`). */
export interface ImportResult {
  imported: number;
  skipped: number;
  created_ids: number[];
  rejects: ImportReject[];
}

/* ------------------------------------------------ CSV bulk UPDATE (round-trip) --- */
//
// Unlike the create-import types above (hand-written because those routes return
// untyped dicts), the update endpoints DO carry `response_model`s, so these
// aliases resolve straight to the generated backend shapes — a rename/removal on
// the backend fails `tsc` here (the contract guard, issue #99).

/**
 * One field a matched row would change (`old → new`). `old`/`new` are `unknown`
 * because a cell can hold a string, int, bool, or date.
 * (`AlumniUpdateFieldChange`)
 */
export type UpdateImportFieldChange = Schema<"AlumniUpdateFieldChange">;

/**
 * Per-row detail in the update preview. `status` is one of `update`,
 * `no_changes`, `unmatched`, `unmatched_archived`, or `error`; `message`
 * explains an unmatched row and `error` carries a mapping/validation message.
 * (`AlumniUpdateRowReport`)
 */
export type UpdateImportRowReport = Schema<"AlumniUpdateRowReport">;

/** Headline counts for the update preview (`AlumniUpdateSummary`). */
export type UpdateImportSummary = Schema<"AlumniUpdateSummary">;

/**
 * Dry-run report for an uploaded update CSV
 * (`POST /alumni/import/update/preview`). (`AlumniUpdatePreview`)
 */
export type UpdateImportPreview = Schema<"AlumniUpdatePreview">;

/**
 * Per-row outcome in the committed update. `status` is `updated`, `unchanged`,
 * `unmatched`, `unmatched_archived`, or `error`. (`AlumniUpdateRowResult`)
 */
export type UpdateImportRowResult = Schema<"AlumniUpdateRowResult">;

/**
 * Outcome of the committed update (`POST /alumni/import/update`).
 * (`AlumniUpdateResult`)
 */
export type UpdateImportResult = Schema<"AlumniUpdateResult">;
