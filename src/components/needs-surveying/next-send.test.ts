/**
 * The schedule card's "what goes out next" line (#562). The backend decides the
 * stage, date and count; these pin that the card says it plainly and says
 * NOTHING when there is no next send.
 */
import { describe, expect, it } from "vitest";

import { nextSendLine } from "./next-send";

const item = (
  next_stage: number | null,
  next_send_date: string | null,
  next_send_count: number | null,
) => ({ next_stage, next_send_date, next_send_count });

describe("nextSendLine", () => {
  it("names the stage, the day and roughly how many", () => {
    expect(nextSendLine(item(1, "2026-10-14", 37))).toBe(
      "Next: 1-week reminder · Wed, Oct 14 · ~37 people",
    );
    expect(nextSendLine(item(0, "2026-10-12", 120))).toBe(
      "Next: Initial email · Mon, Oct 12 · ~120 people",
    );
    expect(nextSendLine(item(2, "2026-10-21", 1))).toBe(
      "Next: 2-week reminder · Wed, Oct 21 · ~1 person",
    );
  });

  it("drops the count when there is none", () => {
    expect(nextSendLine(item(1, "2026-10-14", null))).toBe(
      "Next: 1-week reminder · Wed, Oct 14",
    );
  });

  it("says nothing when nothing more will send", () => {
    // Paused / cancelled / completed / all stages delivered all arrive as null.
    expect(nextSendLine(item(null, null, null))).toBeNull();
    expect(nextSendLine(null)).toBeNull();
    // A stage the card has no name for is not guessed at.
    expect(nextSendLine(item(3, "2026-10-14", 5))).toBeNull();
  });
});
