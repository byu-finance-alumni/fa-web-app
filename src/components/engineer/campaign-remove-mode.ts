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
 *
 * The CONFIRM WORDING for both actions lives here too (#659) — see
 * `campaignRemoveConfirm` below.
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

/* --------------------------------------------------- confirm wording (#659) */

/**
 * The per-alumnus tool, named exactly as its heading reads on the engineer
 * Surveys page (`SurveyCampaignReset`). Both confirms point at it by name so
 * someone reading "they stay held out for a year" can actually go and find the
 * one control that clears it — a guard in the test file pins the two together.
 */
export const RESET_CONTROL_LABEL = "Reset one alum’s survey campaign";

export type CampaignRemoveMode = "cancel" | "delete";

/** One paragraph of confirm copy; `emphasis` is the "keep reading" line. */
export type ConfirmParagraph = { text: string; emphasis?: boolean };

export type CampaignRemoveConfirm = {
  title: string;
  paragraphs: ConfirmParagraph[];
};

/**
 * What each confirm says — the whole point of #659.
 *
 * Cancelling used to report "cancelled" and nothing more, which reads as "this
 * campaign is gone, I can start over". It is ALMOST that, and the gap is where
 * it bit Jake: he cancelled a year, went to send to that cohort again, and one
 * alumna was still excluded with nothing on screen explaining why. She had
 * replied, and a reply holds someone out for 365 days no matter what happens to
 * the campaign that asked. That is the one fact nobody can guess from the word
 * "cancelled", so both confirms now say it, and both name the control that
 * clears it for a single person.
 *
 * NOT SAID, because it is not true of cancel: that cancelling frees the alumni
 * this campaign emailed. Only DELETE retires the campaign's cycle
 * (`survey_schedule.delete_schedule` writes the retirement row); cancel just
 * sets the status and leaves the row on its cycle. Delete's copy is the only one
 * that promises the old recipients are reachable again.
 *
 * Kept to three short paragraphs. This is a decision someone is making with a
 * finger on the button, not documentation — anything longer gets skipped, which
 * is how the missing fact stays missing. Pulled out of the component so the
 * facts can be pinned by a test without a DOM, exactly like
 * `campaignRemoveActions` above.
 */
export function campaignRemoveConfirm(
  mode: CampaignRemoveMode,
  {
    graduationYear,
    emailsSentAllTime,
  }: { graduationYear: number; emailsSentAllTime: number },
): CampaignRemoveConfirm {
  const emailCount = `${emailsSentAllTime} email${
    emailsSentAllTime === 1 ? "" : "s"
  }`;

  if (mode === "cancel") {
    return {
      title: `Cancel the Class of ${graduationYear} campaign?`,
      paragraphs: [
        {
          text:
            "Sending stops now, reminders included, and the campaign stays " +
            "listed here with its counts. A cancelled campaign never resumes — " +
            "running this cohort again means starting a new campaign for it.",
        },
        {
          text:
            "The emails already sent and every answer alumni submitted are kept.",
          emphasis: true,
        },
        {
          text:
            "Alumni who have already answered stay out of the next survey for a " +
            `year — cancelling doesn’t change that. To clear it for one person, ` +
            `use “${RESET_CONTROL_LABEL}” on this page.`,
        },
      ],
    };
  }

  return {
    title: `Delete the Class of ${graduationYear} campaign?`,
    paragraphs: [
      { text: "The campaign is removed from this list and will not send again." },
      {
        text:
          emailsSentAllTime > 0
            ? `The record of the ${emailCount} it sent is kept, and so is every ` +
              "answer alumni submitted — including any still waiting to be " +
              "reviewed."
            : "This campaign never sent an email. Every answer alumni submitted " +
              "for this graduation year is kept, on their profiles and in the " +
              "review queue.",
        emphasis: true,
      },
      {
        text:
          `You can create a new campaign for the Class of ${graduationYear} ` +
          "afterwards, and it will reach the alumni this one emailed. Anyone " +
          "who has answered in the last year still stays out; to clear that for " +
          `one person, use “${RESET_CONTROL_LABEL}” on this page.`,
      },
    ],
  };
}
