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
 * The alert-template contract, taken from the generated schema so the CI drift
 * guard covers it.
 *
 * ⚠️ THE UI'S FIELD NAMES ARE NOT THE API'S, AND THAT IS DELIBERATE. The card
 * was built against a guessed contract while the backend was still being
 * written — `kind`/`value`/`default_value` against the API's
 * `key`/`body`/`default_body` — and both sides typechecked because both were
 * local types. `toTemplate` below is the one place the two vocabularies meet.
 *
 * It is a mapping rather than a rename through the card because `.value` inside
 * a textarea handler is `event.target.value`, and because one typed conversion
 * site means a future backend rename fails the typecheck HERE, loudly, instead
 * of quietly reintroducing a 422 nobody sees until they press Save.
 */
type ApiAlertTemplateRow = components["schemas"]["AlertTemplateRow"];

export type AlertTemplatePlaceholder = {
  /** The token as it is written in a message, without the braces. */
  name: string;
  /** What the backend substitutes for it, in words. */
  description: string;
  /** A realistic value, used by the preview. */
  example: string;
};

export type AlertTemplate = {
  /** Stable identifier for the message — never shown as a label. */
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
  /**
   * The backend's own length cap. Carried through so the card's pre-flight
   * check is the SAME number the database CHECK enforces — they were 2000 and
   * 500, so a long template passed client validation and came back a 422.
   */
  maxChars: number;
  /** Whether the stored wording differs from the default. */
  customized: boolean;
};

export type AlertTemplatePage = { items: AlertTemplate[] };

function toTemplate(row: ApiAlertTemplateRow): AlertTemplate {
  return {
    kind: row.key,
    label: row.label,
    description: row.description,
    value: row.body,
    default_value: row.default_body,
    placeholders: row.placeholders,
    maxChars: row.max_chars,
    customized: row.customized,
  };
}

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
    const page = await apiGet<components["schemas"]["AlertTemplateList"]>(
      "/admin/alert-templates",
    );
    return { ok: true, page: { items: page.items.map(toTemplate) } };
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
 * Store new wording for one message (PUT /admin/alert-templates/{key}),
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
    const row = await apiPut<ApiAlertTemplateRow>(
      `/admin/alert-templates/${encodeURIComponent(kind)}`,
      { body: value },
    );
    return { ok: true, template: toTemplate(row) };
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
 * (DELETE /admin/alert-templates/{key}), engineer-only.
 *
 * A separate endpoint rather than a save of the default text the client happens
 * to be holding: the default is the backend's to know, and a stale tab must not
 * be able to "reset" a message to a default that has since changed.
 */
export async function resetAlertTemplate(
  kind: string,
): Promise<{ ok: true; template: AlertTemplate } | { ok: false; error: string }> {
  try {
    // DELETE, not POST /reset: the backend models "reset" as removing the
    // override row, which is what makes the built-in sentence the fallback
    // again rather than a second copy of it.
    const row = await apiDelete<ApiAlertTemplateRow>(
      `/admin/alert-templates/${encodeURIComponent(kind)}`,
    );
    return { ok: true, template: toTemplate(row) };
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
 * summary on /engineer/login-failures. (It used to render beside the
 * maintenance switch; the reader who wants it is the one already looking at the
 * attempts.) Engineer-only — the backend re-enforces RequireEngineer on
 * GET /admin/login-attack-sources. Callers catch ApiError.
 *
 * Never cached: an engineer looking at this during an incident must be seeing
 * the current state, the same reason the pages that render it are dynamic.
 *
 * The response carries COUNTS of attempted addresses and never the addresses
 * themselves — see the type in ./attack-sources.
 */
export async function getLoginAttackSources(
  hours: number | null = ATTACK_WINDOW_HOURS,
): Promise<LoginAttackSourcePage> {
  // `hours` is OMITTED, not sent as a value, when the caller wants everything:
  // the backend treats an absent parameter as all history. Sending `hours=null`
  // would be a 422.
  return apiGet<LoginAttackSourcePage>(
    hours === null
      ? "/admin/login-attack-sources"
      : `/admin/login-attack-sources?hours=${hours}`,
  );
}

/**
 * Sources currently refused by the automatic block, for the table under the
 * attack summary on /engineer/login-failures. Engineer-only — the backend
 * re-enforces RequireEngineer on GET /admin/login-ip-blocks. Callers catch
 * ApiError.
 *
 * `activeOnly=false` includes lifted and lapsed blocks, which is what makes
 * "did this ever fire on us?" answerable. Never cached, for the same reason the
 * page that renders it is dynamic.
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
    // The route the block table now renders on. It said /engineer/maintenance
    // while the table lived there; left unchanged it would revalidate a page
    // that no longer shows blocks and leave the lifted row on screen.
    revalidatePath("/engineer/login-failures");
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
 * Where an alert goes, taken from the generated schema so the CI drift guard
 * covers this contract.
 *
 * ``slack_configured`` / ``email_configured`` are not decoration: the card
 * promises that e-mail still fires when Slack does not land, and that promise is
 * FALSE if no alert mailbox is configured. Booleans only — the backend never
 * returns the webhook URL (a credential) or the recipients.
 */
export type AlertDeliveryState = components["schemas"]["AlertDeliveryState"];
export type AlertDeliveryMode = AlertDeliveryState["mode"];

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
