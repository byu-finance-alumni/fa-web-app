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
