/**
 * Types for conference-attendee matching (#612, #537, #538).
 *
 * Read from the generated OpenAPI contract (`api.gen.ts`, regenerated against
 * the deployed dev backend) so the CI drift guard covers them. Only two shapes
 * are hand-tightened here:
 *
 * - `AttendeeMatchPreview.warnings` — the contract types it as a bag of
 *   unknowns; the backend actually sends `{ code, message }`.
 * - `AttendeeApproval` — a REQUEST body. The generated shape lists every
 *   nullable field as required; the backend defaults them, and the wizard only
 *   ever sends what it means (`net_id` for an auto-confirmed Net ID row, and
 *   nothing else that could read as an approval).
 *
 * Keep in sync with fa-web-api/app/schemas/attendee_match.py.
 */

import type { Schema } from "@/types/api";

/**
 * One alumnus proposed for one attendee row.
 *
 * `tier` is `netid` (#537 — an exact identifier; `confidence` is then
 * `certain`), `email`, `name` or `name_company`. `corroborated` is only
 * meaningful on a `netid` candidate: whether the file's email or name ALSO
 * agrees with the record.
 */
export type AttendeeMatchCandidate = Schema<"AttendeeMatchCandidate">;

/** The attendee as the uploaded file describes them. */
export type AttendeeMatchAttendee = Schema<"AttendeeMatchAttendee">;

/**
 * One row of the uploaded list.
 *
 * - `matched`   — exactly one plausible record. A proposal UNLESS
 *   `auto_confirmed` is true: then it is an exact Net ID hit (#537) that is
 *   applied through the same `/approve` call without a human click, sending
 *   the row's `net_id` so the server re-verifies it.
 * - `ambiguous` — several plausible records, OR a Net ID that matches one
 *   record while the email / name matches a different one. ALL are in
 *   `candidates` and the reviewer chooses.
 * - `no_match`  — nothing plausible on any tier; eligible for a friend record.
 * - `not_reviewed` — the preview hit its aggregate disclosure budget before
 *   reaching this row. NOT the same as `no_match`.
 *
 * `friend_eligible` is true only when the row failed EVERY tier — never merely
 * because it lacks a Net ID.
 */
export type AttendeeMatchStatus =
  | "matched"
  | "ambiguous"
  | "no_match"
  | "not_reviewed";

export type AttendeeMatchRow = Schema<"AttendeeMatchRow">;

export type AttendeeMatchSummary = Schema<"AttendeeMatchSummary">;

export interface AttendeeMatchPreview
  extends Omit<Schema<"AttendeeMatchPreview">, "warnings"> {
  warnings: { code: string; message: string }[];
}

/**
 * One approved match sent to the backend.
 *
 * `net_id` is set ONLY for a row the preview reported `auto_confirmed` (#537):
 * the server re-verifies that the record's Net ID equals it before writing and
 * labels the audit entry as a Net ID match rather than a human approval. It is
 * never a way to approve a row the preview only proposed.
 */
export interface AttendeeApproval {
  alumni_id: number;
  row?: number;
  net_id?: string | null;
  attendance_status?: string | null;
  notes?: string | null;
}

/** Per-approval outcome: `added`, `already_attending`, `not_found` or
 *  `net_id_mismatch` (nothing written — re-run the check). */
export type AttendeeApplyItem = Schema<"AttendeeApplyItem">;

export type AttendeeApplyResult = Schema<"AttendeeApplyResult">;

/** Per-row outcome of creating a friend: `created`, `reused` (an existing
 *  friend was linked instead of a twin being created, #538), `skipped`,
 *  `existing_alumnus` (the email belongs to a real alumnus — match them
 *  instead) or `rejected`. */
export type AttendeeFriendItem = Schema<"AttendeeFriendItem">;

export type AttendeeFriendResult = Schema<"AttendeeFriendResult">;
