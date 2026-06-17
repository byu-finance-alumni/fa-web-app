"use server";

import { revalidatePath } from "next/cache";
import { apiPost, apiPatch, apiDelete, ApiError } from "@/lib/api";
import type { CreatableRoleId } from "@/constants/roles";

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
 * Super-admin / engineer only: PERMANENTLY delete a user — both the `users` row
 * and the Supabase auth identity. This is the irreversible counterpart to
 * `setUserActive(false)` (which only suspends). The backend preserves the FERPA
 * audit trail (foreign keys SET NULL) and refuses to delete your own account,
 * an engineer you don't outrank, or the last holder of a top role — those
 * surface here as the returned `error` string rather than thrown. Revalidates
 * `/admin` so the removed row disappears on the next render.
 */
export async function deleteUser(userId: number): Promise<Result> {
  try {
    await apiDelete(`/admin/users/${userId}`);
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : "Failed to delete user." };
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

/** The shape returned by the create-user endpoint (super_admin only). */
export interface CreatedUser {
  user_id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  active: boolean;
  roles: string[];
  /** One-time temporary password — shown to the admin exactly once. */
  temp_password: string;
}

/**
 * Super-admin only: provision a brand-new user. The backend creates the account,
 * assigns the requested role (defaulting to view_only), and returns a one-time
 * temporary password the admin hands to the user once — it is never persisted
 * client-side and won't be shown again. The whole Admin screen is super_admin-
 * gated and the backend re-enforces it, so this mirrors that contract.
 *
 * A duplicate email surfaces as a 409 ApiError, returned here as an `error`
 * string rather than thrown. On success we revalidate `/admin` so the new row
 * appears on the next render.
 */
export async function createUser(input: {
  email: string;
  first_name?: string;
  last_name?: string;
  role_name?: CreatableRoleId;
}): Promise<CreatedUser | { error: string }> {
  try {
    const created = await apiPost<CreatedUser>("/admin/users", {
      email: input.email,
      ...(input.first_name ? { first_name: input.first_name } : {}),
      ...(input.last_name ? { last_name: input.last_name } : {}),
      ...(input.role_name ? { role_name: input.role_name } : {}),
    });
    revalidatePath("/admin");
    return created;
  } catch (e) {
    return {
      error: e instanceof ApiError ? e.message : "Failed to create user.",
    };
  }
}

/**
 * Super-admin only: edit a user's first/last name. Hits the `/name` sub-path
 * (the bare `PATCH /admin/users/{id}` route is the active-toggle, not this).
 * The backend re-enforces super_admin. Revalidates `/admin` so the row's
 * display name updates on the next render.
 */
export async function updateUserName(
  userId: number,
  firstName: string,
  lastName: string,
): Promise<Result> {
  try {
    await apiPatch(`/admin/users/${userId}/name`, {
      first_name: firstName,
      last_name: lastName,
    });
  } catch (e) {
    return {
      error: e instanceof ApiError ? e.message : "Failed to update name.",
    };
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
