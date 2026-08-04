"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import {
  apiPost,
  apiPatch,
  apiDelete,
  apiPostForm,
  apiGetText,
  ApiError,
} from "@/lib/api";
import type {
  EventImportPreview,
  EventImportResult,
} from "@/types/events-import";
import type {
  AttendeeApplyResult,
  AttendeeApproval,
  AttendeeFriendResult,
  AttendeeMatchPreview,
} from "@/types/attendee-match";

/**
 * Result of an event form server action.
 *
 * - `error` is the summary / generic message shown at the form level.
 * - `fieldErrors` maps an input `name` to its validation message, populated
 *   from a backend 422 (`error.fields`). The form renders these inline.
 */
export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
} | null;

/** Translate an ApiError into a FormState, splitting out 422 field details. */
function toFormState(e: unknown, fallback: string): FormState {
  if (e instanceof ApiError) {
    if (e.status === 422 && e.fields?.length) {
      const fieldErrors: Record<string, string> = {};
      for (const f of e.fields) {
        if (!(f.field in fieldErrors)) fieldErrors[f.field] = f.message;
      }
      return {
        error: e.message || "Please fix the highlighted fields.",
        fieldErrors,
      };
    }
    return { error: e.message };
  }
  return { error: fallback };
}

function buildPayload(formData: FormData): Record<string, unknown> {
  const str = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
  };
  const payload: Record<string, unknown> = {
    event_name: str("event_name"),
    event_type: str("event_type"),
    event_date: str("event_date"),
    event_location: str("event_location"),
    event_notes: str("event_notes"),
  };
  for (const k of Object.keys(payload)) {
    if (payload[k] === undefined) delete payload[k];
  }
  return payload;
}

/**
 * Required-field check shared by create/update. The backend now 422s on a
 * missing event_date (M4) and has always required event_name — re-check here so
 * the form shows inline messages without a round trip.
 */
function validateRequired(formData: FormData): FormState {
  const fieldErrors: Record<string, string> = {};
  const name = formData.get("event_name");
  if (typeof name !== "string" || name.trim() === "") {
    fieldErrors.event_name = "Event name is required.";
  }
  const date = formData.get("event_date");
  if (typeof date !== "string" || date.trim() === "") {
    fieldErrors.event_date = "Event date is required.";
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { error: "Please fix the highlighted fields.", fieldErrors };
  }
  return null;
}

export async function createEvent(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const invalid = validateRequired(formData);
  if (invalid) return invalid;
  let created: { event_id: number };
  try {
    created = await apiPost<{ event_id: number }>(
      "/events",
      buildPayload(formData),
    );
  } catch (e) {
    return toFormState(e, "Failed to create event.");
  }
  revalidatePath("/events");
  revalidateTag("events"); // event-type options list
  // Land on the edit page so the user can immediately add attendees (an event
  // must exist before attendance can attach). `created=1` flags the hint text.
  redirect(`/events/${created.event_id}/edit?created=1`);
}

export async function updateEvent(
  id: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const invalid = validateRequired(formData);
  if (invalid) return invalid;
  try {
    await apiPatch(`/events/${id}`, buildPayload(formData));
  } catch (e) {
    return toFormState(e, "Failed to save event.");
  }
  revalidatePath("/events");
  revalidateTag("events"); // event-type options list
  redirect("/events");
}

/**
 * Result of an attendee mutation. `ok` lets the client component update its
 * local list / fire a toast; `error` is a human-readable message on failure.
 */
export type AttendeeActionResult = { ok: true } | { ok: false; error: string };

/** Add an alumni to an event's attendance (full_access). */
export async function addAttendee(
  eventId: number,
  alumniId: number,
): Promise<AttendeeActionResult> {
  try {
    await apiPost(`/events/${eventId}/attendees`, { alumni_id: alumniId });
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.status === 409) {
        return { ok: false, error: "That alumni is already an attendee." };
      }
      return { ok: false, error: e.message };
    }
    return { ok: false, error: "Failed to add attendee." };
  }
  revalidatePath("/events");
  return { ok: true };
}

