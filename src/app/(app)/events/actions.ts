"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { apiPost, apiPatch, apiDelete, ApiError } from "@/lib/api";

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

export async function createEvent(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const name = formData.get("event_name");
  if (typeof name !== "string" || name.trim() === "") {
    return { error: "Event name is required." };
  }
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
  const name = formData.get("event_name");
  if (typeof name !== "string" || name.trim() === "") {
    return { error: "Event name is required." };
  }
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
