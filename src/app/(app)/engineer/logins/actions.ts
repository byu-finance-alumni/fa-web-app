"use server";

import { revalidatePath } from "next/cache";
import { apiDelete, ApiError } from "@/lib/api";

type PurgeResult = { ok: true; deleted: number } | { ok: false; error: string };

/**
 * Delete the ENTIRE login history (#200). Engineer-only — the backend
 * (DELETE /admin/logins, RequireEngineer) re-enforces access and returns the
 * number of rows wiped. Irreversible; used to clear accumulated dev/test
 * sign-in noise from the Logins tab. Revalidates the page so the now-empty
 * history renders.
 */
export async function purgeLogins(): Promise<PurgeResult> {
  try {
    const { deleted } = await apiDelete<{ deleted: number }>("/admin/logins");
    revalidatePath("/engineer/logins");
    return { ok: true, deleted };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof ApiError ? e.message : "Couldn't delete the logins.",
    };
  }
}
