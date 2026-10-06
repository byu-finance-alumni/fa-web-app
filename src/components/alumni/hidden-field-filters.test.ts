import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  EMPTY_FILTERS,
  EMPTY_PASS_THROUGH,
  parseAlumniFilters,
  parsePassThroughFilters,
  toAlumniPopulationParams,
  withoutHiddenFieldFilters,
} from "@/lib/alumniFilterParams";
import { toExportFilters } from "@/lib/exportFilters";

/**
 * Filters on fields hidden below the edit tier (2026-10-02 breach test).
 *
 * The backend now SILENTLY IGNORES `gender=`, `sort=gender` and `net_id=`
 * (except a friend id) from a viewer without `can_edit_alumni`, because a
 * filter on a hidden field is an oracle for its value. The app must therefore
 * (a) not offer those controls to such a viewer, and (b) not describe — in a
 * chip, a sort indicator or, above all, the export body — a predicate the list
 * never applied. (b) is the #592 parity rule: the export derives from the same
 * state the roster renders, so stripping it once, in the shared module, keeps
 * every consumer honest.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

const DEEP_LINK = {
  gender: "F",
  sort: "gender",
  net_id: "jdoe12",
  ymin: "2018",
};

describe("withoutHiddenFieldFilters", () => {
  it("drops gender, the gender sort and a Net ID search", () => {
    const { filters, passThrough } = withoutHiddenFieldFilters(
      parseAlumniFilters(DEEP_LINK),
      parsePassThroughFilters(DEEP_LINK),
    );
    expect(filters.gender).toBe("");
    expect(filters.sort).toBe("name");
    expect(passThrough.net_id).toBe("");
    // Everything else is untouched.
    expect(filters.ymin).toBe("2018");
  });

  it("keeps any other sort", () => {
    const f = { ...EMPTY_FILTERS, sort: "employer" as const };
    expect(withoutHiddenFieldFilters(f, EMPTY_PASS_THROUGH).filters.sort).toBe(
      "employer",
    );
  });

  it.each(["FRIEND-00042", "friend42", "Friend 42", "friend_0042", " FRIEND-42 "])(
    "keeps a friend id (%s) — a visible field the backend still honours",
    (net_id) => {
      const pt = { ...EMPTY_PASS_THROUGH, net_id };
      expect(withoutHiddenFieldFilters(EMPTY_FILTERS, pt).passThrough.net_id).toBe(
        net_id,
      );
    },
  );

  it.each(["jdoe12", "friendly", "friend-", "a"])(
    "drops a non-friend Net ID value (%s)",
    (net_id) => {
      const pt = { ...EMPTY_PASS_THROUGH, net_id };
      expect(withoutHiddenFieldFilters(EMPTY_FILTERS, pt).passThrough.net_id).toBe("");
    },
  );

  it("keeps the export on the population the list actually returned (#592)", () => {
    const { filters, passThrough } = withoutHiddenFieldFilters(
      parseAlumniFilters(DEEP_LINK),
      parsePassThroughFilters(DEEP_LINK),
    );
    const params = toAlumniPopulationParams(filters, "alumni", passThrough);
    expect(params.has("gender")).toBe(false);
    expect(params.has("net_id")).toBe(false);
    const body = toExportFilters(filters, "alumni", passThrough);
    expect(JSON.stringify(body)).not.toMatch(/jdoe12|"gender":"F"/);
    expect(body.grad_year_min).toBe(2018);
  });

  it("is applied by the roster before the panel, chips, sort and export see it", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/components/alumni/AlumniRoster.tsx"),
      "utf8",
    );
    expect(src).toContain("withoutHiddenFieldFilters(filters, passThrough)");
    expect(src).toContain("initial={visible.filters}");
    expect(src).toContain("passThrough={visible.passThrough}");
    expect(src).toContain("sort={visible.filters.sort}");
    expect(src).toContain("canUseHiddenFields={canEditRows}");
    expect(src).toContain("showGender={canEditRows}");
  });
});

describe("the controls are not offered below the edit tier", () => {
  async function table(showGender: boolean) {
    const { AlumniTable } = await import("./AlumniTable");
    return renderToStaticMarkup(
      createElement(AlumniTable, { items: [], showGender }),
    );
  }

  it("AlumniTable hides the Gender column and its sort header", async () => {
    expect(await table(false)).not.toContain("Gender");
    expect(await table(false)).not.toContain("sort=gender");
    expect(await table(true)).toContain("Gender");
    expect(await table(true)).toContain("sort=gender");
  });

  async function filters(canUseHiddenFields: boolean) {
    const { AlumniFilters } = await import("./AlumniFilters");
    return renderToStaticMarkup(
      createElement(AlumniFilters, {
        initial: { ...EMPTY_FILTERS, gender: "F" },
        canUseHiddenFields,
      }),
    );
  }

  it("AlumniFilters drops the gender sort option and chip", async () => {
    const hidden = await filters(false);
    expect(hidden).not.toContain("Sort: Gender");
    expect(hidden).not.toContain("Gender: Female");
    const shown = await filters(true);
    expect(shown).toContain("Sort: Gender");
    expect(shown).toContain("Gender: Female");
  });

  it("AlumniFilters gates the gender picker on the same flag", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/components/alumni/AlumniFilters.tsx"),
      "utf8",
    );
    const picker = src.indexOf('aria-label="Filter by gender"');
    const gate = src.lastIndexOf("{canUseHiddenFields ? (", picker);
    expect(gate).toBeGreaterThan(-1);
    expect(picker - gate).toBeLessThan(600);
  });

  async function dashboard(canUseHiddenFields: boolean) {
    const { DashboardSearch } = await import(
      "@/components/dashboard/DashboardSearch"
    );
    const { EMPTY_FILTER_OPTIONS } = await import("@/lib/emptyFilterOptions");
    return renderToStaticMarkup(
      createElement(DashboardSearch, {
        options: EMPTY_FILTER_OPTIONS,
        canUseHiddenFields,
      }),
    );
  }

  it("DashboardSearch drops the Net ID box and the gender picker", async () => {
    const hidden = await dashboard(false);
    expect(hidden).not.toContain("Net ID");
    expect(hidden).not.toContain("Filter by gender");
    expect(hidden).toContain("First name");
    const shown = await dashboard(true);
    expect(shown).toContain("Net ID");
    expect(shown).toContain("Filter by gender");
  });

  it("the dashboard passes the edit-tier test, not a guess", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/app/(app)/dashboard/page.tsx"),
      "utf8",
    );
    expect(src).toContain("canUseHiddenFields={canEditAlumni(ctx?.roles)}");
  });
});
