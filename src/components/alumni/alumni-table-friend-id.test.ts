import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Alumni } from "@/types/alumni";

/**
 * #538 — a friend of the program's visible id (`FRIEND-00042`) shows on their
 * list row, where an alumnus would have a Net ID; an alumnus (friend_id null)
 * renders nothing extra. Rendered to static HTML in Node with the two
 * app-router-only dependencies stubbed: `useRouter` (the row click) and the
 * per-row action menu (which pulls in server actions the test runner cannot
 * load, and is not rendered for a read-only viewer anyway).
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {} }),
}));
vi.mock("@/components/alumni/AlumniRowActions", () => ({
  AlumniRowActions: () => null,
}));

const { AlumniTable } = await import("@/components/alumni/AlumniTable");

function person(overrides: Partial<Alumni> = {}): Alumni {
  const base = {
    alumni_id: 42,
    source_id: null,
    byu_id: null,
    mst_id: null,
    net_id: null,
    first_name: "Pat",
    middle_name: null,
    last_name: "Jones",
    preferred_first_name: null,
    birth_name: null,
    gender: null,
    birth_year: null,
    birth_date: null,
    graduation_year: null,
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
  };
  // The two ids are `readonly` on the generated schema; the spread keeps the
  // override typed without a cast at every call site.
  return { ...base, ...overrides } as Alumni;
}

const render = (items: Alumni[]) =>
  renderToStaticMarkup(createElement(AlumniTable, { items }));

describe("the alumni list shows a friend's id (#538)", () => {
  it("renders FRIEND-00042 on a friend row", () => {
    const html = render([
      person({ alumni_id: 42, is_alumni: false, friend_id: "FRIEND-00042" }),
    ]);
    expect(html).toContain("Jones, Pat");
    expect(html).toContain("FRIEND-00042");
  });

  it("renders nothing extra on an alumnus row", () => {
    const html = render([
      person({ alumni_id: 7, net_id: "pjones", friend_id: null }),
    ]);
    expect(html).toContain("Jones, Pat");
    expect(html).not.toContain("FRIEND");
    // The Net ID is deliberately NOT a list column; the friend id fills the
    // gap only for records that have no Net ID at all.
    expect(html).not.toContain("pjones");
  });
});

describe("the profile header shows a friend's id (#538)", () => {
  it("renders friend_id from the record, guarded on it being set", () => {
    // The profile page is a server component with data loaders the Node
    // runner cannot exercise, so this is a source guard: the header reads
    // `a.friend_id` and renders it only when present.
    const src = readFileSync("src/app/(app)/alumni/[id]/page.tsx", "utf8");
    expect(src).toMatch(/\{a\.friend_id \? \(\s*<p[^>]*>\s*\{a\.friend_id\}/);
  });
});
