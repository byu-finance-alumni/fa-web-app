import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { quickSearchHref } from "@/components/dashboard/DashboardSearch";
import {
  EMPTY_FILTERS,
  parseAlumniFilters,
  toAlumniPopulationParams,
} from "@/lib/alumniFilterParams";

/**
 * The dashboard search-panel restructure (#584).
 *
 * `DashboardSearch` is a client component whose layout IS its two const arrays:
 * both grids fill row-major, so the ORDER of `IDENTITY_FIELDS` and `FACETS`
 * decides what sits next to what on screen. Tanya signed off on exact pairings,
 * so a well-meaning alphabetical sort or a "just append it" addition would
 * silently rearrange the panel. These assert against the source text (same
 * approach as `src/lib/designations.test.ts`) because the arrays aren't
 * exported and the pairing is the thing worth pinning, not the render output.
 */

const root = (relPath: string) => resolve(process.cwd(), relPath);
const read = (relPath: string): string => readFileSync(root(relPath), "utf8");

const SEARCH = "src/components/dashboard/DashboardSearch.tsx";

/** Pull `key: "…"` values, in order, out of one `const NAME … ];` block. */
function keysOf(src: string, name: string): string[] {
  const start = src.indexOf(`const ${name}`);
  expect(start, `${name} not found`).toBeGreaterThan(-1);
  const block = src.slice(start, src.indexOf("];", start));
  return [...block.matchAll(/\bkey: "([^"]+)"/g)].map((m) => m[1]);
}

/** Pull `param: "…"` values, in order, out of one `const NAME … ];` block. */
function paramsOf(src: string, name: string): string[] {
  const start = src.indexOf(`const ${name}`);
  const block = src.slice(start, src.indexOf("];", start));
  return [...block.matchAll(/\bparam: "([^"]+)"/g)].map((m) => m[1]);
}

describe("identity fields (Quick + Advanced)", () => {
  const src = read(SEARCH);

  it("lays out first/last over preferred/Net ID", () => {
    // Row-major in a 2-col grid: [0][1] is row 1, [2][3] is row 2. Preferred
    // name must land under First name, Net ID under Last name.
    expect(keysOf(src, "IDENTITY_FIELDS")).toEqual([
      "first_name",
      "last_name",
      "preferred_name",
      "net_id",
    ]);
  });

  it("no longer offers an Email search field", () => {
    // Dropped in #584 — the alumni list's free-text `q` already matches email,
    // and a dedicated box made the identity grid an odd 5 fields.
    expect(src).not.toContain('key: "email"');
    expect(src).not.toContain('type="email"');
  });
});

describe("advanced facets", () => {
  const src = read(SEARCH);

  it("keeps Tanya's exact field order and pairings", () => {
    expect(paramsOf(src, "FACETS")).toEqual([
      // Employment Status leads, full-width — it is NOT paired with Status
      // Label, which is a survey-suppression flag, not an employment value.
      "employment_status",
      "employer",
      "industry",
      "past_employer",
      "secondary_industry",
      "city",
      "state",
      "title",
      "status_label",
      "leadership_role",
      "tag",
    ]);
  });

  it("keeps Employment Status and Status Label as separate facets", () => {
    // Jake's call: merging them would put Military/Unemployed into the list
    // that drives survey suppression (fa-web-api#354).
    const keys = keysOf(src, "FACETS");
    expect(keys).toContain("employmentStatus");
    expect(keys).toContain("statusLabel");
  });

  it("drops Seniority entirely", () => {
    // Matched on the wiring, not the word — the FACETS doc comment explains why
    // "FS Leadership Role" is spelled out (so it doesn't read as a seniority
    // level), and that prose is allowed to survive.
    expect(src).not.toContain('param: "seniority"');
    expect(src).not.toContain('optKey: "seniority_levels"');
  });

  it("labels city/state as the EMPLOYER's location", () => {
    // They bind to the employment record, not a home address (fa-web-api#287) —
    // a bare "City" reads as "where they live", which we don't store.
    expect(src).toContain('label: "Employment City"');
    expect(src).toContain('label: "Employment State"');
  });

  it("spells out that the leadership role is Finance Society's", () => {
    expect(src).toContain('label: "FS Leadership Role"');
  });

  it("only Employment Status spans the full grid width", () => {
    expect(src.match(/wide: true/g)).toHaveLength(1);
  });
});

