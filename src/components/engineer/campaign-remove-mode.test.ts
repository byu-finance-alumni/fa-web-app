import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  campaignRemoveActions,
  campaignRemoveConfirm,
  RESET_CONTROL_HERE,
  RESET_CONTROL_LABEL,
  RESET_CONTROL_ON_ENGINEER_SURVEYS,
  RESET_POINTER_ENGINEER_SURVEYS,
} from "./campaign-remove-mode";
import { FINANCE_DEPARTMENT } from "@/lib/survey-reset-contact";

const EVERY_STATUS = [
  "scheduled",
  "active",
  "paused",
  "completed",
  "cancelled",
];

describe("campaignRemoveActions", () => {
  it("offers delete for every status, including cancelled", () => {
    // The complaint itself: Jake's campaigns had all either sent or been
    // cancelled, so the console offered him Cancel or nothing at all. `deleting`
    // is no longer conditional on either — the backend retires the campaign's
    // cycle instead of refusing, so a new campaign for the year still reaches
    // the alumni the deleted one emailed.
    for (const status of EVERY_STATUS) {
      expect(campaignRemoveActions(status).canDelete).toBe(true);
    }
  });

  it("offers cancel only while there is something left to stop", () => {
    expect(campaignRemoveActions("scheduled").canCancel).toBe(true);
    expect(campaignRemoveActions("active").canCancel).toBe(true);
    expect(campaignRemoveActions("paused").canCancel).toBe(true);
  });

  it("does not offer cancel for a campaign that already sends nothing", () => {
    // Cancelling these changes no behaviour — they are inert history — and a
    // button that does nothing reads as one that failed.
    expect(campaignRemoveActions("completed").canCancel).toBe(false);
    expect(campaignRemoveActions("cancelled").canCancel).toBe(false);
  });

  it("always leaves at least one control on the row", () => {
    // The regression that started this: `cancelled` rendered no control at all,
    // so a campaign in that state could never be got rid of.
    for (const status of [...EVERY_STATUS, "something-new"]) {
      const actions = campaignRemoveActions(status);
      expect(actions.canDelete || actions.canCancel).toBe(true);
    }
  });
});

/**
 * The confirm wording (#659).
 *
 * Jake cancelled a year's campaign, went to send to that cohort again, and one
 * alumna was still excluded with nothing on screen explaining why: she had
 * replied, and a reply holds someone out for 365 days regardless of what happens
 * to the campaign that asked. These pin that sentence — and the name of the one
 * control that clears it — into both confirms, so a later tidy-up of the copy
 * cannot quietly drop the only fact nobody can guess.
 */
function confirmText(
  mode: "cancel" | "delete",
  emailsSentAllTime = 42,
): string {
  return campaignRemoveConfirm(mode, {
    graduationYear: 2019,
    emailsSentAllTime,
  })
    .paragraphs.map((p) => p.text)
    .join(" ");
}

/**
 * The SAME cancel copy as the engineer page's, as the needs-surveying console's
 * "Cancel schedule" button asks it for WHEN AN ENGINEER IS READING — i.e.
 * pointed at the reset control's real page instead of "on this page". Everything
 * below that holds for the engineer cancel confirm has to hold for this one too;
 * that is the whole reason the console reuses this function rather than writing
 * its own dialog.
 */
function consoleCancelText(): string {
  return campaignRemoveConfirm("cancel", {
    graduationYear: 2019,
    emailsSentAllTime: 42,
    resetPointer: RESET_POINTER_ENGINEER_SURVEYS,
  })
    .paragraphs.map((p) => p.text)
    .join(" ");
}

/**
 * The same confirm as read by someone who CANNOT reset — the full-access
 * staffer #658 is about. `contact` null means no engineer support contact is
 * configured.
 */
function nonEngineerText(
  mode: "cancel" | "delete",
  contact: { name: string; email: string } | null = {
    name: "Jake Gunn",
    email: "gunnjake@byu.edu",
  },
): string {
  return campaignRemoveConfirm(mode, {
    graduationYear: 2019,
    emailsSentAllTime: 42,
    resetPointer: { canReset: false, contact },
  })
    .paragraphs.map((p) => p.text)
    .join(" ");
}

/**
 * The one fact nobody can guess from the word "cancelled", pinned as a whole
 * sentence rather than as loose keywords. A tidy-up that keeps the words
 * "answered" and "year" somewhere in the copy while losing the claim they make
 * together is exactly the regression this exists to catch.
 */
const HELD_OUT_FOR_A_YEAR =
  /alumni who have already answered stay out of the next survey for a year/i;

/** Delete's promise, which is FALSE of cancel — cancel keeps the cycle. */
const FREES_THE_COHORT = /emailed again|reach the alumni/i;

