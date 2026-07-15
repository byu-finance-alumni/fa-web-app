import { notFound, redirect } from "next/navigation";
import { apiGet, ApiError } from "@/lib/api";
import type { Profile } from "@/types/profile";
import type { UserContext } from "@/types/alumni";
import { canEditAlumni } from "@/constants/roles";

/**
 * Guard + fetch shared by the edit section picker and every focused sub-form.
 *
 * Mirrors the original full-form edit page: editing requires edit access
 * (engineer / super_admin / full_access / student). view_only ("Professor")
 * users are redirected to the read-only profile rather than shown a form the
 * backend (PATCH /alumni/{id}) would 403 on. The role flag is resolved inside a
 * try/catch, then `redirect()` runs OUTSIDE it — redirect works by throwing a
 * control-flow signal a catch would otherwise swallow. The backend stays the
 * source of truth; this is UX only.
 */
export async function loadEditableProfile(id: string): Promise<Profile> {
  let canEdit = false;
  try {
    const ctx = await apiGet<UserContext>("/auth/context");
    canEdit = canEditAlumni(ctx.roles);
  } catch {
    /* not provisioned / context error → treat as no edit access */
  }
  if (!canEdit) redirect(`/alumni/${id}`);

  try {
    return await apiGet<Profile>(`/alumni/${id}/profile`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
}

/** Stringify a nullable scalar for a text/number input default ("" when null). */
export function s(v: string | number | null | undefined): string {
  return v === null || v === undefined ? "" : String(v);
}