/** Remove an alumni from an event's attendance (full_access). */
export async function removeAttendee(
  eventId: number,
  alumniId: number,
): Promise<AttendeeActionResult> {
  try {
    await apiDelete(`/events/${eventId}/attendees/${alumniId}`);
  } catch (e) {
    if (e instanceof ApiError) return { ok: false, error: e.message };
    return { ok: false, error: "Failed to remove attendee." };
  }
  revalidatePath("/events");
  return { ok: true };
}

/**
 * Delete an event (full_access). Cascades to its attendance rows server-side.
 * `ok` lets the caller redirect / toast; `error` is a human message on failure.
 */
export async function deleteEvent(
  eventId: number,
): Promise<AttendeeActionResult> {
  try {
    await apiDelete(`/events/${eventId}`);
  } catch (e) {
    if (e instanceof ApiError) return { ok: false, error: e.message };
    return { ok: false, error: "Failed to delete event." };
  }
  revalidatePath("/events");
  revalidateTag("events");
  return { ok: true };
}

/* ------------------------------------------------------- CSV bulk import ----- */

export type EventImportPreviewState =
  | { ok: true; data: EventImportPreview }
  | { ok: false; error: string };

export type EventImportResultState =
  | { ok: true; data: EventImportResult }
  | { ok: false; error: string };

/**
 * Rebuild the import FormData: the attendee `file` (re-named) plus the event
 * identity fields the wizard captured (#149 — one CSV = one event). Returns null
 * if the file is missing/empty. The backend re-validates title/date.
 */
const _EVENT_FIELDS = [
  "event_name",
  "event_date",
  "event_type",
  "event_location",
  "event_notes",
] as const;

function importFormData(formData: FormData): FormData | null {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return null;
  const fd = new FormData();
  fd.append("file", file, file.name);
  for (const key of _EVENT_FIELDS) {
    const value = formData.get(key);
    if (typeof value === "string" && value !== "") fd.append(key, value);
  }
  return fd;
}

/** Dry-run an events CSV against POST /events/import/preview (full_access). */
export async function previewEventsImport(
  formData: FormData,
): Promise<EventImportPreviewState> {
  const fd = importFormData(formData);
  if (!fd) return { ok: false, error: "Choose a .csv file to check." };
  try {
    const data = await apiPostForm<EventImportPreview>(
      "/events/import/preview",
      fd,
    );
    return { ok: true, data };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof ApiError ? e.message : "Couldn't read the file — try again.",
    };
  }
}

/** Commit the events import via POST /events/import — the SAME validated file. */
export async function commitEventsImport(
  formData: FormData,
): Promise<EventImportResultState> {
  const fd = importFormData(formData);
  if (!fd) return { ok: false, error: "Choose a .csv file to import." };
  try {
    const data = await apiPostForm<EventImportResult>("/events/import", fd);
    revalidatePath("/events");
    revalidateTag("events");
    return { ok: true, data };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof ApiError ? e.message : "Import failed — try again.",
    };
  }
}

/** Fetch the events import CSV template (GET /events/import/template) as text. */
export async function downloadEventsTemplate(): Promise<
  { ok: true; csv: string } | { ok: false; error: string }
> {
  try {
    const csv = await apiGetText("/events/import/template");
    return { ok: true, csv };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof ApiError ? e.message : "Couldn't download the template.",
    };
  }
}

/**
 * Download an event's attendee roster as CSV (GET /events/{id}/attendees/export)
 * — columns Name, Email, Net ID. full_access on the backend (bulk alumni PII);
 * the client turns the returned text into a Blob download. Returns the raw CSV
 * plus a suggested filename so the caller doesn't have to know the shape.
 */
export async function exportEventAttendees(
  eventId: number,
): Promise<
  { ok: true; csv: string; filename: string } | { ok: false; error: string }
> {
  try {
    const csv = await apiGetText(`/events/${eventId}/attendees/export`);
    return { ok: true, csv, filename: `event_${eventId}_attendees.csv` };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof ApiError ? e.message : "Couldn't download attendees.",
    };
  }
}

/* ------------------------------------ Conference-attendee matching (#612) ----- */
//
// Upload a conference attendee list scoped to ONE event, get PROPOSED matches
// back, and write only what a human approved. Three legs, mirroring the CSV
// import wizard's preview -> apply split, except approval is per ROW rather
// than for the batch.
//
// Nothing here can auto-apply: `previewAttendeeMatch` writes nothing, and the
// two apply actions send only the ids / row numbers the reviewer explicitly
// ticked (see src/lib/attendeeMatch.ts, which never pre-selects anything).

