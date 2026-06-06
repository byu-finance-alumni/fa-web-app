"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiPost, apiPatch, apiDelete, ApiError } from "@/lib/api";

export type FormState = { error?: string } | null;

function buildPayload(formData: FormData): Record<string, unknown> {
  const str = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
  };
  const num = (k: string) => {
    const v = str(k);
    return v !== undefined ? Number(v) : undefined;
  };
  const payload: Record<string, unknown> = {
    first_name: str("first_name"),
    last_name: str("last_name"),
    preferred_first_name: str("preferred_first_name"),
    byu_id: str("byu_id"),
    net_id: str("net_id"),
    graduation_year: num("graduation_year"),
    gender: str("gender"),
    linkedin_url: str("linkedin_url"),
    notes: str("notes"),
  };
  for (const k of Object.keys(payload)) {
    if (payload[k] === undefined) delete payload[k];
  }
  return payload;
}

export async function createAlumni(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  let id: number;
  try {
    const created = await apiPost<{ alumni_id: number }>(
      "/alumni",
      buildPayload(formData),
    );
    id = created.alumni_id;
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : "Failed to create." };
  }
  revalidatePath("/alumni");
  redirect(`/alumni/${id}`);
}

export async function updateAlumni(
  id: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await apiPatch(`/alumni/${id}`, buildPayload(formData));
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : "Failed to save." };
  }
  revalidatePath(`/alumni/${id}`);
  revalidatePath("/alumni");
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
  return null;
}

export async function setTaskComplete(
  alumniId: number,
  taskId: number,
  completed: boolean,
): Promise<void> {
  await apiPatch(`/alumni/${alumniId}/tasks/${taskId}`, { completed });
  revalidatePath(`/alumni/${alumniId}`);
}
