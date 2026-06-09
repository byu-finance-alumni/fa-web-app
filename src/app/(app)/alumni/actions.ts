"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { apiPost, apiPatch, apiDelete, ApiError } from "@/lib/api";

/**
 * Result of a form server action.
 *
 * - `error` is the summary / generic message shown at the form level.
 * - `fieldErrors` maps an input `name` to its validation message, populated
 *   from a backend 422 (`error.fields`). The form renders these inline at the
 *   matching input; `error` remains the fallback for non-validation failures.
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
        // Keep the first message per field; matches input `name` attributes.
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

/** Trimmed string getter; `undefined` for blank/missing values. */
function getStr(formData: FormData, k: string): string | undefined {
  const v = formData.get(k);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
}

/** Drop `undefined` entries so optional fields aren't sent as null/empty. */
function compact(obj: Record<string, unknown>): Record<string, unknown> {
  for (const k of Object.keys(obj)) {
    if (obj[k] === undefined) delete obj[k];
  }
  return obj;
}

/** Core alumni fields (shared by create + update). */
function buildPayload(formData: FormData): Record<string, unknown> {
  const str = (k: string) => getStr(formData, k);
  const num = (k: string) => {
    const v = str(k);
    return v !== undefined ? Number(v) : undefined;
  };
  return compact({
    first_name: str("first_name"),
    last_name: str("last_name"),
    preferred_first_name: str("preferred_first_name"),
    byu_id: str("byu_id"),
    net_id: str("net_id"),
    graduation_year: num("graduation_year"),
    gender: str("gender"),
    linkedin_url: str("linkedin_url"),
    notes: str("notes"),
  });
}

/**
 * Build one optional nested section from the FormData. Inputs are named with a
 * dotted prefix (e.g. `contact.personal_email`) that matches the backend's
 * nested schema, so 422 field errors map straight back to the same input name.
 *
 * Returns `undefined` when the section has no values, so we omit empty objects
 * from the payload entirely (the backend only writes sections with content).
 */
function buildSection(
  formData: FormData,
  prefix: string,
  fields: { name: string; type?: "string" | "number" | "bool" }[],
): Record<string, unknown> | undefined {
  const section: Record<string, unknown> = {};
  let hasValue = false;
  for (const { name, type = "string" } of fields) {
    const key = `${prefix}.${name}`;
    if (type === "bool") {
      // Unchecked checkboxes are absent from FormData; presence => true.
      if (formData.get(key) !== null) {
        section[name] = true;
        hasValue = true;
      }
      continue;
    }
    const raw = getStr(formData, key);
    if (raw === undefined) continue;
    section[name] = type === "number" ? Number(raw) : raw;
    hasValue = true;
  }
  return hasValue ? section : undefined;
}

/** Full create payload: core fields plus the optional nested sections. */
function buildCreatePayload(formData: FormData): Record<string, unknown> {
  const payload = buildPayload(formData);

  const contact = buildSection(formData, "contact", [
    { name: "personal_email" },
    { name: "work_email" },
    { name: "phone" },
    { name: "address_line_1" },
    { name: "address_line_2" },
    { name: "city" },
    { name: "state" },
    { name: "zip" },
    { name: "country" },
    { name: "region" },
  ]);

  const career = buildSection(formData, "career", [
    { name: "current_employer" },
    { name: "current_title" },
    { name: "current_industry" },
    { name: "current_industry_secondary" },
    { name: "current_city" },
    { name: "current_state" },
    { name: "current_country" },
    { name: "current_zip" },
    { name: "seniority_level" },
  ]);

  const education = buildSection(formData, "education", [
    { name: "university" },
    { name: "college" },
    { name: "department" },
    { name: "degree" },
    { name: "major" },
    { name: "degree_status" },
    { name: "degree_year", type: "number" },
  ]);

  const engagement = buildSection(formData, "engagement", [
    { name: "nettrek_host_willing", type: "bool" },
    { name: "finance_conference_willing", type: "bool" },
    { name: "mentor_willing", type: "bool" },
    { name: "company_event_sponsor_willing", type: "bool" },
    { name: "guest_speaker_willing", type: "bool" },
    { name: "help_at_event_willing", type: "bool" },
    { name: "case_competition_host_willing", type: "bool" },
    { name: "women_in_finance_mentor_willing", type: "bool" },
    { name: "hired_finance_intern", type: "bool" },
    { name: "hired_finance_full_time", type: "bool" },
    { name: "piff_donor", type: "bool" },
    { name: "cfp_designation", type: "bool" },
    { name: "cfa_designation", type: "bool" },
    { name: "engagement_notes" },
  ]);

  return compact({ ...payload, contact, career, education, engagement });
}

export async function createAlumni(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  let id: number;
  try {
    const created = await apiPost<{ alumni_id: number }>(
      "/alumni",
      buildCreatePayload(formData),
    );
    id = created.alumni_id;
  } catch (e) {
    return toFormState(e, "Failed to create.");
  }
  revalidatePath("/alumni");
  revalidateTag("dashboard");
  revalidateTag("geography");
  redirect(`/alumni/${id}`);
}

export async function updateAlumni(
  id: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await apiPatch(`/alumni/${id}`, buildCreatePayload(formData));
  } catch (e) {
    return toFormState(e, "Failed to save.");
  }
  revalidatePath(`/alumni/${id}`);
  revalidatePath("/alumni");
  revalidateTag("dashboard");
  revalidateTag("geography");
  redirect(`/alumni/${id}`);
}

