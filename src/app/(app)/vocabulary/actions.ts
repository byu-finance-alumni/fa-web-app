"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { apiPost, apiPatch, apiDelete, ApiError } from "@/lib/api";

type Result = { error?: string } | null;

/**
 * Vocabulary admin actions. Gated by the `vocab_admin` capability — held by the
 * engineer and by any role an engineer grants it in the permission editor (e.g.
 * super_admin); the backend re-enforces via RequireVocabAdmin. Each mutation
 * revalidates the vocabulary page and the "vocabulary" cache tag so the app's
 * dropdowns (e.g. event types) pick up the change.
 */

function revalidate() {
  revalidatePath("/vocabulary");
  revalidateTag("vocabulary");
  // Vocab also feeds the alumni filter/search facets (industry, status label,
  // survey status) via `/alumni/filter-options`, which is cached under its own
  // tag. Invalidate it too so those dropdowns pick up renames/additions/hides
  // instead of showing stale options (#275).
  revalidateTag("alumni-filter-options");
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

/**
 * Permanently remove a term (hard delete) via the dedicated `/permanent` route —
 * distinct from {@link setVocabTermActive}(id, false), which only hides it. The
 * value stays on any existing records that already used it; it just disappears
 * from every admin list and dropdown and can't be restored.
 */
export async function deleteVocabTerm(termId: number): Promise<Result> {
  try {
    await apiDelete(`/admin/vocabulary/${termId}/permanent`);
  } catch (e) {
    return {
      error: e instanceof ApiError ? e.message : "Failed to delete term.",
    };
  }
  revalidate();
  return null;
}
