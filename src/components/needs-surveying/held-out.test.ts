/**
 * The already-replied drill-down (#658).
 *
 * Jake cancelled a campaign, went to re-send to the cohort, and was told
 * "1 already replied within the last year" with no way to tell whether that 1
 * was the alumna he was trying to reach. These pin the two things that make the
 * list answer that question: it asks for the right bucket, and every row carries
 * the DATE — which is what decides whether re-asking someone is reasonable.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  formatConsoleDate,
  HELD_OUT_ALREADY_RESPONDED,
  heldOutRequestPath,
  heldOutTruncatedNote,
  repliedLabel,
} from "./held-out";

describe("heldOutRequestPath", () => {
  it("asks for the already-replied bucket of that year", () => {
    const path = heldOutRequestPath(2019);
    expect(path).toContain("/survey/campaigns/2019/held-out");
    expect(path).toContain(`reason=${HELD_OUT_ALREADY_RESPONDED}`);
  });

  it("asks for enough of them to cover a graduation year", () => {
    // A truncated list cannot answer "is she in it?", which is the only
    // question the panel exists for.
    const limit = Number(
      new URLSearchParams(heldOutRequestPath(2019).split("?")[1]).get("limit"),
    );
    expect(limit).toBeGreaterThanOrEqual(500);
    // ...and stays inside the endpoint's own ceiling, or it 422s.
    expect(limit).toBeLessThanOrEqual(1000);
  });
});

describe("repliedLabel", () => {
  it("renders the reply date, which is the point of the list", () => {
    // A count says someone is held out; the date says whether that is
    // reasonable. Three weeks ago is leave-them-alone, eleven months ago is a
    // judgement call — and only the date tells them apart.
    expect(repliedLabel("2026-03-03T18:04:00Z")).toBe("Replied Mar 3, 2026");
  });

  it("writes it the way the rest of this console writes dates", () => {
    // Same formatter as the "Last auto-send" stat. A different format two
    // inches away reads as a different kind of thing.
    expect(repliedLabel("2026-03-03T18:04:00Z")).toContain(
      formatConsoleDate("2026-03-03T18:04:00Z", "Never"),
    );
  });

  it("says the date is missing rather than printing a dash", () => {
    // `last_reply_at` is always set for this bucket, so a null here means the
    // backend sent a row it shouldn't have. A dash would read as "never
    // replied", which is the opposite of why they are on this list.
    expect(repliedLabel(null)).toBe("Reply date not recorded");
    expect(repliedLabel("not-a-date")).toBe("Reply date not recorded");
  });
});

describe("heldOutTruncatedNote", () => {
  it("says nothing when the whole bucket is on screen", () => {
    expect(heldOutTruncatedNote(3, 3)).toBe("");
  });

  it("admits a partial list rather than letting it read as complete", () => {
    const note = heldOutTruncatedNote(500, 1200);
    expect(note).toContain("500");
    expect(note).toContain("1,200");
  });
});

/**
 * Guards on the console itself. The list is only useful if it is actually
 * rendered with the reset behind it, and only offered to someone who can use it.
 */
describe("the console renders the drill-down (#658)", () => {
  const src = readFileSync(
    resolve(
      process.cwd(),
      "src/components/needs-surveying/SurveyCampaignConsole.tsx",
    ),
    "utf8",
  );

  it("puts the reply date on every row", () => {
    expect(src).toContain("repliedLabel(alum.last_reply_at)");
  });

  it("reads the alum's state BEFORE offering the reset", () => {
    // Not a loading step — the point. A reset puts a real email in front of a
    // real alumnus, and someone who legitimately replied three months ago may
    // not be worth re-asking. The state read is the only thing that can say so
    // before the fact.
    const stateAt = src.indexOf("/state`");
    const resetAt = src.indexOf("/reset`");
    expect(stateAt).toBeGreaterThan(-1);
    expect(resetAt).toBeGreaterThan(stateAt);
    // ...and the reset button only exists once that read has returned.
    expect(src).toContain("What is holding");
  });

  it("treats a 403 on the list as an answer, not a failure", () => {
    // The endpoint is engineer-gated. A non-engineer is never offered the
    // expander, but if one ever reaches it the panel keeps the count and shows
    // who to ask — it must not fire an error toast about a permission that is
    // working exactly as designed.
    expect(src).toContain("err.status === 403");
    expect(src).toContain("heldOutNamesRequireEngineer");
  });
});
