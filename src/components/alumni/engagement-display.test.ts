import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { SURVEY_FIELDS } from "@/types/survey";

/**
 * The survey asks alumni what they will help with; the profile has to say what
 * they answered.
 *
 * It did not. `programChips` on the profile listed FIVE of the flags, so an alum
 * who answered "yes, I'll mentor for Women in Finance" (or help at an event,
 * sponsor a company event, host a case competition) had that answer staged,
 * approved out of the review queue, written to `alumni_program_engagement` — and
 * then displayed nowhere in the app. Worse, the five that DID render lived only
 * inside the editor-only tab labelled "Tags", which is not a place anyone looks
 * for "is this person willing to mentor".
 *
 * These read the page source rather than importing it: the profile is a server
 * component that pulls in the whole app shell. What matters is the invariant —
 * every engagement question the survey asks has a home on the profile — and the
 * source text pins it just as firmly.
 */

function read(relPath: string): string {
  return readFileSync(resolve(process.cwd(), relPath), "utf8");
}

const PROFILE_PAGE = "src/app/(app)/alumni/[id]/page.tsx";

/** The boolean engagement questions the survey puts to alumni. */
const surveyEngagementColumns = SURVEY_FIELDS.filter(
  (f) =>
    f.table === "alumni_program_engagement" &&
    f.kind === "boolean" &&
    // CFA/CFP/CPA are held/not-held designations, not willingness — they have
    // their own panel and their own tab.
    !f.column.endsWith("_designation"),
).map((f) => f.column);

describe("profile shows the engagement answers alumni give", () => {
  it("lists every engagement flag the survey collects", () => {
    const src = read(PROFILE_PAGE);
    const block = src.slice(
      src.indexOf("const ENGAGEMENT_FLAGS"),
      src.indexOf("function engagementLabels"),
    );
    expect(block.length).toBeGreaterThan(0);
    expect(surveyEngagementColumns.length).toBeGreaterThanOrEqual(9);
    for (const column of surveyEngagementColumns) {
      expect(block, `${column} is stored but never displayed`).toContain(
        `"${column}"`,
      );
    }
  });

  it("surfaces them on the Overview, not only in the editor-only Tags tab", () => {
    const src = read(PROFILE_PAGE);
    const overview = src.slice(
      src.indexOf("overview={"),
      src.indexOf("profileCompleteness={"),
    );
    expect(overview).toContain("Ways to get involved");
    expect(overview).toContain("willingLabels");
  });

  it("shows the panel to every role, not just editors", () => {
    // The flags are outreach information, not contact PII — the backend keeps
    // them in the view-only payload and strips only the free-text notes. Gating
    // the panel on `canEdit` would hide from professors exactly the fact the
    // survey exists to collect.
    const src = read(PROFILE_PAGE);
    const start = src.indexOf("title=\"Ways to get involved\"");
    expect(start).toBeGreaterThan(-1);
    const panel = src.slice(start, src.indexOf("</Panel>", start));
    // The edit shortcut is editor-only; the content itself is not conditional.
    expect(panel).not.toMatch(/canEdit \? \(/);
  });
});
