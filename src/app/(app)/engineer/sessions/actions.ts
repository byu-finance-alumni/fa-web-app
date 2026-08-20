"use server";

import { revalidatePath } from "next/cache";
import { apiDelete, ApiError } from "@/lib/api";
import type { components } from "@/types/api.gen";

/**
 * The revoke response, taken from the generated schema so the CI drift guard
 * covers this contract. (The listing types are `ActiveSessionRow` /
 * `ActiveSessionPage`, used in ./page.tsx.)
 */
type SessionRevokeResult = components["schemas"]["SessionRevokeResult"];

export type RevokeResult =
  | { ok: true; result: SessionRevokeResult }
  | { ok: false; error: string };

function failed(e: unknown, fallback: string): RevokeResult {
  return { ok: false, error: e instanceof ApiError ? e.message : fallback };
}

/**
 * End ONE live session. Engineer-only — the backend
 * (DELETE /admin/sessions/{id}, RequireEngineer) re-enforces access.
 *
 * `confirmSelf` maps to the backend's `confirm_self` query flag, which it
 * REQUIRES before it will end the session the caller is signed in with. The
 * flag is never set implicitly: it is passed only from the branch of the
 * confirm dialog that made the user type the confirmation word, so "sign myself
 * out" can never happen as a side effect of clicking a row.
 *
 * Revalidates the page so a revoked row disappears; the caller also calls
 * `router.refresh()` (a bare `startTransition` does not re-render the current
 * server component — see PR #138).
 */
export async function revokeSession(
  sessionId: string,
  confirmSelf = false,
): Promise<RevokeResult> {
  try {
    const result = await apiDelete<SessionRevokeResult>(
      `/admin/sessions/${encodeURIComponent(sessionId)}${
        confirmSelf ? "?confirm_self=true" : ""
      }`,
    );
    revalidatePath("/engineer/sessions");
    return { ok: true, result };
  } catch (e) {
    return failed(e, "Couldn't revoke that session.");
  }
}

/**
 * End EVERY live session for one user — the "sign this person out everywhere"
 * action. Same gate, same `confirm_self` contract as above (the backend refuses
 * it without the flag when the target is the caller's own account, because that
 * necessarily includes the session they are using).
 */
export async function revokeUserSessions(
  userId: number,
  confirmSelf = false,
): Promise<RevokeResult> {
  try {
    const result = await apiDelete<SessionRevokeResult>(
      `/admin/users/${userId}/sessions${confirmSelf ? "?confirm_self=true" : ""}`,
    );
    revalidatePath("/engineer/sessions");
    return { ok: true, result };
  } catch (e) {
    return failed(e, "Couldn't revoke those sessions.");
  }
}