describe("campaignRemoveConfirm (#659)", () => {
  it("tells both confirms that answering holds an alum out for a year", () => {
    for (const mode of ["cancel", "delete"] as const) {
      const text = confirmText(mode);
      expect(text).toMatch(/answered/i);
      expect(text).toMatch(/year/i);
    }
    // Cancel's is pinned as a whole sentence, because cancel is the action where
    // the hold is a surprise — deleting a campaign at least sounds destructive.
    expect(confirmText("cancel")).toMatch(HELD_OUT_FOR_A_YEAR);
  });

  it("names the per-alumnus reset in both, so the reader can go find it", () => {
    // A confirm that says "they stay held out" without saying what to do about
    // it is the same dead end in nicer words.
    expect(confirmText("cancel")).toContain(RESET_CONTROL_LABEL);
    expect(confirmText("delete")).toContain(RESET_CONTROL_LABEL);
  });

  it("says cancel stops the sending and keeps the campaign listed", () => {
    const text = confirmText("cancel");
    expect(text).toMatch(/sending stops/i);
    expect(text).toMatch(/stays\s+listed/i);
    expect(text).toMatch(/never resumes/i);
  });

  it("says delete removes the campaign but keeps the emails and answers", () => {
    const text = confirmText("delete");
    expect(text).toMatch(/removed from this list/i);
    expect(text).toMatch(/kept/i);
    // "delete campaign" reads like the answers go with it. They do not, and the
    // confirm must never imply otherwise.
    expect(text).not.toMatch(/permanently delet/i);
  });

  it("only DELETE promises the alumni this campaign emailed can be reached again", () => {
    // Cancel does NOT retire the cycle — `delete_schedule` writes the retirement
    // row, `cancel_schedule` only sets the status — so promising a freed cohort
    // on cancel would be false.
    expect(confirmText("delete")).toMatch(/reach the alumni this one emailed/i);
    expect(confirmText("cancel")).not.toMatch(FREES_THE_COHORT);
  });

  it("says cancel deletes nothing", () => {
    // "Cancel schedule" reads as "undo it" — people expect the sends and the
    // submitted answers to go with it. They don't, and the confirm says so
    // outright rather than leaving it to be inferred from "are kept".
    expect(confirmText("cancel")).toMatch(/nothing is deleted/i);
  });

  it("counts the sent emails, and says plainly when there were none", () => {
    expect(confirmText("delete", 1)).toContain("1 email ");
    expect(confirmText("delete", 42)).toContain("42 emails");
    expect(confirmText("delete", 0)).toMatch(/never sent an email/i);
  });

  it("titles each confirm with the action and the cohort", () => {
    expect(campaignRemoveConfirm("cancel", {
      graduationYear: 2019,
      emailsSentAllTime: 0,
    }).title).toBe("Cancel the Class of 2019 campaign?");
    expect(campaignRemoveConfirm("delete", {
      graduationYear: 2019,
      emailsSentAllTime: 0,
    }).title).toBe("Delete the Class of 2019 campaign?");
  });
});

/**
 * The needs-surveying console's "Cancel schedule" confirm (#659).
 *
 * That button cancelled a live campaign on a single click with nothing in
 * between — it is the one Jake actually pressed on a real cohort. It now shows
 * THIS module's cancel copy, so every invariant above governs it too; these
 * check the console's variant specifically, since the only thing it changes is
 * where it sends the reader for the reset.
 */
describe("the needs-surveying console's cancel confirm (#659)", () => {
  it("carries the same held-out-for-a-year sentence as the engineer one", () => {
    // The reason the console reuses this function at all. A second dialog
    // written in its own words is exactly how this line gets dropped from one
    // of the two cancel buttons and nobody notices.
    expect(consoleCancelText()).toMatch(HELD_OUT_FOR_A_YEAR);
    expect(consoleCancelText()).toMatch(/cancelling doesn’t change that/i);
  });

  it("never gains delete's promise that the cohort is freed", () => {
    // `cancel_schedule` only sets the status and keeps `cycle_seq`; only
    // `delete_schedule` retires the cycle. Copy-pasting delete's sentence onto
    // this screen would promise a re-send that silently reaches nobody.
    expect(consoleCancelText()).not.toMatch(FREES_THE_COHORT);
  });

  it("says the rest of what cancel does, exactly as the engineer confirm does", () => {
    const text = consoleCancelText();
    expect(text).toMatch(/sending stops/i);
    expect(text).toMatch(/reminders included/i);
    expect(text).toMatch(/stays\s+listed/i);
    expect(text).toMatch(/nothing is deleted/i);
    // Same copy, not merely similar copy.
    expect(text).toBe(
      confirmText("cancel").replace(
        RESET_CONTROL_HERE,
        RESET_CONTROL_ON_ENGINEER_SURVEYS,
      ),
    );
  });

  it("sends the reader to the page the reset is actually on", () => {
    const text = consoleCancelText();
    expect(text).toContain(RESET_CONTROL_LABEL);
    expect(text).toContain(RESET_CONTROL_ON_ENGINEER_SURVEYS);
    // "on this page" is true on the engineer console and false here — the reset
    // card is not rendered on the needs-surveying screen.
    expect(text).not.toContain(RESET_CONTROL_HERE);
  });
});

