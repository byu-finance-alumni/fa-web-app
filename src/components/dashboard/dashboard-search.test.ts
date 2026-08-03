import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

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

describe("designation tickboxes", () => {
  const src = read(SEARCH);

  it("offers all three: CFA, CFP, CPA", () => {
    // CFP was unsearchable until the backend grew a `cfp` param
    // (fa-web-api#363) even though the survey has collected it since #529.
    expect(paramsOf(src, "ENGAGEMENT")).toEqual([
      "attended",
      "donor",
      "mentor",
      "speaker",
      "cfa",
      "cfp",
      "cpa",
    ]);
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
  const roster = read("src/components/alumni/AlumniRoster.tsx");

  it("passes secondary_industry and employment_status through", () => {
    expect(roster).toContain('appendAll("employment_status", filters.employmentStatus)');
    expect(roster).toContain('appendAll("secondary_industry", filters.secondaryIndustry)');
  });

  it("passes the cfp flag through", () => {
    expect(roster).toContain('if (filters.cfp) params.set("cfp", "true")');
  });
});
