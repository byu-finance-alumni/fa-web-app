import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Source-invariant guards for the dashboard KPI strip.
 *
 * Jake, 2026-08-11: the strip is now Total alumni / Alumni edited this month /
 * Alumni edited this year. "Contacted this month" was dropped, which freed the
 * third slot — so the two edit counts, which used to be stacked inside ONE
 * split card (#645) precisely because a fourth tile would have orphaned the
 * three-across grid, are each a plain tile again.
 *
 * The strip is pure JSX in a Server Component with no extractable logic, so
 * there is nothing to unit-test by calling it — but a few properties are easy to
 * break by accident and expensive to notice, so they're asserted against the
 * source text (the same altitude as `session-invariants.test.ts`).
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

describe("dashboard KPI strip", () => {
  it("reads both the month and the year edit counts", () => {
    const src = dashboardSource();
    expect(src).toContain('s?.alumni_edited_this_month ?? "—"');
    expect(src).toContain('s?.alumni_edited_this_year ?? "—"');
  });

  it("declares both edit counts optional so the tiles survive an undeployed backend", () => {
    // These fields ship from fa-web-api separately; until then the summary
    // simply omits them and both tiles must degrade to an em dash.
    const src = dashboardSource();
    expect(src).toMatch(/alumni_edited_this_month\?: number;/);
    expect(src).toMatch(/alumni_edited_this_year\?: number;/);
  });

  it("keeps the strip a whole number of tiles across, with no orphan row", () => {
    // This guarded three tiles in a `sm:grid-cols-3` strip, because a fourth
    // would have reflowed into a 3+1 orphan row, lengthened the column and
    // squeezed the Industry panel underneath it. A fourth tile arrived
    // (Companies, 2026-08-20), so the COLUMNS moved with it rather than the
    // guard being deleted: the failure it protects against is a tile count and
    // a column count that disagree, whatever the numbers happen to be.
    const src = dashboardSource();
    const tiles = (src.match(/<MetricCard\b/g) ?? []).length;

    expect(tiles).toBe(4);
    expect(src).toContain("lg:grid-cols-4");
    // 2x2 at tablet rather than 4-up: four across there squeezes a six-figure
    // value and its sub-line into ~180px and the numbers wrap.
    expect(src).toContain("sm:grid-cols-2");
  });

  it("labels the two edit tiles by their own window, not a bare shared label", () => {
    // Both are CALENDAR windows off `updated_at` and reset independently (the
    // month on the 1st, the year on Jan 1), so each tile has to name its own
    // window — "Alumni edited" alone would leave the two numbers looking like
    // the same measurement disagreeing with itself.
    const src = dashboardSource();
    expect(src).toContain('label="Edited this month"');
    expect(src).toContain('label="Edited this year"');
  });

  it("derives every sub-line from a figure the summary returns", () => {
    // The tiles gained a context line under the value in the 2026-08-19
    // redesign. Each one has to be COMPUTED from `/dashboard/summary`, and has
    // to collapse to nothing when the figure behind it is missing — a hardcoded
    // percentage or industry count would be indistinguishable from a real one
    // on screen and wrong the moment the data moved.
    const src = dashboardSource();
    expect(src).toContain("breakdown.industries.filter((i) => i.count > 0)");
    expect(src).toContain("Math.round((n / totalAlumni) * 100)");
    // A share of an unknown or empty roster is not a number we can show.
    expect(src).toContain("n === undefined || !totalAlumni ? null");
    // Every sub-line is guarded by its own null check.
    expect(src).toContain("industriesWithAlumni === null");
    expect(src).toContain("editedMonthShare === null");
    expect(src).toContain("editedYearShare === null");
  });

  it("gives each edit tile a distinct link label", () => {
    // Both land on the same most-recently-edited list, so without distinct
    // labels a screen reader announces two identical links.
    const src = dashboardSource();
    expect(src).toContain(
      'linkLabel="View alumni edited this month, sorted by most recently edited"',
    );
    expect(src).toContain(
      'linkLabel="View alumni edited this year, sorted by most recently edited"',
    );
  });

  it("no longer renders the retired 'Contacted this month' tile", () => {
    // Dropped by Jake 2026-08-11. It was the one rolling-30-day figure in a
    // strip that is otherwise calendar-windowed, and its deep link was the only
    // consumer of the `contacted_after` date helper.
    const src = dashboardSource();
    expect(src).not.toContain('label="Contacted this month"');
    expect(src).not.toContain("contacted_after=");
  });
});
