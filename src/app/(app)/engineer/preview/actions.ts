"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { apiPost, ApiError } from "@/lib/api";
import { asPreviewRole, PREVIEW_COOKIE } from "@/lib/preview";

type Result = { error?: string } | null;

/**
 * Enter preview-as-role (#165). Sets the preview cookie so the app shell renders
 * navigation as `role`, and records the entry in the audit trail
 * (POST /engineer/preview-log, engineer-gated). Read-only: the previewed role is
 * strictly less privileged than the engineer, so nothing is exposed that the
 * engineer couldn't already see.
 */
export async function enterPreview(role: string): Promise<Result> {
  if (!asPreviewRole(role)) return { error: "Invalid role to preview." };
  // Audit the entry first; if the engineer gate rejects, don't set the cookie.
  try {
    await apiPost("/engineer/preview-log", { role });
  } catch (e) {
    return {
      error: e instanceof ApiError ? e.message : "Couldn't start preview.",
    };
  }
  const store = await cookies();
  store.set(PREVIEW_COOKIE, role, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  revalidatePath("/", "layout");
  return null;
}

/** Exit preview mode — clears the cookie and restores the engineer's own view. */
export async function exitPreview(): Promise<void> {
  const store = await cookies();
  store.delete(PREVIEW_COOKIE);
  revalidatePath("/", "layout");
}
