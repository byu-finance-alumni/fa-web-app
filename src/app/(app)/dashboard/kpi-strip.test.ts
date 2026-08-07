import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Source-invariant guards for the split "Alumni edited" tile (#645).
 *
 * The tile is pure JSX in a Server Component with no extractable logic, so
 * there is nothing to unit-test by calling it — but three properties of it are
 * easy to break by accident and expensive to notice, so they're asserted
 * against the source text (the same altitude as `session-invariants.test.ts`):
 *
 *   1. It stays ONE card in a three-across strip. The obvious "fix" when a
 *      fourth number is wanted is a fourth MetricCard, which silently reflows
 *      `sm:grid-cols-3` into a 3+1 orphan row and lengthens the column.
 *   2. Neither figure is nested inside a card-level link. MetricCard turns the
 *      WHOLE card into an anchor when given `href`, and an anchor inside an
 *      anchor is invalid HTML that React refuses to render — so restoring
 *      `href` on this particular tile would break it at runtime, not at build.
 *   3. Both figures keep a caption and stay readable as separate windows. The
 *      month is a calendar month and the year is calendar year-to-date (it
 *      resets each January) — neither is the rolling 30 days the tile to their
 *      left uses, so the copy must not invite a comparison.
 *
 * They assert against source text rather than rendering, because the page is an
 * async Server Component that fetches on import-time render — not something this
 * Node-environment vitest setup can mount.
 */
function dashboardSource(): string {
  return readFileSync(
    resolve(process.cwd(), "src/app/(app)/dashboard/page.tsx"),
    "utf8",
  );
}

describe("dashboard KPI strip (#645)", () => {
  it("reads both the month and the year edit counts", () => {
    const src = dashboardSource();
    expect(src).toContain('s?.alumni_edited_this_month ?? "—"');
    expect(src).toContain('s?.alumni_edited_this_year ?? "—"');
  });

  it("declares the year count optional so the tile survives an undeployed backend", () => {
    // The field ships from fa-web-api separately; until then the summary simply
    // omits it and both figures must degrade to the em dash above.
    expect(dashboardSource()).toMatch(/alumni_edited_this_year\?: number;/);
  });

  it("keeps the strip three-across with exactly three tiles", () => {
    const src = dashboardSource();
    expect(src).toContain("sm:grid-cols-3");
    expect(src.match(/<MetricCard\b/g) ?? []).toHaveLength(3);
  });

  it("links each figure separately instead of wrapping the card in an anchor", () => {
    const src = dashboardSource();
    // Two distinct destinations-with-labels, both to the most-recently-edited
    // list, so a screen reader can tell the month link from the year link.
    expect(src).toContain(
      'aria-label="View alumni edited this month, sorted by most recently edited"',
    );
    expect(src).toContain(
      'aria-label="View alumni edited this year, sorted by most recently edited"',
    );
    // The pre-split card-level link must not come back — it would swallow both
    // figures in an outer anchor.
    expect(src).not.toContain(
      'linkLabel="View alumni sorted by most recently edited"',
    );
  });

  it("captions the two figures without implying a shared window", () => {
    // The tile to the left ("Contacted this month") is a rolling 30 days while
    // both of these are calendar windows, so the captions stay bare rather than
    // inviting a comparison the numbers can't support.
    const src = dashboardSource();
    expect(src).toContain(">This month</span>");
    expect(src).toContain(">This year</span>");
  });
});
