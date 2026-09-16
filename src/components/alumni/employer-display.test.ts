import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { Alumni } from "@/types/alumni";

/**
 * The employer column shows `employer_display`, never `current_employer` (#536).
 *
 * The backend derives `employer_display` for every alumni read: the company when
 * there is one, otherwise the employment status for the non-employed statuses
 * (Graduate Student, Military, Not in the Labor Force, Unemployed, Unknown),
 * otherwise null. The rule lives there ONLY — the same function feeds the CSV
 * export — so every UI surface that names the person's employer renders the
 * field as given and computes nothing. The stored `current_employer` stays what
 * the edit form edits and what the `employer` filter and sort key on.
 *
 * The desktop list table is rendered for real below (react-dom/server, with the
 * app router hook stubbed — the table only needs `router.push` on a row click).
 * The remaining rows live inside stateful client components with fetches
 * (spouse picker, quick-log picker, the map's country drill-down) or an async
 * Server Component (the profile), so they are guarded on their source text at
 * the same altitude as `career-history.test.ts`.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
}));

/** A complete list row. Every field the generated `AlumniListItem` requires is
 *  present so the fixture cannot drift from the contract silently. */
function row(overrides: Partial<Alumni>): Alumni {
  return {
    alumni_id: 42,
    source_id: null,
    byu_id: null,
    mst_id: null,
    net_id: null,
    first_name: "Ada",
    middle_name: null,
    last_name: "Lovelace",
    preferred_first_name: null,
    birth_name: null,
    gender: null,
    birth_year: null,
    birth_date: null,
    graduation_year: 2020,
    graduation_semester: null,
    graduation_class: null,
    finance_program_year: null,
    graduate_degree: null,
    graduate_graduation_year: null,
    citizenship: null,
    marital_status: null,
    hometown: null,
    home_country: null,
    employment_status: null,
    other_designations: null,
    survey_completed_date: null,
    profile_updated_date: null,
    profile_updated_by: null,
    profile_updated_by_name: null,
    mba_program: null,
    law_school: null,
    medical_school: null,
    graduate_school: null,
    startup_involvement: null,
    advisory_roles: null,
    secondary_employment: null,
    spouse_first_name: null,
    spouse_last_name: null,
    spouse_birth_date: null,
    spouse_alumni_id: null,
    deceased: false,
    is_alumni: true,
    linkedin_url: null,
    notes: null,
    archived: false,
    manually_edited_at: null,
    last_imported_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    current_employer: null,
    current_industry: null,
    current_industry_secondary: null,
    current_city: null,
    current_state: null,
    friend_id: null,
    employer_display: null,
    ...overrides,
  };
}

/** The Graduate Student case: no company on file, so the backend fills the
 *  display value with the status label. */
const gradStudent = row({
  employment_status: "Graduate Student",
  current_employer: null,
  employer_display: "Graduate Student",
});

/** The employed case: the company wins and the status never shows here. */
const employed = row({
  employment_status: "Full-time",
  current_employer: "Goldman Sachs",
  employer_display: "Goldman Sachs",
});

async function renderTable(items: Alumni[]): Promise<string> {
  const { AlumniTable } = await import("./AlumniTable");
  return renderToStaticMarkup(createElement(AlumniTable, { items }));
}

/** The cells of the first body row, in column order, with tags stripped. */
function firstRowCells(html: string): string[] {
  const body = html.slice(html.indexOf("<tbody"));
  const tr = body.slice(body.indexOf("<tr"), body.indexOf("</tr>"));
  return [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) =>
    m[1].replace(/<[^>]+>/g, "").trim(),
  );
}

describe("AlumniTable employer column (#536)", () => {
  it("renders the status when there is no company", async () => {
    const cells = firstRowCells(await renderTable([gradStudent]));
    // Name · year · gender · EMPLOYER · industry · city · state · updated · LinkedIn
    expect(cells[3]).toBe("Graduate Student");
  });

  it("renders the company when both are set", async () => {
    const cells = firstRowCells(await renderTable([employed]));
    expect(cells[3]).toBe("Goldman Sachs");
    expect(cells).not.toContain("Full-time");
  });

  it("falls back to the em-dash when the backend sends null", async () => {
    // An employed status with no company is a data gap, and the backend sends
    // null rather than guessing. The cell shows the page's standard blank.
    const cells = firstRowCells(
      await renderTable([
        row({ employment_status: "Full-time", employer_display: null }),
      ]),
    );
    expect(cells[3]).toBe("—");
  });

  it("does not read the stored column for display", () => {
    // Belt and braces for the render above: with `current_employer: null` and
    // `employer_display` set, a regression to the stored column would have
    // shown an em-dash — but guard the source too so the intent is legible.
    const src = readFileSync(
      resolve(process.cwd(), "src/components/alumni/AlumniTable.tsx"),
      "utf8",
    );
    expect(src).toContain("a.employer_display ??");
    expect(src).not.toMatch(/\{a\.current_employer/);
  });
});

/**
 * The search-result rows: the roster's phone cards, the spouse picker, the
 * dashboard quick-log picker and the opportunity-link alumnus picker all build a
 * "Class of 2020 · <employer>" subline from the same list item. Each must read
 * `employer_display` and none may still read `current_employer`.
 */
describe("search-result sublines read employer_display (#536)", () => {
  const files = [
    "src/components/alumni/AlumniRoster.tsx",
    "src/components/alumni/SpousePicker.tsx",
    "src/components/dashboard/QuickLogButton.tsx",
    "src/app/(app)/links/actions.ts",
  ];

  it.each(files)("%s", (file) => {
    const src = readFileSync(resolve(process.cwd(), file), "utf8");
    expect(src).toContain("a.employer_display");
    expect(src).not.toContain("a.current_employer");
  });
});

describe("map country drill-down rows read employer_display (#536)", () => {
  const src = readFileSync(
    resolve(process.cwd(), "src/components/geography/GeographyExplorer.tsx"),
    "utf8",
  );
  const flat = src.replace(/\s+/g, " ");

  it("joins title and employer_display on the alumnus line", () => {
    expect(flat).toContain(
      '{[a.current_title, a.employer_display] .filter(Boolean) .join(" · ")}',
    );
  });

  it("gates the line on employer_display, so a Graduate Student still gets one", () => {
    expect(flat).toContain("{a.employer_display || a.current_title ? (");
    expect(src).not.toContain("a.current_employer");
  });
});
