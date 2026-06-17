"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { apiPost, apiPatch, apiDelete, ApiError } from "@/lib/api";

type Result = { error?: string } | null;

/**
 * Vocabulary admin actions (engineer / super_admin — the backend re-enforces via
 * RequireVocabAdmin). Each mutation revalidates the admin page and the
 * "vocabulary" cache tag so the app's dropdowns (e.g. event types) pick up the
 * change.
 */

function revalidate() {
  revalidatePath("/admin/vocabulary");
  revalidateTag("vocabulary");
}

export async function createVocabTerm(
  category: string,
  value: string,
): Promise<Result> {
  try {
    await apiPost("/admin/vocabulary", { category, value });
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : "Failed to add term." };
  }
  revalidate();
  return null;
}

export async function renameVocabTerm(
  termId: number,
  value: string,
): Promise<Result> {
  try {
    await apiPatch(`/admin/vocabulary/${termId}`, { value });
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : "Failed to rename term." };
  }
  revalidate();
  return null;
}

export async function setVocabTermActive(
  termId: number,
  active: boolean,
): Promise<Result> {
  try {
    if (active) {
      // Reactivate via PATCH; deactivate via the soft-delete DELETE route.
      await apiPatch(`/admin/vocabulary/${termId}`, { active: true });
    } else {
      await apiDelete(`/admin/vocabulary/${termId}`);
    }
  } catch (e) {
    return {
      error: e instanceof ApiError ? e.message : "Failed to update term.",
    };
  }
  revalidate();
  return null;
}
