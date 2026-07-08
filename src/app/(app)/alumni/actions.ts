"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import {
  apiGet,
  apiPost,
  apiPatch,
  apiDelete,
  apiPostForm,
  apiGetText,
  apiPostText,
  ApiError,
} from "@/lib/api";
import type {
  HygienePreview,
  ImportPreview,
  ImportResult,
} from "@/types/alumni";
import type {
  AlumniExportRequest,
  ExportColumnCatalog,
} from "@/types/export";
import type { Note, NoteEntityType } from "@/types/notes";

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
  // Spouse link: always sent (number when linked, else null) rather than
  // omitted, so unlinking on edit actually clears it. Every other blank field
  // is omitted (PATCH can't currently clear them) — consistent with the rest of
  // the form.
  const spouseIdRaw = formData.get("spouse_alumni_id");
  const spouse_alumni_id =
    typeof spouseIdRaw === "string" && spouseIdRaw.trim() !== ""
      ? Number(spouseIdRaw)
      : null;

  return compact({
    first_name: str("first_name"),
    last_name: str("last_name"),
    preferred_first_name: str("preferred_first_name"),
    byu_id: str("byu_id"),
    net_id: str("net_id"),
    birth_date: str("birth_date"),
    graduation_year: num("graduation_year"),
    graduation_month: num("graduation_month"),
    gender: str("gender"),
    spouse_first_name: str("spouse_first_name"),
    spouse_last_name: str("spouse_last_name"),
    spouse_birth_date: str("spouse_birth_date"),
    spouse_alumni_id,
    linkedin_url: str("linkedin_url"),
    notes: str("notes"),
    // Secondary affiliation / education fields (#47) — top-level optional
    // fields on the alumni record (siblings of graduate_degree), so they go
    // through the core payload rather than a nested section.
    graduate_degree: str("graduate_degree"),
    mba_program: str("mba_program"),
    law_school: str("law_school"),
    medical_school: str("medical_school"),
    graduate_school: str("graduate_school"),
    startup_involvement: str("startup_involvement"),
    advisory_roles: str("advisory_roles"),
    secondary_employment: str("secondary_employment"),
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

async function createFrom(
  payload: Record<string, unknown>,
): Promise<FormState> {
  let id: number;
  try {
    const created = await apiPost<{ alumni_id: number }>("/alumni", payload);
    id = created.alumni_id;
  } catch (e) {
    return toFormState(e, "Failed to create.");
  }
  revalidatePath("/alumni");
  revalidateTag("dashboard");
  revalidateTag("geography");
  redirect(`/alumni/${id}`);
}

export async function createAlumni(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return createFrom(buildCreatePayload(formData));
}

// #218: create a "friend of the program" — a non-alumni record. Force
// is_alumni=false AFTER buildCreatePayload's compaction (which would otherwise
// drop the falsy flag), so the record lands in the Friends roster, never Alumni.
export async function createFriend(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return createFrom({ ...buildCreatePayload(formData), is_alumni: false });
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

/**
 * Result of a hygiene-preview call. Either the server-side preview
 * (clean + duplicate/warning checks) or an error message to surface with a
 * retry. We reuse `toFormState` for error mapping but expose only the summary
 * message here — the Review step surfaces field-level findings via the
 * structured `blockers`/`warnings`, not the 422 `fieldErrors` map.
 */
export type PreviewState =
  | { ok: true; preview: HygienePreview }
  | { ok: false; error: string };

/** Preview the data-hygiene result for a NEW alumnus before creating. */
export async function previewAlumni(formData: FormData): Promise<PreviewState> {
  try {
    const preview = await apiPost<HygienePreview>(
      "/alumni/preview",
      buildCreatePayload(formData),
    );
    return { ok: true, preview };
  } catch (e) {
    const fs = toFormState(e, "Couldn't run the check — try again.");
    return { ok: false, error: fs?.error ?? "Couldn't run the check — try again." };
  }
}

/** Preview the data-hygiene result for an EDIT before saving changes. */
export async function previewAlumniUpdate(
  id: number,
  formData: FormData,
): Promise<PreviewState> {
  try {
    const preview = await apiPost<HygienePreview>(
      `/alumni/${id}/preview`,
      buildCreatePayload(formData),
    );
    return { ok: true, preview };
  } catch (e) {
    const fs = toFormState(e, "Couldn't run the check — try again.");
    return { ok: false, error: fs?.error ?? "Couldn't run the check — try again." };
  }
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
  const when = formData.get("interaction_date_time");
  if (typeof type !== "string" || type.trim() === "") {
    return { error: "Interaction type is required." };
  }
  try {
    await apiPost(`/alumni/${alumniId}/interactions`, {
      interaction_type: type.trim(),
      interaction_date_time:
        typeof when === "string" && when.trim() !== ""
          ? when.trim()
          : undefined,
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

export async function updateInteraction(
  alumniId: number,
  interactionId: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const type = formData.get("interaction_type");
  if (typeof type !== "string" || type.trim() === "") {
    return { error: "Interaction type is required." };
  }
  try {
    // The edit dialog always submits date + notes (prefilled), so send them
    // explicitly — `null` when blank, so clearing a field actually clears it
    // (compact would have dropped a blank value and silently kept the old one).
    await apiPatch(`/alumni/${alumniId}/interactions/${interactionId}`, {
      interaction_type: type.trim(),
      interaction_date_time: getStr(formData, "interaction_date_time") ?? null,
      interaction_notes: getStr(formData, "interaction_notes") ?? null,
    });
  } catch (e) {
    return toFormState(e, "Failed to save interaction.");
  }
  revalidatePath(`/alumni/${alumniId}`);
  revalidateTag("dashboard"); // contacted / follow-up KPIs
  return null;
}

export async function deleteInteraction(
  alumniId: number,
  interactionId: number,
): Promise<FormState> {
  try {
    await apiDelete(`/alumni/${alumniId}/interactions/${interactionId}`);
  } catch (e) {
    return {
      error:
        e instanceof ApiError ? e.message : "Failed to delete interaction.",
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

export async function updateEmploymentRole(
  alumniId: number,
  employmentHistoryId: number,
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
    await apiPatch(
      `/alumni/${alumniId}/employment/${employmentHistoryId}`,
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
    return toFormState(e, "Failed to save role.");
  }
  revalidatePath(`/alumni/${alumniId}`);
  revalidateTag("dashboard");
  revalidateTag("geography");
  return null;
}

export async function deleteEmploymentRole(
  alumniId: number,
  employmentHistoryId: number,
): Promise<FormState> {
  try {
    await apiDelete(`/alumni/${alumniId}/employment/${employmentHistoryId}`);
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : "Failed to delete role." };
  }
  revalidatePath(`/alumni/${alumniId}`);
  revalidateTag("dashboard");
  revalidateTag("geography");
  return null;
}

/** Build the education payload shared by add + update. */
function buildEducationPayload(formData: FormData): Record<string, unknown> {
  const num = (k: string) => {
    const v = getStr(formData, k);
    return v !== undefined ? Number(v) : undefined;
  };
  return compact({
    university: getStr(formData, "university"),
    college: getStr(formData, "college"),
    department: getStr(formData, "department"),
    degree: getStr(formData, "degree"),
    major: getStr(formData, "major"),
    degree_status: getStr(formData, "degree_status"),
    degree_year: num("degree_year"),
  });
}

export async function addEducation(
  alumniId: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await apiPost(`/alumni/${alumniId}/education`, buildEducationPayload(formData));
  } catch (e) {
    return toFormState(e, "Failed to add education.");
  }
  revalidatePath(`/alumni/${alumniId}`);
  return null;
}

export async function updateEducation(
  alumniId: number,
  educationId: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await apiPatch(
      `/alumni/${alumniId}/education/${educationId}`,
      buildEducationPayload(formData),
    );
  } catch (e) {
    return toFormState(e, "Failed to save education.");
  }
  revalidatePath(`/alumni/${alumniId}`);
  return null;
}

export async function deleteEducation(
  alumniId: number,
  educationId: number,
): Promise<FormState> {
  try {
    await apiDelete(`/alumni/${alumniId}/education/${educationId}`);
  } catch (e) {
    return {
      error: e instanceof ApiError ? e.message : "Failed to delete education.",
    };
  }
  revalidatePath(`/alumni/${alumniId}`);
  return null;
}

/** Build the leadership payload shared by add + update. */
function buildLeadershipPayload(formData: FormData): Record<string, unknown> {
  const yearRaw = getStr(formData, "role_year");
  return compact({
    leadership_role: getStr(formData, "leadership_role"),
    role_year: yearRaw !== undefined ? Number(yearRaw) : undefined,
  });
}

export async function addLeadership(
  alumniId: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const role = formData.get("leadership_role");
  if (typeof role !== "string" || role.trim() === "") {
    return { error: "Leadership role is required." };
  }
  try {
    await apiPost(
      `/alumni/${alumniId}/leadership`,
      buildLeadershipPayload(formData),
    );
  } catch (e) {
    return toFormState(e, "Failed to add leadership entry.");
  }
  revalidatePath(`/alumni/${alumniId}`);
  return null;
}

export async function updateLeadership(
  alumniId: number,
  leadershipId: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const role = formData.get("leadership_role");
  if (typeof role !== "string" || role.trim() === "") {
    return { error: "Leadership role is required." };
  }
  try {
    await apiPatch(
      `/alumni/${alumniId}/leadership/${leadershipId}`,
      buildLeadershipPayload(formData),
    );
  } catch (e) {
    return toFormState(e, "Failed to save leadership entry.");
  }
  revalidatePath(`/alumni/${alumniId}`);
  return null;
}

export async function deleteLeadership(
  alumniId: number,
  leadershipId: number,
): Promise<FormState> {
  try {
    await apiDelete(`/alumni/${alumniId}/leadership/${leadershipId}`);
  } catch (e) {
    return {
      error: e instanceof ApiError ? e.message : "Failed to delete leadership entry.",
    };
  }
  revalidatePath(`/alumni/${alumniId}`);
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

/* ------------------------------------------------------- CSV bulk import ----- */

/** Discriminated result for the two import steps — `{ok}` / `{ok:false}`. */
export type ImportPreviewState =
  | { ok: true; data: ImportPreview }
  | { ok: false; error: string };

export type ImportResultState =
  | { ok: true; data: ImportResult }
  | { ok: false; error: string };

/** Pull the single `file` out of the submitted FormData (re-named to `file`). */
function importFormData(formData: FormData): FormData | null {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return null;
  const fd = new FormData();
  fd.append("file", file, file.name);
  return fd;
}

/**
 * Dry-run an uploaded CSV against POST /alumni/import/preview (multipart
 * `file`). Returns the structured report verbatim, or a mapped error message
 * with a retry. The same File is re-uploaded to `commitImport` on confirm.
 */
export async function previewImport(
  formData: FormData,
): Promise<ImportPreviewState> {
  const fd = importFormData(formData);
  if (!fd) return { ok: false, error: "Choose a .csv file to check." };
  try {
    const data = await apiPostForm<ImportPreview>(
      "/alumni/import/preview",
      fd,
    );
    return { ok: true, data };
  } catch (e) {
    const fs = toFormState(e, "Couldn't read the file — try again.");
    return {
      ok: false,
      error: fs?.error ?? "Couldn't read the file — try again.",
    };
  }
}

/**
 * Commit the import via POST /alumni/import (multipart `file`) — the SAME file
 * the preview validated. Returns the per-row outcome, or a mapped error.
 */
export async function commitImport(
  formData: FormData,
): Promise<ImportResultState> {
  const fd = importFormData(formData);
  if (!fd) return { ok: false, error: "Choose a .csv file to import." };
  try {
    const data = await apiPostForm<ImportResult>("/alumni/import", fd);
    revalidatePath("/alumni");
    revalidateTag("dashboard");
    revalidateTag("geography");
    return { ok: true, data };
  } catch (e) {
    const fs = toFormState(e, "Import failed — try again.");
    return { ok: false, error: fs?.error ?? "Import failed — try again." };
  }
}

/**
 * Fetch the CSV import template (GET /alumni/import/template) as text so the
 * client can trigger a Blob download — the GET needs the user's Bearer token,
 * which only the server client attaches.
 */
export async function downloadImportTemplate(): Promise<
  { ok: true; csv: string } | { ok: false; error: string }
> {
  try {
    const csv = await apiGetText("/alumni/import/template");
    return { ok: true, csv };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof ApiError ? e.message : "Couldn't download the template.",
    };
  }
}

/**
 * Export a single alumnus's full profile via GET /alumni/{id}/export
 * (RequireFullAccess). The backend returns the profile aggregate as JSON with
 * the `audit` trail and internal user PKs stripped, and audit-logs the export.
 *
 * The exported payload MUST come from this server response — never serialized
 * client-side from an in-memory prop — so that every export is access-checked
 * and recorded (FERPA / BYU data-governance). The client only turns the
 * returned JSON into a Blob download.
 */
export async function exportProfile(
  alumniId: number,
): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
  try {
    const data = await apiGet<unknown>(`/alumni/${alumniId}/export`);
    return { ok: true, data };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof ApiError ? e.message : "Couldn't export this profile.",
    };
  }
}

/**
 * The catalog of exportable columns + the default-checked selection
 * (GET /alumni/export/columns, RequireFullAccess), for the export column picker.
 */
export async function getExportColumns(): Promise<
  { ok: true; catalog: ExportColumnCatalog } | { ok: false; error: string }
> {
  try {
    const catalog = await apiGet<ExportColumnCatalog>("/alumni/export/columns");
    return { ok: true, catalog };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof ApiError ? e.message : "Couldn't load export columns.",
    };
  }
}

/**
 * Run the customizable alumni CSV export (POST /alumni/export, RequireFullAccess)
 * for the chosen columns over the current list filters. The backend streams the
 * CSV (and audit-logs the disclosure); we return the text so the client can turn
 * it into a Blob download. A 413 (too many rows) surfaces as a clear message.
 */
export async function exportAlumni(
  req: AlumniExportRequest,
): Promise<{ ok: true; csv: string } | { ok: false; error: string }> {
  try {
    const csv = await apiPostText("/alumni/export", req);
    return { ok: true, csv };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof ApiError ? e.message : "Export failed — try again.",
    };
  }
}

// --- Unified notes (#39) -----------------------------------------------------
//
// Profile-scoped wrappers over the generic /notes endpoints (entity_type
// "alumni"). Write = full_access and up; the backend re-enforces it and
// audit-logs every change. We revalidate the profile so the notes card and the
// Audit tab refresh after a mutation.

/** Add a note to an alumni profile (full_access). */
export async function addProfileNote(
  alumniId: number,
  body: string,
): Promise<{ ok: true; note: Note } | { ok: false; error: string }> {
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: "Note can't be empty." };
  try {
    const note = await apiPost<Note>("/notes", {
      entity_type: "alumni",
      entity_id: alumniId,
      body: trimmed,
    });
    revalidatePath(`/alumni/${alumniId}`);
    return { ok: true, note };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof ApiError ? e.message : "Couldn't add the note.",
    };
  }
}

/** Edit a note's body (full_access). */
export async function updateProfileNote(
  alumniId: number,
  noteId: number,
  body: string,
): Promise<{ ok: true; note: Note } | { ok: false; error: string }> {
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: "Note can't be empty." };
  try {
    const note = await apiPatch<Note>(`/notes/${noteId}`, { body: trimmed });
    revalidatePath(`/alumni/${alumniId}`);
    return { ok: true, note };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof ApiError ? e.message : "Couldn't save the note.",
    };
  }
}

