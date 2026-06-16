/** Mirrors the backend AlumniRead / AlumniPage schemas (fa-web-api). */
export interface Alumni {
  alumni_id: number;
  byu_id: string | null;
  net_id: string | null;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  preferred_first_name: string | null;
  gender: string | null;
  /** Full date of birth, ISO "YYYY-MM-DD". `birth_year` is kept separately. */
  birth_date: string | null;
  graduation_year: number | null;
  finance_program_year: number | null;
  graduate_degree: string | null;
  spouse_first_name: string | null;
  spouse_last_name: string | null;
  /** Spouse's date of birth, ISO "YYYY-MM-DD". */
  spouse_birth_date: string | null;
  /** Set when the spouse is also an alumnus — links to that record. */
  spouse_alumni_id: number | null;
  deceased: boolean;
  archived: boolean;
  linkedin_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  /** Present on alumni-list rows (joined from current_employment); absent on
   * single-record reads. */
  current_employer?: string | null;
  current_industry?: string | null;
}

export interface AlumniPage {
  items: Alumni[];
  total: number;
  limit: number;
  offset: number;
}

/** Mirrors the backend UserContext (auth/context). */
export interface UserContext {
  user_id: number;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  roles: string[];
  /**
   * True when the user signed in with a temporary password and must set a new
   * one before using the app. The authenticated app shell gates on this and
   * forces the user to `/set-password`; it's cleared via
   * `POST /auth/password/complete` once they've set a new password.
   */
  must_change_password?: boolean;
}

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