export async function archiveAlumni(id: number): Promise<FormState> {
  try {
    await apiDelete(`/alumni/${id}`);
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : "Failed to archive." };
  }
  revalidatePath("/alumni");
  revalidatePath(`/alumni/${id}`);
  revalidateTag("dashboard");
  revalidateTag("geography");
  // Stay on the profile so the now-archived state (and Unarchive) is visible.
  return null;
}

export async function restoreAlumni(id: number): Promise<FormState> {
  try {
    await apiPost(`/alumni/${id}/restore`, {});
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : "Failed to unarchive." };
  }
  revalidatePath("/alumni");
  revalidatePath(`/alumni/${id}`);
  revalidateTag("dashboard");
  revalidateTag("geography");
  return null;
}

export async function addInteraction(
  alumniId: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const type = formData.get("interaction_type");
  const notes = formData.get("interaction_notes");
  if (typeof type !== "string" || type.trim() === "") {
    return { error: "Interaction type is required." };
  }
  try {
    await apiPost(`/alumni/${alumniId}/interactions`, {
      interaction_type: type.trim(),
      interaction_notes:
        typeof notes === "string" && notes.trim() !== ""
          ? notes.trim()
          : undefined,
    });
  } catch (e) {
    return {
      error: e instanceof ApiError ? e.message : "Failed to add interaction.",
    };
  }
  revalidatePath(`/alumni/${alumniId}`);
  revalidateTag("dashboard"); // contacted / follow-up KPIs
  return null;
}

export async function addTask(
  alumniId: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const title = formData.get("task_title");
  const due = formData.get("due_date");
  const notes = formData.get("task_notes");
  if (typeof title !== "string" || title.trim() === "") {
    return { error: "Task title is required." };
  }
  try {
    await apiPost(`/alumni/${alumniId}/tasks`, {
      task_title: title.trim(),
      due_date:
        typeof due === "string" && due.trim() !== "" ? due.trim() : undefined,
      task_notes:
        typeof notes === "string" && notes.trim() !== ""
          ? notes.trim()
          : undefined,
    });
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : "Failed to add task." };
  }
  revalidatePath(`/alumni/${alumniId}`);
  revalidateTag("dashboard"); // contacted / follow-up KPIs
  return null;
}

export async function setTaskComplete(
  alumniId: number,
  taskId: number,
  completed: boolean,
): Promise<FormState> {
  try {
    await apiPatch(`/alumni/${alumniId}/tasks/${taskId}`, { completed });
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : "Failed to update task." };
  }
  revalidatePath(`/alumni/${alumniId}`);
  revalidateTag("dashboard"); // contacted / follow-up KPIs
  return null;
}

export async function addEmploymentRole(
  alumniId: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const employer = formData.get("employer_name");
  if (typeof employer !== "string" || employer.trim() === "") {
    return { error: "Employer is required." };
  }
  const num = (k: string) => {
    const v = getStr(formData, k);
    return v !== undefined ? Number(v) : undefined;
  };
  try {
    await apiPost(
      `/alumni/${alumniId}/employment`,
      compact({
        employer_name: employer.trim(),
        employment_title: getStr(formData, "employment_title"),
        employment_industry: getStr(formData, "employment_industry"),
        city: getStr(formData, "city"),
        state: getStr(formData, "state"),
        start_year: num("start_year"),
        end_year: num("end_year"),
        is_current: formData.get("is_current") !== null,
      }),
    );
  } catch (e) {
    return toFormState(e, "Failed to add role.");
  }
  revalidatePath(`/alumni/${alumniId}`);
  revalidateTag("dashboard");
  return null;
}

export async function addTag(
  alumniId: number,
  tag: string,
): Promise<FormState> {
  try {
    await apiPost(`/alumni/${alumniId}/tags`, { tag });
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : "Failed to add tag." };
  }
  revalidatePath(`/alumni/${alumniId}`);
  revalidateTag("dashboard");
  return null;
}

export async function removeTag(
  alumniId: number,
  tag: string,
): Promise<FormState> {
  try {
    await apiDelete(`/alumni/${alumniId}/tags/${encodeURIComponent(tag)}`);
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : "Failed to remove tag." };
  }
  revalidatePath(`/alumni/${alumniId}`);
  revalidateTag("dashboard");
  return null;
}

export async function addStatusLabel(
  alumniId: number,
  label: string,
): Promise<FormState> {
  try {
    await apiPost(`/alumni/${alumniId}/status-labels`, { label });
  } catch (e) {
    return {
      error: e instanceof ApiError ? e.message : "Failed to add status label.",
    };
  }
  revalidatePath(`/alumni/${alumniId}`);
  revalidateTag("dashboard");
  return null;
}

export async function removeStatusLabel(
  alumniId: number,
  label: string,
): Promise<FormState> {
  try {
    await apiDelete(
      `/alumni/${alumniId}/status-labels/${encodeURIComponent(label)}`,
    );
  } catch (e) {
    return {
      error: e instanceof ApiError ? e.message : "Failed to remove status label.",
    };
  }
  revalidatePath(`/alumni/${alumniId}`);
  revalidateTag("dashboard");
  return null;
}

export async function addEventAttendance(
  alumniId: number,
  eventId: number,
  status?: string,
): Promise<FormState> {
  try {
    await apiPost(`/alumni/${alumniId}/events`, {
      event_id: eventId,
      attendance_status:
        status && status.trim() !== "" ? status.trim() : undefined,
    });
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : "Failed to add event." };
  }
  revalidatePath(`/alumni/${alumniId}`);
  revalidateTag("dashboard");
  revalidateTag("events");
  return null;
}