/** Delete a note (full_access). */
export async function deleteProfileNote(
  alumniId: number,
  noteId: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await apiDelete(`/notes/${noteId}`);
    revalidatePath(`/alumni/${alumniId}`);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof ApiError ? e.message : "Couldn't delete the note.",
    };
  }
}

// --- Generic notes (#39) -----------------------------------------------------
//
// Entity-agnostic wrappers over the generic /notes endpoints, used by the
// reusable <EntityNotes> component (alumni / interaction / event). Write =
// full_access and up; the backend re-enforces it and audit-logs every change.
// Unlike the profile-scoped wrappers above we DON'T revalidate a hardcoded path
// (the entity varies) — callers refresh via router.refresh() / onChanged.

/** Add a note to any supported entity (full_access). */
export async function addNote(
  entityType: NoteEntityType,
  entityId: number,
  body: string,
): Promise<{ ok: true; note: Note } | { ok: false; error: string }> {
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: "Note can't be empty." };
  try {
    const note = await apiPost<Note>("/notes", {
      entity_type: entityType,
      entity_id: entityId,
      body: trimmed,
    });
    return { ok: true, note };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof ApiError ? e.message : "Couldn't add the note.",
    };
  }
}

/** Edit a note's body (full_access). */
export async function updateNote(
  noteId: number,
  body: string,
): Promise<{ ok: true; note: Note } | { ok: false; error: string }> {
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: "Note can't be empty." };
  try {
    const note = await apiPatch<Note>(`/notes/${noteId}`, { body: trimmed });
    return { ok: true, note };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof ApiError ? e.message : "Couldn't save the note.",
    };
  }
}

/** Delete a note (full_access). */
export async function deleteNote(
  noteId: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await apiDelete(`/notes/${noteId}`);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof ApiError ? e.message : "Couldn't delete the note.",
    };
  }
}
