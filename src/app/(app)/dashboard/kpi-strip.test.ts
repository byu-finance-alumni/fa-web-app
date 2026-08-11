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

  it("keeps the strip three-across with exactly three tiles", () => {
    // A fourth tile silently reflows `sm:grid-cols-3` into a 3+1 orphan row and
    // lengthens the column, squeezing the Industry panel underneath it.
    const src = dashboardSource();
    expect(src).toContain("sm:grid-cols-3");
    expect(src.match(/<MetricCard\b/g) ?? []).toHaveLength(3);
  });

  it("labels the two edit tiles by their own window, not a bare shared label", () => {
    // Both are CALENDAR windows off `updated_at` and reset independently (the
    // month on the 1st, the year on Jan 1), so each tile has to name its own
    // window — "Alumni edited" alone would leave the two numbers looking like
    // the same measurement disagreeing with itself.
    const src = dashboardSource();
    expect(src).toContain('label="Alumni edited this month"');
    expect(src).toContain('label="Alumni edited this year"');
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
