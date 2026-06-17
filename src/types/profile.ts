/**
 * Alumni profile aggregate types (`GET /alumni/{id}/profile`).
 *
 * Derived from the backend `ProfileRead` aggregate and its nested models via
 * the generated OpenAPI types — see `src/types/api.ts`. A backend shape change
 * flows in on the next `npm run gen:api-types` and surfaces as a `tsc` error on
 * any stale usage here or at call sites.
 */
import type { Schema } from "./api";

export type Contact = Schema<"ContactRead">;
export type CurrentCareer = Schema<"CurrentCareerRead">;
export type EmploymentHistory = Schema<"EmploymentHistoryRead">;
export type Education = Schema<"EducationRead">;
export type Leadership = Schema<"LeadershipRead">;
export type ProgramEngagement = Schema<"ProgramEngagementRead">;
export type EngagementNote = Schema<"EngagementNoteRead">;
export type Survey = Schema<"SurveyRead">;
export type Interaction = Schema<"InteractionRead">;
export type Task = Schema<"TaskRead">;
export type Attachment = Schema<"AttachmentRead">;
export type EventAttended = Schema<"EventAttendedRead">;
export type AuditEntry = Schema<"AuditEntryRead">;
export type Profile = Schema<"ProfileRead">;