describe("quick search: gender (#644 / #594)", () => {
  const NOBODY = {
    first_name: "",
    last_name: "",
    preferred_name: "",
    net_id: "",
  };
  const ANY_YEAR = { ymin: "", ymax: "" };

  /** The emitted href's querystring, back as a search-param map — the exact
   *  shape the roster's `parseAlumniFilters` receives from Next. */
  function spOf(href: string) {
    const qs = new URLSearchParams(href.split("?")[1] ?? "");
    const sp: Record<string, string | string[]> = {};
    for (const key of new Set(qs.keys())) {
      const all = qs.getAll(key);
      sp[key] = all.length > 1 ? all : all[0];
    }
    return sp;
  }

  it("emits gender=F, alongside whatever else is filled in", () => {
    const href = quickSearchHref(
      { ...NOBODY, last_name: "Nguyen" },
      { ymin: "2015", ymax: "2020" },
      "F",
      false,
    );
    const sp = spOf(href);
    expect(href.startsWith("/alumni?")).toBe(true);
    expect(sp.gender).toBe("F");
    // The pre-existing params are untouched — gender narrows WITH them, it
    // doesn't replace them (Amy's ask is "women in this cohort", not "women").
    expect(sp.last_name).toBe("Nguyen");
    expect(sp.ymin).toBe("2015");
    expect(sp.ymax).toBe("2020");
  });

  it("writes no gender param at all when the picker is left on All", () => {
    // "" must be the ABSENCE of the param. `gender=` would reach the backend as
    // a set-but-empty predicate — the `is_alumni: null` class of bug that made
    // the CSV export cover 19 people the list was excluding (#592).
    const href = quickSearchHref({ ...NOBODY, first_name: "Amy" }, ANY_YEAR, "", false);
    expect(href).toBe("/alumni?first_name=Amy");
    expect(href).not.toContain("gender");
  });

  it("carries gender onto the Friends roster too", () => {
    // /friends renders the SAME `AlumniRoster` through the same parser, so the
    // toggle only swaps `kind`; it must not quietly drop the filter.
    const href = quickSearchHref(NOBODY, ANY_YEAR, "F", true);
    expect(href).toBe("/friends?gender=F");
  });

  it("survives the roster's parse and reaches the API as gender=F", () => {
    // The roster honours a URL param only if the filter model knows it —
    // anything else is dropped silently and the control looks broken. `gender`
    // is modelled (not a PASS_THROUGH), so it round-trips on BOTH rosters and
    // the Filters slide-over re-serializes rather than wipes it.
    const sp = spOf(quickSearchHref(NOBODY, ANY_YEAR, "F", false));
    const filters = parseAlumniFilters(sp);
    expect(filters.gender).toBe("F");
    expect(toAlumniPopulationParams(filters, "alumni").get("gender")).toBe("F");
    expect(toAlumniPopulationParams(filters, "friend").get("gender")).toBe("F");
  });

  it("offers exactly the two stored codes, defaulting to blank", () => {
    const src = read(SEARCH);
    // The column stores one letter and the backend matches on the first letter
    // of the stored value, so M/F is the whole vocabulary — a third option
    // would be a data question, not a UI one.
    expect(src).toContain('<option value="">All</option>');
    expect(src).toContain('<option value="F">Female (F)</option>');
    expect(src).toContain('<option value="M">Male (M)</option>');
    expect(src.match(/<option value="[MF]"/g)).toHaveLength(2);
  });

  it("clears gender on Reset", () => {
    // Reset has to clear EVERY quick field; a survivor silently narrows the
    // next search the user thinks they started fresh.
    const src = read(SEARCH);
    const reset = src.slice(
      src.indexOf("function resetQuick"),
      src.indexOf("function runAdvanced"),
    );
    expect(reset).toContain('setQuickGender("")');
  });
});

describe("designation tickboxes", () => {
  const src = read(SEARCH);

  it("offers CFA and CFP, but not CPA (#605)", () => {
    // CFP was unsearchable until the backend grew a `cfp` param
    // (fa-web-api#363) even though the survey has collected it since #529.
    //
    // CPA came back out: no alumni hold one, so the tickbox could only ever
    // return zero results. SEARCH-ONLY — the survey still collects it, the
    // profile still shows it, and the backend still accepts the `cpa` param.
    expect(paramsOf(src, "ENGAGEMENT")).toEqual([
      "attended",
      "donor",
      "mentor",
      "speaker",
      "cfa",
      "cfp",
    ]);
  });

  it("leaves no CPA control behind on the dashboard search card", () => {
    expect(src).not.toContain('param: "cpa"');
    expect(src).not.toContain('label: "CPA designation"');
  });
});

