/**
 * Types for conference-attendee matching (#612).
 *
 * The backend routes DO carry response_models
 * (fa-web-api/app/schemas/attendee_match.py), so these will eventually be
 * available as `Schema<"AttendeeMatchPreview">` etc. from the generated
 * `api.gen.ts`. They are hand-written here only because api.gen.ts is generated
 * from the DEPLOYED dev backend and the backend PR has not merged yet — swap
 * these aliases for the generated schemas after the next `npm run gen:api-types`
 * (see the PR description).
 *
 * Keep in sync with fa-web-api/app/schemas/attendee_match.py until then.
 */

/** One alumnus proposed for one attendee row. NEVER applied automatically. */
export interface AttendeeMatchCandidate {
  alumni_id: number;
  name: string;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  preferred_first_name: string | null;
  /** Maiden / birth name (#216) — why a married surname can still match. */
  birth_name: string | null;
  net_id: string | null;
  graduation_year: number | null;
  is_alumni: boolean;
  employer: string | null;
  title: string | null;
  city: string | null;
  state: string | null;
  personal_email: string | null;
  work_email: string | null;
  /** "email" | "name" | "name_company" — which leg proposed this record. */
  tier: string;
  score: number;
  /** "high" | "medium" | "low". Ranks candidates; never authorises a write. */
  confidence: string;
  /** Human-readable reasons, INCLUDING reasons against (a differing employer). */
  evidence: string[];
  already_attending: boolean;
}

/** The attendee as the uploaded file describes them. */
export interface AttendeeMatchAttendee {
  name: string;
  first_name: string | null;
  last_name: string | null;
  maiden_name: string | null;
  email: string | null;
  company: string | null;
  title: string | null;
  graduation_year: number | null;
}

/**
 * One row of the uploaded list.
 *
 * - `matched`   — exactly one plausible record (still only a proposal)
 * - `ambiguous` — several; ALL are in `candidates` and the reviewer chooses
 * - `no_match`  — nothing plausible; eligible for a friend record
 * - `not_reviewed` — the preview hit its aggregate disclosure budget before
 *   reaching this row. NOT the same as `no_match`: re-upload the remaining rows
 *   as a smaller file rather than creating friend records for them.
 */
export type AttendeeMatchStatus =
  | "matched"
  | "ambiguous"
  | "no_match"
  | "not_reviewed";

export interface AttendeeMatchRow {
  row: number;
  status: AttendeeMatchStatus | string;
  attendee: AttendeeMatchAttendee;
  /** "email" when the file gave one for this row, else "name". */
  match_key: string;
  candidates: AttendeeMatchCandidate[];
  warnings: string[];
  /** The DB fields a friend built from this row would carry. */
  friend_fields: string[];
}

export interface AttendeeMatchSummary {
  total_rows: number;
  matched: number;
  ambiguous: number;
  no_match: number;
  not_reviewed: number;
  already_attending: number;
}

export interface AttendeeMatchPreview {
  columns_ok: boolean;
  header_errors: string[];
  /** Columns the file has that map to no DB field. Dropped, never an error. */
  ignored_columns: string[];
  event: { event_id: number; event_name: string; event_date: string | null } | null;
  summary: AttendeeMatchSummary;
  rows: AttendeeMatchRow[];
  warnings: { code: string; message: string }[];
}

/** One approved match sent to the backend. */
export interface AttendeeApproval {
  alumni_id: number;
  row?: number;
  attendance_status?: string | null;
  notes?: string | null;
}

export interface AttendeeApplyItem {
  alumni_id: number;
  row: number | null;
  /** "added" | "already_attending" | "not_found". */
  status: string;
  name: string | null;
  message: string | null;
}

export interface AttendeeApplyResult {
  event_id: number;
  added: number;
  already_attending: number;
  not_found: number;
  items: AttendeeApplyItem[];
}

export interface AttendeeFriendItem {
  row: number;
  name: string;
  /** "created" | "skipped" (already on the roster) | "rejected". */
  status: string;
  alumni_id: number | null;
  message: string | null;
}

export interface AttendeeFriendResult {
  event_id: number;
  created: number;
  attached: number;
  rejected: number;
  /** Rows whose person is already on this roster — the idempotency guard. */
  skipped: number;
  items: AttendeeFriendItem[];
  header_errors: string[];
}
