"use server";

import { revalidatePath } from "next/cache";
import { apiDelete, apiGet, ApiError } from "@/lib/api";
import type { operations } from "@/types/api.gen";
import type { LoginCampaignDeleted } from "./campaign-delete";

/**
 * Response shape of GET /admin/login-failures, taken straight from the generated
 * OpenAPI operation (never hand-written) so it stays in lockstep with the
 * backend contract. Equals components["schemas"]["LoginFailurePage"].
 */
export type LoginFailurePage =
  operations["list_login_failures_admin_login_failures_get"]["responses"][200]["content"]["application/json"];

/** One recorded failed sign-in row (LoginFailureRow), pulled from the page type. */
export type LoginFailureRow = LoginFailurePage["items"][number];

/**
 * Fetch a page of failed-login attempts (newest first). Engineer-only — the
 * backend re-enforces RequireEngineer on GET /admin/login-failures. Mirrors the
 * typed `apiGet` fetch the Logins tab does inline; callers catch ApiError.
 */
export async function getLoginFailures(
  limit: number,
  offset: number,
): Promise<LoginFailurePage> {
  return apiGet<LoginFailurePage>(
    `/admin/login-failures?limit=${limit}&offset=${offset}`,
  );
}

export type DeleteCampaignResult =
  | { ok: true; result: LoginCampaignDeleted }
  | { ok: false; error: string };

/**
 * Delete one CAMPAIGN — every failed sign-in recorded for a source IP, the
 * abuse incident opened for it, and any block on it. Engineer-only; the backend
 * re-enforces the gate on DELETE /admin/login-campaigns/{ip_address} and audits
 * the call into the append-only engineer action log whether or not it matched
 * anything.
 *
 * ⚠️ Deleting the block row UN-BLOCKS that source, and drops the 24-hour
 * re-block grace that the Maintenance page's Lift control would have left in
 * place. The confirm dialog says both before this is ever called — see
 * ./campaign-delete.
 *
 * RETURNS THE ERROR RATHER THAN THROWING, so a 429 (this is rate limited — ten
 * per ten minutes, because it is destructive and there is no undo) is a toast
 * and not a blank page. Same shape as `revokeSession` on the Sessions screen.
 *
 * The backend answers 200 with zeros for an address that matched nothing rather
 * than 404, so there is no "already gone" branch to handle here: the caller
 * reports the real counts, which is how an engineer learns they aimed at the
 * wrong address.
 */
export async function deleteLoginCampaign(
  ipAddress: string,
): Promise<DeleteCampaignResult> {
  try {
    const result = await apiDelete<LoginCampaignDeleted>(
      `/admin/login-campaigns/${encodeURIComponent(ipAddress)}`,
    );
    revalidatePath("/engineer/login-failures");
    // The blocks and attack tables on Maintenance read the same rows.
    revalidatePath("/engineer/maintenance");
    return { ok: true, result };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof ApiError && e.status === 429
          ? "Too many deletions. Ten per ten minutes is the limit — try again shortly."
          : e instanceof ApiError
            ? e.message
            : "Couldn't delete that campaign.",
    };
  }
}
