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
 * LOCAL TYPES — replace with the generated ones once the backend lands on dev.
 *
 * `api.gen.ts` is generated from the API's OpenAPI schema and must never be
 * hand-edited, and these routes do not exist in the deployed schema yet. Once
 * fa-web-api's alert-template branch is merged to dev, regenerate the types and
 * swap the three aliases below for
 * `components["schemas"]["AlertTemplatePlaceholder"]`,
 * `components["schemas"]["AlertTemplate"]` and
 * `components["schemas"]["AlertTemplatePage"]`.
 *
 * Everything downstream — the actions here, ./alert-templates and the card —
 * reads these three names and nothing else, so the swap is those three lines
 * and no other edit.
 */
export type AlertTemplatePlaceholder = {
  /** The token as it is written in a message, without the braces. */
  name: string;
  /** What the backend substitutes for it, in words. */
  description: string;
};

export type AlertTemplate = {
  /** Stable identifier for the message, e.g. "outage" — never shown as a label. */
  kind: string;
  /** Human name for the message. */
  label: string;
  /** One line on when this message fires. */
  description: string;
  /** The wording in force right now. */
  value: string;
  /** The wording shipped with the app, which "reset" restores. */
  default_value: string;
  /** What this kind may substitute. Anything else renders literally. */
  placeholders: AlertTemplatePlaceholder[];
};

export type AlertTemplatePage = { items: AlertTemplate[] };

/**
 * Every editable Slack message with its current wording, its default and the
 * placeholders it accepts. Engineer-only (GET /admin/alert-templates).
 *
 * Unlike the other reads on this page this one is NOT done in the server
 * component: the card that uses it holds unsaved drafts, so it owns its own
 * loading and reloading rather than being re-rendered underneath them by a
 * route revalidation. That is also why the error comes back as a message
 * instead of throwing — a card that cannot load must not be able to take the
 * maintenance switch off the screen.
 */
export async function getAlertTemplates(): Promise<
  { ok: true; page: AlertTemplatePage } | { ok: false; error: string }
> {
  try {
    return { ok: true, page: await apiGet<AlertTemplatePage>("/admin/alert-templates") };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof ApiError && e.status === 403
          ? "Editing alert messages is restricted to engineers."
          : e instanceof ApiError
            ? e.message
            : "Couldn't load the alert messages.",
    };
  }
}

/**
 * Store new wording for one message (PUT /admin/alert-templates/{kind}),
 * engineer-only.
 *
 * The backend re-validates the template it is handed — the card's own check on
 * empty text and unknown placeholders is there to save a round trip, and is not
 * what keeps a broken message out of the channel. A 422 therefore has to be
 * readable rather than fatal, which is why this returns the message instead of
 * throwing: the engineer still has their draft in the box and can fix it.
 *
 * Returns the stored template so the card can re-baseline its dirty check
 * against what the backend actually kept, rather than against what was sent.
 */
export async function saveAlertTemplate(
  kind: string,
  value: string,
): Promise<{ ok: true; template: AlertTemplate } | { ok: false; error: string }> {
  try {
    const template = await apiPut<AlertTemplate>(
      `/admin/alert-templates/${encodeURIComponent(kind)}`,
      { value },
    );
    return { ok: true, template };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof ApiError && e.status === 404
          ? "That message no longer exists — reload the page."
          : e instanceof ApiError && e.status === 429
            ? "Too many changes at once. Wait a moment and save again."
            : e instanceof ApiError
              ? e.message
              : "Couldn't save that message.",
    };
  }
}

/**
 * Put one message back to the wording shipped with the app
 * (POST /admin/alert-templates/{kind}/reset), engineer-only.
 *
 * A separate endpoint rather than a save of the default text the client happens
 * to be holding: the default is the backend's to know, and a stale tab must not
 * be able to "reset" a message to a default that has since changed.
 */
export async function resetAlertTemplate(
  kind: string,
): Promise<{ ok: true; template: AlertTemplate } | { ok: false; error: string }> {
  try {
    const template = await apiPost<AlertTemplate>(
      `/admin/alert-templates/${encodeURIComponent(kind)}/reset`,
      undefined,
    );
    return { ok: true, template };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof ApiError && e.status === 404
          ? "That message no longer exists — reload the page."
          : e instanceof ApiError
            ? e.message
            : "Couldn't reset that message.",
    };
  }
}

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
