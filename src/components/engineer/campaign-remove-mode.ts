/**
 * Which verb removing a survey campaign gets (#398) — the one decision behind
 * `CampaignRemoveControl`, pulled out so it can be tested without a DOM.
 *
 * "delete" and "cancel" are not two words for the same thing here:
 *
 *   delete — the campaign never emailed anyone, so the schedule row is all that
 *            exists and it can simply go.
 *   cancel — it emailed someone. The row stays, terminally stopped. That is not
 *            politeness about history: `survey_schedule` is the only holder of
 *            the graduation year's cycle number, so deleting it would leave the
 *            send-log rows reading as the CURRENT cycle's and the next campaign
 *            for that year would find everyone already emailed and send to
 *            nobody. The backend refuses that delete outright; this makes the UI
 *            never offer it.
 *
 * "none" is an already-cancelled campaign: it is stopped, and a delete would be
 * refused for the same cycle-number reason, so there is nothing honest to offer.
 */
export type CampaignRemoveMode = "delete" | "cancel" | "none";

export function campaignRemoveMode(
  status: string,
  emailsSentAllTime: number,
): CampaignRemoveMode {
  if (status === "cancelled") return "none";
  return emailsSentAllTime > 0 ? "cancel" : "delete";
}
