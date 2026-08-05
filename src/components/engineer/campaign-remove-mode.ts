/**
 * Which removal actions a survey campaign gets (#398) — the one decision behind
 * `CampaignRemoveControl`, pulled out so it can be tested without a DOM.
 *
 * DELETE IS ALWAYS OFFERED, whatever the status. It did not used to be: a
 * campaign that had ever emailed anyone was given `cancel` instead, and an
 * already-cancelled one was given nothing at all — so in practice the button was
 * unreachable (Jake: "it still won't let me delete a campaign in the engineer
 * dashboard"). The reason for that restriction was real, and is now solved in
 * the backend rather than worked around here: `survey_schedule` holds the
 * graduation year's cycle number, so deleting it used to leave the send-log rows
 * reading as the CURRENT cycle's, and the next campaign for that year would find
 * everyone already emailed and send to nobody. The delete now RETIRES that
 * cycle, so a new campaign for the year starts above the old sends and reaches
 * those alumni again. Nothing is removed but the campaign itself — the record of
 * the emails and the alumni's answers are kept, and the confirm says so.
 *
 * CANCEL SURVIVES, and is not a lesser delete. It stops a live campaign and
 * KEEPS it listed with its counts, which is a different thing to want than
 * getting the campaign off the screen. So it is offered only while there is
 * something to stop: a completed or already-cancelled campaign sends nothing, and
 * a button that changes nothing is worse than no button.
 */

/**
 * The statuses a cancel would actually stop — the two the daily send cron acts
 * on, plus the reversible `paused`. Mirrors the backend's `_RUNNABLE_STATUSES`.
 */
const STOPPABLE_STATUSES = ["scheduled", "active", "paused"];

export type CampaignRemoveActions = {
  /**
   * Always true — every campaign can be removed, whatever its status. A field
   * rather than an omission so the call site reads as a decision that was made,
   * not an assumption nobody checked.
   */
  canDelete: boolean;
  canCancel: boolean;
};

export function campaignRemoveActions(status: string): CampaignRemoveActions {
  return {
    canDelete: true,
    canCancel: STOPPABLE_STATUSES.includes(status),
  };
}