export type AttendeeMatchPreviewState =
  | { ok: true; data: AttendeeMatchPreview }
  | { ok: false; error: string };

export type AttendeeApplyState =
  | { ok: true; data: AttendeeApplyResult }
  | { ok: false; error: string };

export type AttendeeFriendState =
  | { ok: true; data: AttendeeFriendResult }
  | { ok: false; error: string };

/** Pull the attendee file out of a FormData, or null if it's missing/empty. */
function attendeeFile(formData: FormData): File | null {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return null;
  return file;
}

/**
 * Dry-run an attendee list against
 * POST /events/{id}/attendees/match/preview (full_access, NO writes).
 *
 * The attendee list is names/emails/companies — a few hundred KB at worst — so
 * it goes through the normal multipart server action. It is capped at 4 MiB
 * server-side, deliberately below Vercel's ~4.5 MB request-body ceiling so the
 * app's own 413 fires instead of the platform error the browser misreports as
 * a CORS failure (app #595). A list large enough to need the photo import's
 * direct-to-storage dance would first hit the backend's 2,000-row limit.
 */
export async function previewAttendeeMatch(
  eventId: number,
  formData: FormData,
): Promise<AttendeeMatchPreviewState> {
  const file = attendeeFile(formData);
  if (!file) return { ok: false, error: "Choose a .csv file to check." };
  const fd = new FormData();
  fd.append("file", file, file.name);
  try {
    const data = await apiPostForm<AttendeeMatchPreview>(
      `/events/${eventId}/attendees/match/preview`,
      fd,
    );
    return { ok: true, data };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof ApiError
          ? e.message
          : "Couldn't read the file — try again.",
    };
  }
}

/**
 * Record attendance for the matches a human approved
 * (POST /events/{id}/attendees/match/approve).
 *
 * Approving marks that person as attending THIS event and changes nothing else
 * on their record. The backend re-validates every id and is idempotent per
 * (event, alumni), so re-running the same file never double-adds.
 */
export async function approveAttendeeMatches(
  eventId: number,
  approvals: AttendeeApproval[],
): Promise<AttendeeApplyState> {
  if (approvals.length === 0) {
    return { ok: false, error: "Nothing approved yet." };
  }
  try {
    const data = await apiPost<AttendeeApplyResult>(
      `/events/${eventId}/attendees/match/approve`,
      { approvals },
    );
    revalidatePath("/events");
    revalidateTag("events");
    return { ok: true, data };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof ApiError ? e.message : "Couldn't save — try again.",
    };
  }
}

/**
 * Create friend records for the unmatched rows the reviewer chose and attach
 * them to the event (POST /events/{id}/attendees/match/friends).
 *
 * The SAME file is re-posted: the backend re-parses and re-maps it rather than
 * trusting a client-built payload, so each friend carries everything in the
 * file that maps to a DB column.
 */
export async function createAttendeeFriends(
  eventId: number,
  rows: number[],
  formData: FormData,
): Promise<AttendeeFriendState> {
  const file = attendeeFile(formData);
  if (!file) return { ok: false, error: "Re-select the .csv file to continue." };
  if (rows.length === 0) return { ok: false, error: "No rows chosen." };
  const fd = new FormData();
  fd.append("file", file, file.name);
  fd.append("rows", rows.join(","));
  try {
    const data = await apiPostForm<AttendeeFriendResult>(
      `/events/${eventId}/attendees/match/friends`,
      fd,
    );
    revalidatePath("/events");
    revalidatePath("/friends");
    revalidateTag("events");
    revalidateTag("dashboard");
    return { ok: true, data };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof ApiError ? e.message : "Couldn't create friends — try again.",
    };
  }
}

/** Fetch the starting-point attendee CSV (GET /events/attendees/match/template). */
export async function downloadAttendeeMatchTemplate(): Promise<
  { ok: true; csv: string } | { ok: false; error: string }
> {
  try {
    const csv = await apiGetText("/events/attendees/match/template");
    return { ok: true, csv };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof ApiError ? e.message : "Couldn't download the template.",
    };
  }
}
