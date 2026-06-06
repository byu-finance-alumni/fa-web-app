"use server";

import { revalidatePath } from "next/cache";
import { apiPost, apiDelete, ApiError } from "@/lib/api";

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
