"use server";

import { revalidatePath } from "next/cache";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import type { components } from "@/types/api.gen";
import {
  ATTACK_WINDOW_HOURS,
  type LoginAttackSourcePage,
} from "./attack-sources";

/**
 * Engineer maintenance-mode controls.
 */

/** Engineer-console view of the switch. */
export type MaintenanceState = components["schemas"]["MaintenanceState"];

/** State after enabling, plus how many sessions the switch ended. */
export type MaintenanceEnableResult =
  components["schemas"]["MaintenanceEnableResult"];

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
 * Failed sign-ins rolled up per source IP over the last `hours`, for the attack
 * table beside the switch. Engineer-only — the backend re-enforces
 * RequireEngineer on GET /admin/login-attack-sources. Callers catch ApiError.
 *
 * Never cached: an engineer looking at this during an incident must be seeing
 * the current state, the same reason this page is `force-dynamic`.
 *
 * The response carries COUNTS of attempted addresses and never the addresses
 * themselves — see the type in ./attack-sources.
 */
export async function getLoginAttackSources(
  hours: number = ATTACK_WINDOW_HOURS,
): Promise<LoginAttackSourcePage> {
  return apiGet<LoginAttackSourcePage>(
    `/admin/login-attack-sources?hours=${hours}`,
  );
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
