import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  campaignRemoveActions,
  campaignRemoveConfirm,
  RESET_CONTROL_LABEL,
} from "./campaign-remove-mode";

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

describe("campaignRemoveConfirm (#659)", () => {
  it("tells both confirms that answering holds an alum out for a year", () => {
    for (const mode of ["cancel", "delete"] as const) {
      const text = confirmText(mode);
      expect(text).toMatch(/answered/i);
      expect(text).toMatch(/year/i);
    }
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
    expect(confirmText("cancel")).not.toMatch(/emailed again|reach the alumni/i);
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

describe("the confirms point at controls that exist (#659)", () => {
  function read(relPath: string): string {
    return readFileSync(resolve(process.cwd(), relPath), "utf8");
  }

  it("names the reset control exactly as its heading reads", () => {
    // Renaming that card without renaming it here would leave both confirms
    // sending people after a control that is no longer called that.
    expect(read("src/components/engineer/SurveyCampaignReset.tsx")).toContain(
      RESET_CONTROL_LABEL,
    );
  });

  it("renders the reset on the same page as these confirms", () => {
    // Both confirms say "on this page", which is only true while the engineer
    // Surveys page hosts the reset card and the campaign table together.
    const page = read("src/app/(app)/engineer/surveys/page.tsx");
    expect(page).toContain("SurveyCampaignReset");
  });

  it("keeps the same fact on the other cancel button, which has no confirm", () => {
    // The needs-surveying console cancels a schedule outright — no dialog — so
    // its toast is the only place the 365-day hold can be said there.
    const src = read("src/components/needs-surveying/SurveyCampaignConsole.tsx");
    // Two halves, because the sentence is split across concatenated template
    // literals in the source — matching it whole would pin the line wrapping.
    expect(src).toContain("anyone who already answered stays out of the");
    expect(src).toContain("next survey for a year");
  });
});
