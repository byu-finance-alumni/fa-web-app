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

import {
  resetContactPhrase,
  type ResetContact,
} from "@/lib/survey-reset-contact";

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

/**
 * WHERE that control is, said from the seat of whoever is reading the confirm.
 *
 * The engineer Surveys page renders the reset card directly above the campaign
 * table, so its confirms can say "on this page". The needs-surveying console's
 * "Cancel schedule" confirm is a different screen with no reset on it, so "on
 * this page" there would send someone hunting a card that isn't rendered — it
 * names the page to go to instead. Both spellings live here, next to the copy
 * that uses them, so the two confirms cannot drift into naming different places.
 */
export const RESET_CONTROL_HERE = "on this page";
export const RESET_CONTROL_ON_ENGINEER_SURVEYS =
  "on the engineer Surveys page";

/**
 * Where the reader is sent for the per-alumnus reset — WHICH DEPENDS ON WHO IS
 * READING (#658).
 *
 * Naming the page was still a dead end for most people: `/engineer/*` is
 * engineer-only and its layout bounces everyone else to the dashboard, so a
 * full-access staffer following "use it on the engineer Surveys page" lands
 * somewhere they cannot open, with no idea why. Only an engineer can reset an
 * alumnus at all (the backend enforces `RequireEngineer` on the state/reset
 * pair), so for anyone else the honest instruction is a person to ask, not a
 * door to try.
 *
 * `contact` is null when no engineer support contact is configured; the sentence
 * then falls back to the Finance Department by Jake's rule (2026-08-07).
 */
export type ResetPointer =
  /** The reader can run the reset themselves; `at` says where the control is. */
  | { canReset: true; at: string }
  /** The reader cannot — name who to ask instead. */
  | { canReset: false; contact: ResetContact | null };

/** An engineer reading a confirm on the engineer Surveys page. */
export const RESET_POINTER_HERE: ResetPointer = {
  canReset: true,
  at: RESET_CONTROL_HERE,
};

/** An engineer reading a confirm on the needs-surveying console. */
export const RESET_POINTER_ENGINEER_SURVEYS: ResetPointer = {
  canReset: true,
  at: RESET_CONTROL_ON_ENGINEER_SURVEYS,
};

/**
 * The closing sentence of both confirms' last paragraph: what to do about the
 * alumni a reply is holding out. Split out so the two audiences get two
 * genuinely different instructions from one place.
 */
export function resetPointerSentence(pointer: ResetPointer): string {
  if (pointer.canReset) {
    return `To clear it for one person, use “${RESET_CONTROL_LABEL}” ${pointer.at}.`;
  }
  return (
    "Only an engineer can clear it for one person. Contact " +
    `${resetContactPhrase(pointer.contact)}.`
  );
}

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
 *
 * The cancel copy has a SECOND caller: "Cancel schedule" on the needs-surveying
 * console, which used to cancel a live campaign in one click with no confirm at
 * all (that is the button Jake actually pressed). It shows this same wording
 * rather than a second, differently-worded dialog — one set of promises about
 * what cancelling does, in one place, checked by one set of tests. Only
 * `resetControlAt` differs, because the reset card is not on that screen.
 */
export function campaignRemoveConfirm(
  mode: CampaignRemoveMode,
  {
    graduationYear,
    emailsSentAllTime,
    resetPointer = RESET_POINTER_HERE,
  }: {
    graduationYear: number;
    emailsSentAllTime: number;
    /**
     * Where to send the reader for the per-alumnus reset. Defaults to the
     * engineer Surveys page's own phrasing, because that page is where these
     * confirms started and only an engineer can open it; a caller on any other
     * screen passes its own, including the "you can't, ask this person" variant.
     */
    resetPointer?: ResetPointer;
  },
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
            "listed with its counts. A cancelled campaign never resumes. " +
            "Running this cohort again means starting a new campaign for it.",
        },
        {
          text:
            "Nothing is deleted: the emails already sent and every answer " +
            "alumni submitted are kept.",
          emphasis: true,
        },
        {
          text:
            "Alumni who have already answered stay out of the next survey for a " +
            `year, and cancelling doesn’t change that. ` +
            resetPointerSentence(resetPointer),
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
              "answer alumni submitted, including any still waiting to be " +
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
          "who has answered in the last year still stays out. " +
          resetPointerSentence(resetPointer),
      },
    ],
  };
}