/**
 * The confirm as read by someone who cannot reset anyone (#658).
 *
 * Naming the engineer Surveys page was still a dead end for most of the people
 * who see this dialog: `/engineer/*` bounces everyone but the engineer to the
 * dashboard, so a full-access staffer told to "use that control on the engineer
 * Surveys page" clicks through to a door that doesn't open and learns nothing.
 * Only an engineer can reset an alumnus at all, so they get a person to ask.
 */
describe("the confirm read by a non-engineer (#658)", () => {
  it("never sends them to a page they cannot open", () => {
    for (const mode of ["cancel", "delete"] as const) {
      const text = nonEngineerText(mode);
      expect(text).not.toContain(RESET_CONTROL_ON_ENGINEER_SURVEYS);
      expect(text).not.toContain(RESET_CONTROL_HERE);
      // Nor the control's name — they can't reach the control either, and
      // naming it is what makes the sentence read like an instruction.
      expect(text).not.toContain(RESET_CONTROL_LABEL);
    }
  });

  it("says an engineer is required, and names the one to ask", () => {
    for (const mode of ["cancel", "delete"] as const) {
      const text = nonEngineerText(mode);
      expect(text).toMatch(/only an engineer can clear it/i);
      expect(text).toContain("Jake Gunn at gunnjake@byu.edu");
    }
  });

  it("falls back to the Finance Department when no engineer is configured", () => {
    // Jake's rule (2026-08-07): say the department in words. NOT an invented
    // address — a message sent into a mailbox that doesn't exist looks
    // delivered, which is worse than being told to go and find someone.
    for (const mode of ["cancel", "delete"] as const) {
      const text = nonEngineerText(mode, null);
      expect(text).toContain(FINANCE_DEPARTMENT);
      expect(text).not.toContain("@");
    }
  });

  it("keeps every other fact identical to the engineer's copy", () => {
    // The audience changes who to ask, and nothing else. A second story about
    // what cancelling does is exactly what #659 stamped out.
    expect(nonEngineerText("cancel")).toMatch(HELD_OUT_FOR_A_YEAR);
    expect(nonEngineerText("cancel")).toMatch(/nothing is deleted/i);
    expect(nonEngineerText("cancel")).not.toMatch(FREES_THE_COHORT);
    expect(nonEngineerText("delete")).toMatch(/reach the alumni this one emailed/i);
  });
});

describe("the confirms point at controls that exist (#659)", () => {
  function read(relPath: string): string {
    return readFileSync(resolve(process.cwd(), relPath), "utf8");
  }

  const CONSOLE = "src/components/needs-surveying/SurveyCampaignConsole.tsx";

  it("names the reset control exactly as its heading reads", () => {
    // Renaming that card without renaming it here would leave both confirms
    // sending people after a control that is no longer called that.
    expect(read("src/components/engineer/SurveyCampaignReset.tsx")).toContain(
      RESET_CONTROL_LABEL,
    );
  });

  it("renders the reset on the same page as the engineer confirms", () => {
    // The engineer confirms say "on this page", which is only true while the
    // Surveys page hosts the reset card and the campaign table together.
    const page = read("src/app/(app)/engineer/surveys/page.tsx");
    expect(page).toContain("SurveyCampaignReset");
  });

  it("does not render the reset on the needs-surveying page", () => {
    // Which is why that screen's confirm names the engineer page instead. If
    // the reset is ever added here, this fails and the pointer can be revisited.
    const page = read("src/app/(app)/needs-surveying/page.tsx");
    expect(page).not.toContain("SurveyCampaignReset");
  });

  it("has the console reuse this wording instead of writing its own", () => {
    // A second hand-written cancel dialog on the console is the failure this
    // whole module exists to prevent: two buttons, one action, two stories.
    const src = read(CONSOLE);
    expect(src).toContain("campaignRemoveConfirm");
    expect(src).toContain("RESET_POINTER_ENGINEER_SURVEYS");
  });

  it("picks the console's pointer by who is reading it (#658)", () => {
    // The engineer keeps the page name; everyone else gets the contact. Both
    // branches have to be in the source, or one audience is being told the
    // other's story.
    const src = read(CONSOLE);
    expect(src).toContain("isEngineer");
    expect(src).toContain("canReset: false");
  });

  it("puts a confirm in front of the cancel rather than firing on the click", () => {
    // The complaint itself: "Cancel schedule" called the endpoint straight from
    // its own onClick. It now opens a dialog that renders THESE paragraphs, and
    // only that dialog's button runs the request — so the copy above is what
    // someone actually reads, not text nothing displays.
    const src = read(CONSOLE);
    expect(src).toContain("setCancelOpen(true)");
    expect(src).toContain("cancelConfirm.paragraphs");
  });

  it("keeps the same fact on the console's cancel toast, after the deed", () => {
    // The confirm says it before the click; the toast repeats it after, which is
    // the half someone reads while already planning the re-send.
    const src = read(CONSOLE);
    // Two halves, because the sentence is split across concatenated template
    // literals in the source — matching it whole would pin the line wrapping.
    expect(src).toContain("anyone who already answered stays out of the");
    expect(src).toContain("next survey for a year");
  });
});
