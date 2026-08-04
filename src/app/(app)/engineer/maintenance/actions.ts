"use server";

import { revalidatePath } from "next/cache";
import { apiGet, apiPost, ApiError } from "@/lib/api";

/**
 * Engineer maintenance-mode controls.
 *
 * NOTE ON TYPES: these shapes are hand-declared because the backend endpoints
 * are new and `src/types/api.gen.ts` is GENERATED from the deployed API's
 * OpenAPI schema — it cannot contain them until the backend ships to dev and the
 * types are regenerated (`npm run gen:api-types`). Once that lands, replace
 * these with `components["schemas"]["MaintenanceState"]` etc. and delete the
 * local declarations. They are kept minimal and match the backend schemas in
 * `app/schemas/maintenance.py` exactly.
 */

/** Engineer-console view of the switch. */
export type MaintenanceState = {
  enabled: boolean;
  message: string | null;
  enabled_at: string | null;
  enabled_by_email: string | null;
};

/** State after enabling, plus how many sessions the switch ended. */
export type MaintenanceEnableResult = MaintenanceState & {
  sessions_ended: number;
};

/**
 * Read the current state. Engineer-only on the backend (`GET /maintenance`);
 * callers catch ApiError. This is NOT the public `/maintenance/status`
 * endpoint — this one carries who turned it on and when, which is why it is
 * gated.
 */
export async function getMaintenanceState(): Promise<MaintenanceState> {
  return apiGet<MaintenanceState>("/maintenance");
}

/**
 * Turn maintenance mode ON: pause logins and end every signed-in non-engineer
 * session. Engineer-only — the backend re-enforces RequireEngineer on
 * `POST /maintenance/enable`; this action only drives the request and hands back
 * the real result so the UI reports what actually happened rather than assuming.
 *
 * The caller's own session survives (engineers are exempt from the force-logout
 * by design), which is what keeps `disableMaintenance` reachable immediately
 * afterwards.
 */
export async function enableMaintenance(
  message?: string,
): Promise<{ result: MaintenanceEnableResult } | { error: string }> {
  let result: MaintenanceEnableResult;
  try {
    result = await apiPost<MaintenanceEnableResult>("/maintenance/enable", {
      message: message?.trim() ? message.trim() : null,
    });
  } catch (e) {
    return {
      error:
        e instanceof ApiError
          ? e.message
          : "Failed to turn maintenance mode on.",
    };
  }
  revalidatePath("/engineer/maintenance");
  return { result };
}

/**
 * Turn maintenance mode OFF and restore normal logins.
 *
 * This is the recovery path, so it must work while maintenance is ON — it does,
 * because the backend exempts engineers from the pause it enforces on every
 * other authenticated request.
 */
export async function disableMaintenance(): Promise<
  { result: MaintenanceState } | { error: string }
> {
  let result: MaintenanceState;
  try {
    result = await apiPost<MaintenanceState>("/maintenance/disable", undefined);
  } catch (e) {
    return {
      error:
        e instanceof ApiError
          ? e.message
          : "Failed to turn maintenance mode off.",
    };
  }
  revalidatePath("/engineer/maintenance");
  revalidatePath("/", "layout");
  return { result };
}
