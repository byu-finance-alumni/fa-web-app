"use server";

import { revalidatePath } from "next/cache";
import { apiPost, apiPatch, apiDelete, ApiError } from "@/lib/api";

type Result = { error?: string } | null;

export async function assignRole(
  userId: number,
  roleName: string,
): Promise<Result> {
  try {
    await apiPost(`/admin/users/${userId}/roles`, { role_name: roleName });
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : "Failed to assign role." };
  }
  revalidatePath("/admin");
  return null;
}

export async function removeRole(
  userId: number,
  roleName: string,
): Promise<Result> {
  try {
    await apiDelete(`/admin/users/${userId}/roles/${roleName}`);
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : "Failed to remove role." };
  }
  revalidatePath("/admin");
  return null;
}

/**
 * Super-admin only: unlock a user and reset their password. The backend clears
 * any active lockout and issues a fresh temporary password, returned here so the
 * admin can hand it to the user once. The whole Admin screen is super_admin-
 * gated and the backend re-enforces it, so this mirrors that contract.
 *
 * On success we revalidate `/admin` so the "Locked" badge clears on the next
 * render. Returns the `tempPassword` on success or an `error` string.
 */
export async function resetUserPassword(
  userId: number,
): Promise<{ tempPassword: string } | { error: string }> {
  try {
    const { temp_password } = await apiPost<{ temp_password: string }>(
      `/admin/users/${userId}/reset-password`,
      {},
    );
    revalidatePath("/admin");
    return { tempPassword: temp_password };
  } catch (e) {
    return {
      error:
        e instanceof ApiError ? e.message : "Failed to reset password.",
    };
  }
}

/**
 * Deactivate or reactivate a user. The backend (super_admin only) flips
 * `users.active`; a deactivated user is then blocked on every authenticated
 * route. The backend also rejects self-deactivation, so a conflict surfaces as
 * the returned error rather than a thrown exception.
 */
export async function setUserActive(
  userId: number,
  active: boolean,
): Promise<Result> {
  try {
    await apiPatch(`/admin/users/${userId}`, { active });
  } catch (e) {
    return {
      error:
        e instanceof ApiError
          ? e.message
          : active
            ? "Failed to reactivate user."
            : "Failed to deactivate user.",
    };
  }
  revalidatePath("/admin");
  return null;
}
