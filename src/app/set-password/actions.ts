"use server";

import { revalidatePath } from "next/cache";
import { apiPost, ApiError } from "@/lib/api";

/**
 * Clear the current user's must-change-password flag. Call this AFTER the user
 * has successfully set a new password via `supabase.auth.updateUser` in the
 * browser — the backend `POST /auth/password/complete` is authenticated and
 * acts on the caller's own account, so no body is needed.
 *
 * On success we revalidate the root layout so the app shell re-fetches
 * `/auth/context` and no longer bounces the user back to `/set-password`.
 * Returns `null` on success or `{ error }` so the form can surface it.
 */
export async function completePasswordChange(): Promise<{ error: string } | null> {
  try {
    await apiPost("/auth/password/complete", {});
  } catch (e) {
    return {
      error:
        e instanceof ApiError
          ? e.message
          : "Could not finish updating your account. Please try again.",
    };
  }
  // Invalidate everything under the root layout so the now-cleared flag is read
  // fresh on the next render and the forced-redirect gate lets the user through.
  revalidatePath("/", "layout");
  return null;
}
