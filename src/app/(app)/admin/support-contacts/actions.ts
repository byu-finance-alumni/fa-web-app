"use server";

import { revalidatePath } from "next/cache";
import { apiPost, apiPatch, apiDelete, ApiError } from "@/lib/api";

type Result = { error?: string } | null;

/**
 * Support-contact admin actions (engineer only — the backend re-enforces via
 * RequireEngineer). These edit the "who to contact" list shown to logged-in
 * users on the in-app error screen. Each mutation revalidates the editor page.
 */

export async function createSupportContact(input: {
  role_label: string;
  name: string;
  email: string;
  sort_order?: number;
}): Promise<Result> {
  try {
    await apiPost("/admin/support-contacts", {
      role_label: input.role_label,
      name: input.name,
      email: input.email,
      ...(input.sort_order != null ? { sort_order: input.sort_order } : {}),
    });
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : "Failed to add contact." };
  }
  revalidatePath("/admin/support-contacts");
  return null;
}

export async function updateSupportContact(
  contactId: number,
  input: {
    role_label?: string;
    name?: string;
    email?: string;
    sort_order?: number;
  },
): Promise<Result> {
  try {
    await apiPatch(`/admin/support-contacts/${contactId}`, input);
  } catch (e) {
    return {
      error: e instanceof ApiError ? e.message : "Failed to update contact.",
    };
  }
  revalidatePath("/admin/support-contacts");
  return null;
}

export async function deleteSupportContact(contactId: number): Promise<Result> {
  try {
    await apiDelete(`/admin/support-contacts/${contactId}`);
  } catch (e) {
    return {
      error: e instanceof ApiError ? e.message : "Failed to remove contact.",
    };
  }
  revalidatePath("/admin/support-contacts");
  return null;
}
