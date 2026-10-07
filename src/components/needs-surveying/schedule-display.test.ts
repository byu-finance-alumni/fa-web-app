/**
 * The Schedule tab's sent boxes after a campaign stops (#857).
 *
 * A completed campaign showed 0 / 0 / 0 and a dash for "Last auto-send",
 * because the boxes read the runnable-only lookup the controls use. These pin
 * the split: the controls still treat a finished year as unscheduled, while the
 * record keeps the real numbers in every status.
 */
import { describe, expect, it } from "vitest";

import {
  findDisplaySchedule,
  findRunnableSchedule,
  isRunnableSchedule,
} from "./schedule-display";

function row(graduation_year: number, status: string, sent_initial = 0) {
  return { graduation_year, status, sent_initial };
}

describe("isRunnableSchedule", () => {
  it.each(["scheduled", "active"])("treats %s as runnable", (status) => {
    expect(isRunnableSchedule(row(2020, status))).toBe(true);
  });

  it.each(["completed", "cancelled", "paused"])(
    "treats %s as not runnable",
    (status) => {
      expect(isRunnableSchedule(row(2020, status))).toBe(false);
    },
  );
});

describe("findRunnableSchedule (drives the controls)", () => {
  it("is null for a stopped campaign, so the controls clear", () => {
    for (const status of ["completed", "cancelled", "paused"]) {
      expect(findRunnableSchedule([row(2020, status, 99)], 2020)).toBeNull();
    }
  });

  it("finds a live campaign", () => {
    const live = row(2020, "active", 40);
    expect(findRunnableSchedule([live], 2020)).toBe(live);
  });

  it("is null with nothing loaded or no year picked", () => {
    expect(findRunnableSchedule(null, 2020)).toBeNull();
    expect(findRunnableSchedule([row(2020, "active")], null)).toBeNull();
  });
});

describe("findDisplaySchedule (drives the sent boxes)", () => {
  it.each(["completed", "cancelled", "paused", "scheduled", "active"])(
    "keeps the real counts when the campaign is %s",
    (status) => {
      const r = row(2020, status, 99);
      expect(findDisplaySchedule([r], 2020)?.sent_initial).toBe(99);
    },
  );

  it("only reads the selected year", () => {
    const rows = [row(2019, "completed", 12), row(2020, "completed", 99)];
    expect(findDisplaySchedule(rows, 2019)?.sent_initial).toBe(12);
    expect(findDisplaySchedule(rows, 2021)).toBeNull();
  });

  it("prefers a runnable row over a stopped one for the same year", () => {
    const old = row(2020, "cancelled", 5);
    const live = row(2020, "active", 40);
    expect(findDisplaySchedule([old, live], 2020)).toBe(live);
  });

  it("is null with nothing loaded or no year picked", () => {
    expect(findDisplaySchedule(null, 2020)).toBeNull();
    expect(findDisplaySchedule([row(2020, "completed")], null)).toBeNull();
  });
});
