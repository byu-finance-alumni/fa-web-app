import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The survey asks alumni what they will help with; the profile has to say what
 * they answered.
 *
 * It did not. `programChips` listed FIVE of the flags, so an alum who answered
 * "yes, I'll mentor for Women in Finance" (or help at an event, sponsor a
 * company event, host a case competition) had that answer staged, approved out
 * of the review queue, written to `alumni_program_engagement` — and then
 * displayed nowhere in the app.
 *
 * The fix arrived in two steps and the second replaced the first. A dedicated
 * "Ways to get involved" panel came first; then #629 made all nine flags into
 * derived TAGS, which render in the profile header for every role. That made
 * the panel a second copy of the same nine facts on the same screen, so Jake
 * had it removed (2026-08-05): "the tags already show up in their header."
 *
 * So the invariant these guard is unchanged — every engagement question the
 * survey asks has a home on the profile, visible to every role — but the home
 * is now the header tag row, not a panel. These read the page source rather
 * than importing it: the profile is a server component that pulls in the whole
 * app shell, and the source text pins the invariant just as firmly.
 */

function read(relPath: string): string {
  return readFileSync(resolve(process.cwd(), relPath), "utf8");
}

const PROFILE_PAGE = "src/app/(app)/alumni/[id]/page.tsx";

describe("profile shows the engagement answers alumni give", () => {
  it("does not print the same nine facts twice on one screen", () => {
    // The old dedicated panel was removed once the flags became header tags
    // (#629). If someone reinstates it, the profile shows every willingness
    // twice — once as a tag, once in a panel directly beneath it.
    const src = read(PROFILE_PAGE);
    expect(src).not.toContain('title="Ways to get involved"');
  });

  it("still shows them to every role, via the header tags", () => {
    // The flags are outreach information, not contact PII — the backend keeps
    // them in the view-only payload and strips only the free-text notes. The
    // header tag row is NOT gated on `canEdit`, so a professor sees exactly the
    // fact the survey exists to collect. The editor-only Tags tab must never
    // become the only home again.
    const src = read(PROFILE_PAGE);
    const start = src.indexOf("profile.tags.map");
    expect(start, "the header no longer renders tags").toBeGreaterThan(-1);
    const before = src.slice(Math.max(0, start - 600), start);
    expect(before).not.toMatch(/canEdit \? \(/);
  });
});
