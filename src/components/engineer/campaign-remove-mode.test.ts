import { describe, expect, it } from "vitest";
import { campaignRemoveMode } from "./campaign-remove-mode";

describe("campaignRemoveMode", () => {
  it("offers delete only for a campaign that has never emailed anyone", () => {
    expect(campaignRemoveMode("scheduled", 0)).toBe("delete");
    expect(campaignRemoveMode("active", 0)).toBe("delete");
    expect(campaignRemoveMode("paused", 0)).toBe("delete");
    expect(campaignRemoveMode("completed", 0)).toBe("delete");
  });

  it("offers cancel once a single email has gone out", () => {
    // ONE is enough. Deleting the schedule would take the year's cycle number
    // with it, and the next campaign for that year would skip everybody — so
    // the threshold is "any", not "many".
    expect(campaignRemoveMode("active", 1)).toBe("cancel");
    expect(campaignRemoveMode("paused", 250)).toBe("cancel");
    expect(campaignRemoveMode("completed", 250)).toBe("cancel");
  });

  it("offers nothing for an already-cancelled campaign", () => {
    expect(campaignRemoveMode("cancelled", 0)).toBe("none");
    expect(campaignRemoveMode("cancelled", 40)).toBe("none");
  });
});
