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
