"use server";

import { revalidatePath } from "next/cache";
import { apiPost, ApiError } from "@/lib/api";

/**
 * Finish the forced password change: the BACKEND sets the new password and only
 * then clears the must-change-password flag (`POST /auth/password/change`,
 * fa-web-api#592). Authenticated, and it acts on the caller's own account, so
 * the body is just the new password.
 *
 * This replaced a two-step flow — the browser set the password through its own
 * Supabase session, then told `POST /auth/password/complete` it had — in which
 * the backend cleared the flag on our word alone, so a caller could skip the
 * first step and keep the temporary password. The backend now re-checks the
 * strength rules the form enforces and refuses the temporary password itself.
 *
 * On success we revalidate the root layout so the app shell re-fetches
 * `/auth/context` and no longer bounces the user back to `/set-password`.
 * Returns `null` on success or `{ error }` so the form can surface it.
 */
export async function changePassword(
  newPassword: string,
): Promise<{ error: string } | null> {
  try {
    await apiPost("/auth/password/change", { new_password: newPassword });
  } catch (e) {
    return {
      error:
        e instanceof ApiError && e.message
          ? e.message
          : "Could not update your password. Please try again.",
    };
  }
  // Invalidate everything under the root layout so the now-cleared flag is read
  // fresh on the next render and the forced-redirect gate lets the user through.
  revalidatePath("/", "layout");
  return null;
}
