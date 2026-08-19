import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Source-invariant guards for the alumnus profile's employment surfaces.
 *
 * #691 renamed the Overview panel to "Career history", took the current role out
 * of it, and listed every past role. The owner's review of that on dev asked for
 * three corrections, and all three are easy to undo by accident:
 *
 *  1. the current employer and job title are back on the Overview tab — #691 had
 *     left them with no home there at all;
 *  2. the Overview list is capped at the 3 most recent past roles, with the
 *     onward link shown only when the cap is hiding something, and never
 *     carrying a count;
 *  3. the Employment tab lists everything with no "view all" affordance — the
 *     reader is already at the destination.
 *
 * The panels are pure JSX in an async Server Component that fetches on render,
 * so there is nothing to mount in this Node-environment vitest setup and nothing
 * exported to call. They are asserted against the source text instead, at the
 * same altitude as `kpi-strip.test.ts` and `residence.test.ts`.
 */
const PAGE = "src/app/(app)/alumni/[id]/page.tsx";

const src = readFileSync(resolve(process.cwd(), PAGE), "utf8");
// Prettier wraps JSX across lines; compare on a whitespace-normalized copy so
// formatting churn never fails these guards.
const flat = src.replace(/\s+/g, " ");

/** The `employment={...}` tab prop, sliced out so a guard about the Employment
 *  tab cannot accidentally pass (or fail) on the Overview panel next door. */
const employmentTab = flat.slice(
  flat.indexOf("employment={"),
  flat.indexOf("education={"),
);

describe("Overview — current employer and job title", () => {
  it("names the employer and the title on the current-employment panel", () => {
    // #691 removed the current role from Career history; without these two rows
    // neither fact appears anywhere on the Overview tab.
    expect(flat).toContain('<Field label="Employer" value={employerLabel} />');
    expect(flat).toContain(
      '<Field label="Job title" value={career?.current_title ?? null} />',
    );
  });

  it("puts them above the industry pair", () => {
    // `<Field label="Industry"`, not `label="Industry"` — the KPI strip up the
    // page carries a MetricCard of the same name and would match first.
    const industry = flat.indexOf('<Field label="Industry"');
    expect(industry).toBeGreaterThan(-1);
    expect(flat.indexOf('<Field label="Employer"')).toBeLessThan(industry);
    expect(flat.indexOf('<Field label="Job title"')).toBeLessThan(industry);
  });

  it("renders the employer through employerDisplay, not the raw column", () => {
    // `employerLabel` is `employerDisplay(...)`, which turns a Military record's
    // branch into "Military/Air Force" (#608). The raw column would print a bare
    // "Air Force" and read as an ordinary company.
    expect(flat).not.toContain(
      '<Field label="Employer" value={career?.current_employer',
    );
    expect(flat).toContain("const employerLabel = employerDisplay(");
  });

  it("uses the panel's own Field row, so an empty value gets the em-dash", () => {
    // Field renders `value || "—"` in gray-300 — the page's standard empty
    // state. A bespoke row here would make a blank employer vanish.
    expect(flat).toContain(
      'function Field({ label, value }: { label: string; value: string | null })',
    );
  });
});

describe("Overview — Career history cap", () => {
  it("caps the panel at three past roles", () => {
    expect(src).toContain("const OVERVIEW_CAREER_HISTORY_LIMIT = 3;");
    expect(flat).toContain(
      "const overviewJobs = previousJobs.slice(0, OVERVIEW_CAREER_HISTORY_LIMIT);",
    );
  });

  it("renders the capped list, not the full one", () => {
    // The panel must map `overviewJobs`. Mapping `previousJobs` is exactly the
    // uncapped behaviour the owner asked us to change.
    expect(flat).toContain("{overviewJobs.length ? (");
    expect(flat).toContain("{overviewJobs.map((e) => (");
    expect(flat).not.toContain("{previousJobs.map((e) => (");
  });

  it("still lists PAST roles only, most recent first", () => {
    expect(flat).toContain(
      "const previousJobs = [...profile.employment_history] .filter((e) => !e.is_current)",
    );
  });

  it("keeps its own empty state for an alum with no past roles", () => {
    expect(src).toContain("No previous roles on file yet.");
  });
});

describe("Overview — the onward link", () => {
  it("shows the link only when the cap is hiding roles", () => {
    expect(flat).toContain(
      "const hasMorePreviousJobs = previousJobs.length > OVERVIEW_CAREER_HISTORY_LIMIT;",
    );
    expect(flat).toContain(
      '{hasMorePreviousJobs ? ( <Link href="?tab=employment"',
    );
  });

  it("keeps the wording, and keeps a count out of it", () => {
    expect(src).toContain("View full employment history →");
    // No "View all 5" — the owner asked for the plain wording.
    expect(flat).not.toMatch(/View full employment history \(/);
    expect(flat).not.toMatch(/View all \{/);
  });

  it("points at the Employment tab", () => {
    expect(src).toContain('href="?tab=employment"');
  });
});

describe("Employment tab", () => {
  it("lists the whole history with no cap", () => {
    expect(employmentTab).toContain('<ol className="space-y-1">');
    expect(employmentTab).toContain("{profile.employment_history.map((e) => (");
    expect(employmentTab).not.toContain("collapsed=");
  });

  it("offers no view-all affordance — the reader is already there", () => {
    // DrawerList is the only source of a "View all N" button on this page: it
    // shows `collapsed` rows inline and hides the rest behind a drawer. On the
    // tab that IS the full history that button hid rows and pointed at itself.
    expect(employmentTab).not.toContain("<DrawerList");
    expect(employmentTab).not.toContain("View full employment history");
  });

  it("still surfaces the current role above the history rows", () => {
    // The current role lives in current-employment, not employment_history, so
    // the tab has to add it or the current job is missing from the list.
    expect(employmentTab).toContain("{career ? (");
    expect(employmentTab.indexOf("{career ? (")).toBeLessThan(
      employmentTab.indexOf("{profile.employment_history.map((e) => ("),
    );
  });

  it("keeps its empty state", () => {
    expect(employmentTab).toContain("No employment history recorded yet.");
  });
});
