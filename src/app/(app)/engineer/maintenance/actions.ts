"use server";

import { revalidatePath } from "next/cache";
import { apiDelete, apiGet, apiPost, apiPut, ApiError } from "@/lib/api";
import type { components } from "@/types/api.gen";
import {
  ATTACK_WINDOW_HOURS,
  type LoginAttackSourcePage,
} from "./attack-sources";
import { BLOCK_LIST_LIMIT, type LoginIpBlockPage } from "./blocks";

/** Acknowledgement that a block was lifted, echoing what stopped applying. */
type LoginIpBlockLifted = components["schemas"]["LoginIpBlockLifted"];

/** What a test alert actually did, per channel. */
export type AlertTestResult = components["schemas"]["AlertTestResult"];

/** Which alert channel to check. */
export type AlertPurpose = "operational" | "security";

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
 * Sources currently refused by the automatic block, for the table under the
 * attack summary. Engineer-only — the backend re-enforces RequireEngineer on
 * GET /admin/login-ip-blocks. Callers catch ApiError.
 *
 * `activeOnly=false` includes lifted and lapsed blocks, which is what makes
 * "did this ever fire on us?" answerable. Never cached, for the same reason the
 * rest of this page is `force-dynamic`.
 */
export async function getLoginIpBlocks(
  activeOnly = false,
  limit: number = BLOCK_LIST_LIMIT,
): Promise<LoginIpBlockPage> {
  return apiGet<LoginIpBlockPage>(
    `/admin/login-ip-blocks?active_only=${activeOnly}&limit=${limit}`,
  );
}

/**
 * Lift one automatic block early — the manual override on a control that can
 * refuse people. Engineer-only (DELETE /admin/login-ip-blocks/{id}).
 *
 * The backend does not re-block a lifted source for 24 hours, so this is a real
 * decision and not a pause: without that grace the next failed sign-in from the
 * same address would re-open the block and the button would be decorative.
 *
 * Returns the error message rather than throwing, so a 404 (someone else lifted
 * it, or it lapsed while the page sat open) is reported in a toast instead of
 * blanking the console.
 */
export async function liftLoginIpBlock(
  blockId: number,
): Promise<{ ok: true; ipAddress: string } | { ok: false; error: string }> {
  try {
    const result = await apiDelete<LoginIpBlockLifted>(
      `/admin/login-ip-blocks/${blockId}`,
    );
    revalidatePath("/engineer/maintenance");
    return { ok: true, ipAddress: result.ip_address };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof ApiError && e.status === 404
          ? "That block is no longer active — it was lifted or it expired."
          : e instanceof ApiError
            ? e.message
            : "Couldn't lift that block.",
    };
  }
}

/**
 * Send one clearly-marked TEST alert to a channel, to prove it is reachable.
 * Engineer-only (POST /admin/alerts/test), rate limited to six an hour.
 *
 * WHY A BUTTON EXISTS FOR THIS. Before it, "is alerting wired up?" could only be
 * answered by breaking something: an outage alert needs three sustained
 * failures, so proving the error channel meant deliberately failing production
 * for a minute. On 2026-08-19 a real security alert went to the error channel
 * because no security webhook was set -- the documented fallback doing its job,
 * and completely invisible from inside Slack.
 *
 * Returns the per-channel result rather than a boolean, because "nothing
 * arrived" has two very different causes and the console has to be able to say
 * which. Errors come back as a message rather than throwing, so a rate-limit
 * refusal is a toast and not a blank page.
 */
export async function sendTestAlert(
  purpose: AlertPurpose,
): Promise<{ ok: true; result: AlertTestResult } | { ok: false; error: string }> {
  try {
    const result = await apiPost<AlertTestResult>(
      `/admin/alerts/test?purpose=${purpose}`,
      undefined,
    );
    return { ok: true, result };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof ApiError && e.status === 429
          ? "Too many test alerts. Six an hour is the limit — try again later."
          : e instanceof ApiError
            ? e.message
            : "Couldn't send the test alert.",
    };
  }
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

/**
 * LOCAL TYPES — replace with the generated ones once the backend lands on dev.
 *
 * `api.gen.ts` is generated from the API's OpenAPI schema and must never be
 * hand-edited (CI has a drift guard), and these routes do not exist in the
 * deployed schema yet. After fa-web-api's `feat/alert-delivery-toggle` is merged
 * to dev, regenerate and swap `AlertDeliveryState` for
 * `components["schemas"]["AlertDeliveryState"]` — the mode union is
 * `components["schemas"]["AlertDeliveryState"]["mode"]`, and the request body is
 * `components["schemas"]["AlertDeliveryUpdate"]`. Same convention this file's
 * neighbours used before their backends shipped (see ../sessions/actions.ts).
 */
export type AlertDeliveryMode = "slack_only" | "slack_and_email";

export type AlertDeliveryState = {
  mode: AlertDeliveryMode;
  updated_at: string | null;
  updated_by_email: string | null;
  /**
   * Whether each channel has anywhere to send AT ALL. Not decoration: the card
   * promises that e-mail still fires when Slack does not land, and that promise
   * is FALSE if no alert mailbox is configured. Booleans only — the backend
   * never returns the webhook URL (a credential) or the recipients.
   */
  slack_configured: boolean;
  email_configured: boolean;
};

/**
 * Read where alerts currently go. Engineer-only on the backend
 * (`GET /admin/alert-delivery`); callers catch ApiError, the same shape as
 * `getMaintenanceState` above.
 *
 * Never cached, like everything else on this page: an engineer reading this
 * during an incident must see the value that is actually in force.
 */
export async function getAlertDeliveryState(): Promise<AlertDeliveryState> {
  return apiGet<AlertDeliveryState>("/admin/alert-delivery");
}

/**
 * Choose whether alerts go to Slack only, or to Slack AND e-mail.
 * Engineer-only (`PUT /admin/alert-delivery`).
 *
 * ⚠️ NEITHER SETTING CAN PRODUCE SILENCE, and the card says so in words. In
 * "Slack only" the e-mail is not switched off — it becomes the BACKSTOP, sent
 * whenever the Slack post does not land (a revoked webhook, a Slack outage, an
 * unconfigured channel). The backend enforces that: the only branch that skips
 * the mail is the one reached when Slack actually accepted the message.
 *
 * Returns the error rather than throwing, so a 403 or a blip is a toast instead
 * of a blanked console — the same contract as `liftLoginIpBlock` and
 * `sendTestAlert` above.
 */
export async function setAlertDeliveryMode(
  mode: AlertDeliveryMode,
): Promise<
  { ok: true; state: AlertDeliveryState } | { ok: false; error: string }
> {
  try {
    const state = await apiPut<AlertDeliveryState>("/admin/alert-delivery", {
      mode,
    });
    revalidatePath("/engineer/maintenance");
    return { ok: true, state };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof ApiError
          ? e.message
          : "Couldn't change where alerts are delivered.",
    };
  }
}
