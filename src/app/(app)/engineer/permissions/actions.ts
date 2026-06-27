"use server";

import { revalidatePath } from "next/cache";
import { apiPatch, ApiError } from "@/lib/api";
import type { PermissionMatrix } from "@/types/permissions";

type ToggleResult =
  | { ok: true; matrix: PermissionMatrix }
  | { ok: false; error: string };

/**
 * Grant or revoke one capability for one role (#164). The backend
 * (PATCH /engineer/permissions) re-enforces engineer-only access, rejects the
 * engineer row and non-assignable capabilities, audits the change, and returns
 * the authoritative post-change matrix. Revalidates the Users section so its
 * read-only role-capabilities table (#163) reflects the change.
 */
export async function togglePermission(
  role: string,
  capability: string,
  granted: boolean,
): Promise<ToggleResult> {
  try {
    const matrix = await apiPatch<PermissionMatrix>("/engineer/permissions", {
      role,
      capability,
      granted,
    });
    revalidatePath("/admin");
    return { ok: true, matrix };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof ApiError ? e.message : "Failed to update permission.",
    };
  }
}