describe("quick filters are gone (#584)", () => {
  it("leaves no preset block on the dashboard search card", () => {
    const src = read(SEARCH);
    expect(src).not.toContain("Quick filters");
    expect(src).not.toContain("Shortcut");
    expect(src).not.toContain("alumniShortcuts");
    // The block was the component's only <Link>; a stray import would linger.
    expect(src).not.toContain("next/link");
  });

  it("removes the admin editor, its route, and its type", () => {
    // The whole feature was cut, not just its dashboard surface — leaving the
    // editor reachable would let staff curate presets nothing renders.
    for (const p of [
      "src/app/(app)/admin/quick-filters/page.tsx",
      "src/app/(app)/admin/quick-filters/actions.ts",
      "src/components/admin/QuickFiltersManager.tsx",
      "src/types/dashboardPresets.ts",
    ]) {
      expect(existsSync(root(p)), `${p} should be deleted`).toBe(false);
    }
  });

  it("removes the engineer nav entry", () => {
    const nav = read("src/components/shell/nav.ts");
    expect(nav).not.toContain("/admin/quick-filters");
    expect(nav).not.toContain("Quick filters");
  });

  it("stops fetching the presets endpoint from the dashboard", () => {
    const page = read("src/app/(app)/dashboard/page.tsx");
    expect(page).not.toContain("/dashboard/presets");
    expect(page).not.toContain("DashboardPreset");
  });
});

describe("the alumni list forwards the new params (#584)", () => {
  // The dashboard only ever navigates to /alumni; the roster re-maps the URL
  // onto the API call, so a param it doesn't know about is silently dropped and
  // the facet looks broken rather than erroring.
  //
  // These originally arrived as PASS-THROUGHS read straight off `sp`, which
  // shipped a worse bug: the list's own Filters slide-over rebuilds the whole
  // querystring from its model, so one click deleted all three. They now go
  // through the shared filter model instead — see `alumniFilterParams.test.ts`
  // for the round trip that pins it.
  //
  // Since #592 the roster no longer hand-writes the API querystring either: it
  // asks `toAlumniPopulationParams` (shared with the CSV export) for it. So
  // these assert on the params that builder emits, not on the roster's source.
  const roster = read("src/components/alumni/AlumniRoster.tsx");

  it("builds the API call from the shared population definition", () => {
    expect(roster).toContain(
      "toAlumniPopulationParams(filters, kind, passThrough)",
    );
  });

  it("passes secondary_industry and employment_status through", () => {
    const p = toAlumniPopulationParams({
      ...EMPTY_FILTERS,
      employmentStatus: ["Full-time"],
      secondaryIndustry: ["Private Equity"],
    });
    expect(p.getAll("employment_status")).toEqual(["Full-time"]);
    expect(p.getAll("secondary_industry")).toEqual(["Private Equity"]);
  });

  it("passes the cfp flag through", () => {
    expect(
      toAlumniPopulationParams({ ...EMPTY_FILTERS, cfp: true }).get("cfp"),
    ).toBe("true");
  });
});

/**
 * The advanced field block must FILL the card, not be capped.
 *
 * A height cap has been added to this block twice and tuned twice — it existed
 * because the dashboard row used to be sized by its content, and ~900px of
 * facets here made the page jump on every tab switch. The row is bounded by the
 * window now, so the cap only ever leaves dead space: on a 1980x1440 screen it
 * held the fields at 320px and left 618px of white under them (Jake, 2026-08-22).
 *
 * This is the guard against it coming back a third time. If a jump on tab switch
 * ever returns, the fix is in the ROW's bounding, not a cap here.
 */
describe("advanced search fills the card", () => {
  const src = readFileSync(
    resolve(__dirname, "DashboardSearch.tsx"),
    "utf-8",
  );
  // The scroll container, matched the way the component writes it: the one
  // className carrying the inner scroll.
  const fieldBlock = src.match(/className="[^"]*lg:overflow-y-auto[^"]*"/)?.[0];

  it("has a scroll container that grows and shrinks with the card", () => {
    expect(fieldBlock).toBeDefined();
    // flex-1 to take the free height, min-h-0 so it may shrink below its
    // content, overflow-y-auto so the remainder scrolls rather than overflowing.
    expect(fieldBlock).toContain("lg:flex-1");
    expect(fieldBlock).toContain("lg:min-h-0");
    expect(fieldBlock).toContain("lg:overflow-y-auto");
  });

  it("carries no height cap", () => {
    expect(fieldBlock).not.toMatch(/lg:max-h-/);
  });
});
