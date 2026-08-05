import { describe, expect, it } from "vitest";
import { campaignRemoveActions } from "./campaign-remove-mode";

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
