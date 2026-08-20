/**
 * The words the alert-delivery card uses.
 *
 * Same split as ./campaign-remove-mode and ../../app/(app)/engineer/maintenance/blocks:
 * everything here is pure and takes plain data, so the assertions that matter
 * are cheap to write and impossible to write against a rendered client
 * component in this node-only suite.
 *
 * ⚠️ AND THE WORDS ARE THE FEATURE. "Slack only" is exactly the phrase somebody
 * reads as "and if Slack breaks we hear nothing" — the opposite of what it does.
 * The e-mail is not switched off by that setting; it becomes the BACKSTOP, and
 * it still fires whenever the Slack post fails or the channel is not configured.
 * The one case where that promise stops being true is a deployment with no alert
 * mailbox at all, and :func:`deliveryGaps` is what makes the card say so instead
 * of repeating a reassurance that has gone stale.
 */

import type { AlertDeliveryMode } from "@/app/(app)/engineer/maintenance/actions";

/** One selectable mode, with the sentence that says what it actually does. */
export type AlertDeliveryOption = {
  value: AlertDeliveryMode;
  label: string;
  detail: string;
};

/**
 * The two modes, in the order the card offers them: the default first.
 *
 * Each `detail` describes the HEALTHY case only — what happens when Slack is
 * working — because that is the only case in which the two differ. What happens
 * when Slack does not work is identical for both and is stated once, below the
 * options, by `BACKSTOP_NOTE`. Splitting it that way is deliberate: repeating
 * "…and e-mail if Slack fails" inside each option would make the difference
 * between them harder to see, not easier.
 */
export const ALERT_DELIVERY_OPTIONS: readonly AlertDeliveryOption[] = [
  {
    value: "slack_only",
    label: "Slack only",
    detail:
      "One message, in Slack. Nothing is e-mailed while Slack is working.",
  },
  {
    value: "slack_and_email",
    label: "Slack and e-mail",
    detail:
      "Every alert goes to Slack and to the alert mailbox, both times.",
  },
];

/**
 * What the engineer is told after the setting takes effect. Says what will
 * happen from now on rather than "Saved", which would leave them re-reading the
 * options to find out what they just did.
 */
export function deliveryConfirmation(mode: AlertDeliveryMode): string {
  return mode === "slack_and_email"
    ? "Alerts will go to Slack and e-mail."
    : "Alerts will go to Slack, with e-mail as the backstop.";
}

/**
 * The channel-configuration facts the card needs to be honest, as reported by
 * the backend. Booleans only — it never returns the webhook URL (a credential)
 * or the recipient list.
 */
export type DeliveryChannels = {
  slack_configured: boolean;
  email_configured: boolean;
};

/** A warning the card must show, or nothing when the setup is sound. */
export type DeliveryGap = "no-backstop" | "no-slack";

/**
 * What is wrong with the CONFIGURATION, independently of which mode is
 * selected.
 *
 * `no-backstop` is the important one and it is why this function exists. The
 * card promises that an alert still reaches the mailbox when Slack does not
 * land — which is FALSE when no mailbox is configured, and false in the
 * direction that matters, because it would leave a reader believing a failed
 * Slack post is covered when it is not. Neither mode can fix it; only an env var
 * on the API can, which is what the copy says.
 *
 * `no-slack` is not a fault, just a fact worth stating: with no webhook set,
 * everything arrives by e-mail whichever option is selected, so someone
 * wondering why Slack is quiet has the answer on the same card.
 *
 * Both can be true at once (nothing is configured anywhere), and both are
 * returned, because they are separate problems with separate fixes.
 */
export function deliveryGaps(channels: DeliveryChannels): DeliveryGap[] {
  const gaps: DeliveryGap[] = [];
  if (!channels.email_configured) gaps.push("no-backstop");
  if (!channels.slack_configured) gaps.push("no-slack");
  return gaps;
}
