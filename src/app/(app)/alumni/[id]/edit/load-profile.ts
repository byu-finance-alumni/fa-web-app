import { notFound, redirect } from "next/navigation";
import { apiGet, ApiError } from "@/lib/api";
import { readAuthContext } from "@/lib/auth-context";
import type { Profile } from "@/types/profile";
import { canEditAlumni } from "@/constants/roles";

/**
 * The outcome of the guard below. `unavailable` exists so the seven edit
 * screens can render an error where the user is standing instead of being
 * moved somewhere else — see {@link loadEditableProfile}.
 */
export type EditableProfileResult =
  | { status: "ok"; profile: Profile }
  /** `/auth/context` could not be READ (5xx, timeout, unreachable). */
  | { status: "unavailable"; httpStatus: number | null };

/**
 * Guard + fetch shared by the edit section picker and every focused sub-form.
 *
 * Mirrors the original full-form edit page: editing requires edit access
 * (engineer / super_admin / full_access / student). view_only ("Professor")
 * users are redirected to the read-only profile rather than shown a form the
 * backend (PATCH /alumni/{id}) would 403 on. `redirect()` runs outside any
 * branch that could swallow it — it works by throwing a control-flow signal.
 * The backend stays the source of truth; this is UX only.
 *
 * THE SPLIT (#688). `canEdit` starts false and is raised ONLY inside the
 * verified-success branch, so an account is never let into a form we could not
 * confirm it may use. But "we could not confirm" is not the same as "the answer
 * is no", and the old single `catch` treated them identically: during the
 * 2026-08-18 outage a full-access user pressing Edit was silently thrown back
 * to the read-only profile, which reads as "my edit permission was revoked"
 * rather than "the API is down". A 401/403 still redirects — that is the
 * backend's answer. Anything else comes back as `unavailable` for the caller to
 * render in place, on the URL the user actually asked for.
 *
 * The PROFILE read below is left to throw. That reaches the `(app)` error
 * boundary, which already renders a recoverable error inside the shell without
 * moving the user, so there is nothing to fix there.
 */
export async function loadEditableProfile(
  id: string,
): Promise<EditableProfileResult> {
  let canEdit = false;
  const auth = await readAuthContext();
  if (auth.status === "ok") {
    canEdit = canEditAlumni(auth.ctx.roles);
  }
  if (auth.status === "unavailable") {
    return { status: "unavailable", httpStatus: auth.httpStatus };
  }
  if (!canEdit) redirect(`/alumni/${id}`);

  try {
    return { status: "ok", profile: await apiGet<Profile>(`/alumni/${id}/profile`) };
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
}

/** Stringify a nullable scalar for a text/number input default ("" when null). */
export function s(v: string | number | null | undefined): string {
  return v === null || v === undefined ? "" : String(v);
}
