import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  BOOLEAN_FLAGS,
  EMPTY_FILTERS,
  FACETS,
  FIXED_FACET_OPTIONS,
  PASS_THROUGH_PARAMS,
  countActiveFilters,
  facetOptions,
  parseAlumniFilters,
  toAlumniFilterQs,
  type AlumniFilterState,
  type SearchParamMap,
} from "./alumniFilterParams";
import { EMPLOYMENT_STATUS_OPTIONS } from "@/constants/dropdowns";
import type { FilterOptions } from "@/types/filters";
import { toExportFilters } from "./exportFilters";

/**
 * The alumni list's filter round trip.
 *
 * The regression these exist for: `cfp`, `secondary_industry` and
 * `employment_status` shipped as deep-link params, but the Filters slide-over's
 * model didn't carry them. The panel builds a FRESH querystring from its own
 * state on every interaction and `router.replace()`s it — so toggling any
 * unrelated control silently deleted all three and widened a 1-row filtered view
 * to 246 rows, with no error and (worse) no control on that screen to put them
 * back.
 *
 * So the invariant under test is not "these three params exist" but
 * "serialize → parse is lossless for everything the model claims to own", plus a
 * structural guard that a param the roster forwards to the API is either owned
 * by the model or an explicitly accepted casualty.
 */

/** A Next.js-shaped searchParams object: a bare string for a param that appears
 *  once, a string[] once it repeats. */
function toSearchParams(qs: string): SearchParamMap {
  const sp: SearchParamMap = {};
  for (const [k, v] of new URLSearchParams(qs)) {
    const prev = sp[k];
    if (prev === undefined) sp[k] = v;
    else if (Array.isArray(prev)) prev.push(v);
    else sp[k] = [prev, v];
  }
  return sp;
}

/** Round trip: state → querystring → state. */
const roundTrip = (f: AlumniFilterState): AlumniFilterState =>
  parseAlumniFilters(toSearchParams(toAlumniFilterQs(f)));

/** Every field the model owns, set to a non-default value. `needsSurvey` stays
 *  false on purpose — the /needs-surveying ROUTE owns it and the URL never
 *  carries it, so it is the one field that legitimately doesn't round-trip. */
const MAXIMAL: AlumniFilterState = {
  q: "hansen",
  ymin: "2008",
  ymax: "2015",
  employmentStatus: ["Employed", "Self-Employed"],
  pastEmployer: ["Goldman Sachs"],
  industry: ["Investment Banking"],
  secondaryIndustry: ["Private Equity", "Venture Capital"],
  title: ["Analyst"],
  seniority: ["Senior"],
  city: ["Provo"],
  state: ["UT"],
  tag: ["Mentor"],
  statusLabel: ["Retired"],
  leadership: ["President"],
  surveyStatus: ["Sent"],
  designations: ["CFA", "CFP"],
  gender: "F",
  industryGroup: "other",
  contactedAfter: "2024-01-01",
  contactedBefore: "2026-01-01",
  neverContacted: true,
  attended: true,
  donor: true,
  mentor: true,
  speaker: true,
  cfa: true,
  cfp: true,
  cpa: true,
  graduateDegree: true,
  archived: true,
  deceased: "exclude",
  missingEmail: true,
  missingEmployer: true,
  duplicate: true,
  needsSurvey: false,
  sort: "grad_desc",
};

/* ------------------------------------------------- the reported regression -- */

describe("the dashboard deep link survives the Filters panel", () => {
  // Verbatim repro: the dashboard's Advanced search produced this URL (1 result),
  // then ticking "Never contacted" in the list's own slide-over re-serialized the
  // panel's state over the top and left only `?never_contacted=1` (246 results).
  const DEEP_LINK =
    "employment_status=Employed&secondary_industry=Private+Equity&cfp=1";

  it("re-serializes all three new params after an unrelated toggle", () => {
    const parsed = parseAlumniFilters(toSearchParams(DEEP_LINK));
    // What the panel does when a user ticks a checkbox: mutate its state, then
    // rebuild the ENTIRE querystring from it.
    const afterToggle = toAlumniFilterQs({ ...parsed, neverContacted: true });
    const sp = new URLSearchParams(afterToggle);

    expect(sp.get("employment_status")).toBe("Employed");
    expect(sp.get("secondary_industry")).toBe("Private Equity");
    expect(sp.get("cfp")).toBe("1");
    expect(sp.get("never_contacted")).toBe("1");
  });

  it("reads the deep link into real filter state, not silence", () => {
    const f = parseAlumniFilters(toSearchParams(DEEP_LINK));
    expect(f.employmentStatus).toEqual(["Employed"]);
    expect(f.secondaryIndustry).toEqual(["Private Equity"]);
    expect(f.cfp).toBe(true);
  });

  it("counts all three toward the Filters badge", () => {
    // They were invisible in the count too, so nothing on screen hinted the view
    // was narrowed — or, after the drop, that it had stopped being narrowed.
    const f = parseAlumniFilters(toSearchParams(DEEP_LINK));
    expect(countActiveFilters(f)).toBe(3);
  });

  it("lets Clear all clear them", () => {
    expect(toAlumniFilterQs(EMPTY_FILTERS)).toBe("");
    expect(countActiveFilters(EMPTY_FILTERS)).toBe(0);
  });
});

/* --------------------------------------------------------- the round trip -- */

describe("serialize → parse is lossless", () => {
  it("round-trips every field the model owns", () => {
    expect(roundTrip(MAXIMAL)).toEqual(MAXIMAL);
  });

  it("round-trips an empty state to an empty querystring and back", () => {
    expect(toAlumniFilterQs(EMPTY_FILTERS)).toBe("");
    expect(parseAlumniFilters({})).toEqual(EMPTY_FILTERS);
  });

  it("round-trips each multi-select facet on its own", () => {
    for (const facet of FACETS) {
      const f = { ...EMPTY_FILTERS, [facet.key]: ["one", "two"] };
      expect(roundTrip(f), `${facet.param} was dropped`).toEqual(f);
      expect(toAlumniFilterQs(f)).toContain(`${facet.param}=one`);
    }
  });

  it("round-trips each boolean flag on its own", () => {
    for (const flag of BOOLEAN_FLAGS) {
      const f = { ...EMPTY_FILTERS, [flag.key]: true };
      expect(roundTrip(f), `${flag.param} was dropped`).toEqual(f);
      expect(toAlumniFilterQs(f)).toContain(`${flag.param}=1`);
    }
  });

  it("keeps every repeated value of a multi-value facet", () => {
    const f = {
      ...EMPTY_FILTERS,
      secondaryIndustry: ["Private Equity", "Venture Capital", "Hedge Fund"],
    };
    expect(roundTrip(f).secondaryIndustry).toEqual(f.secondaryIndustry);
  });

  it("counts one per selected value, so the badge tracks the facets", () => {
    expect(
      countActiveFilters({
        ...EMPTY_FILTERS,
        employmentStatus: ["Employed", "Unemployed"],
        secondaryIndustry: ["Private Equity"],
        cfp: true,
      }),
    ).toBe(4);
  });

  it("accepts `true` as well as `1` on an incoming boolean", () => {
    // The dashboard emits `=1`; hand-written and older links use `=true`.
    expect(parseAlumniFilters({ cfp: "true" }).cfp).toBe(true);
    expect(parseAlumniFilters({ cfp: "1" }).cfp).toBe(true);
    expect(parseAlumniFilters({ cfp: "0" }).cfp).toBe(false);
  });
});

/* ------------------------------------------- the two designation mechanisms -- */

describe("the cfa/cfp/cpa booleans stay distinct from the designations facet", () => {
  // `designations=` is an OR multi-select (#404) — holding ANY picked one
  // matches. The booleans each AND-narrow to holders of that single one. Merging
  // them would silently change what a saved link returns.
  it("emits different params for each mechanism", () => {
    const qs = toAlumniFilterQs({
      ...EMPTY_FILTERS,
      designations: ["CFP"],
      cfp: true,
    });
    const sp = new URLSearchParams(qs);
    expect(sp.getAll("designations")).toEqual(["CFP"]);
    expect(sp.get("cfp")).toBe("1");
  });

  it("does not let one mechanism set the other", () => {
    expect(parseAlumniFilters({ designations: "CFP" }).cfp).toBe(false);
    expect(parseAlumniFilters({ cfp: "1" }).designations).toEqual([]);
  });

  it("counts them separately", () => {
    expect(
      countActiveFilters({ ...EMPTY_FILTERS, designations: ["CFP"], cfp: true }),
    ).toBe(2);
  });
});

/* ------------------------------------------------------ legacy URL aliases -- */

describe("legacy aliases still resolve", () => {
  it("folds ?year= into both ends of the grad-year range", () => {
    const f = parseAlumniFilters({ year: "2012" });
    expect([f.ymin, f.ymax]).toEqual(["2012", "2012"]);
  });

  it("folds ?missing= into the data-quality flags", () => {
    expect(parseAlumniFilters({ missing: "email" }).missingEmail).toBe(true);
    expect(parseAlumniFilters({ missing: "employer" }).missingEmployer).toBe(true);
  });

  it("reads deceased=0 as exclude and deceased=1 as only", () => {
    expect(parseAlumniFilters({ deceased: "1" }).deceased).toBe("only");
    expect(parseAlumniFilters({ deceased: "0" }).deceased).toBe("exclude");
    expect(parseAlumniFilters({ deceased: "false" }).deceased).toBe("exclude");
    expect(parseAlumniFilters({}).deceased).toBe("");
  });
});

/* ------------------------------------------------------ source invariants -- */

function read(relPath: string): string {
  return readFileSync(resolve(process.cwd(), relPath), "utf8");
}

describe("every param the roster forwards has a home", () => {
  /**
   * The guard that generalises this bug. The roster maps the URL onto the API
   * call; the panel rebuilds the URL from its model. A param the roster honours
   * but the model doesn't is, by construction, one interaction away from being
   * deleted — which is exactly how `cfp`, `secondary_industry` and
   * `employment_status` broke.
   *
   * So: every `sp.<name>` the roster reads must either round-trip through the
   * model or be listed in PASS_THROUGH_PARAMS as a known, documented casualty.
   */
  it("is either modelled or an explicitly accepted casualty", () => {
    const roster = read("src/components/alumni/AlumniRoster.tsx");
    const read_ = new Set(
      [...roster.matchAll(/\bsp\.([a-z_][a-z0-9_]*)/gi)].map((m) => m[1]),
    );
    // Whatever the serializer can emit is, by definition, what round-trips.
    const modelled = new Set(
      new URLSearchParams(toAlumniFilterQs(MAXIMAL)).keys(),
    );
    const homeless = [...read_].filter(
      (p) =>
        !modelled.has(p) &&
        !(PASS_THROUGH_PARAMS as readonly string[]).includes(p),
    );
    expect(
      homeless,
      "add these to the filter model (state + parse + serialize + a panel " +
        "control) or to PASS_THROUGH_PARAMS with a reason — otherwise the " +
        "Filters slide-over deletes them on the next click",
    ).toEqual([]);
  });

  it("routes the three regressed params through the model, not the raw URL", () => {
    const roster = read("src/components/alumni/AlumniRoster.tsx");
    expect(roster).toContain('appendAll("employment_status", filters.employmentStatus)');
    expect(roster).toContain('appendAll("secondary_industry", filters.secondaryIndustry)');
    expect(roster).toContain('params.set("cfp", "true")');
    // The old raw-URL reads are what made them droppable.
    expect(roster).not.toContain("arr(sp.secondary_industry)");
    expect(roster).not.toContain("arr(sp.employment_status)");
    expect(roster).not.toContain("isTrue(sp.cfp)");
  });
});

describe("the panel can re-apply what it now preserves", () => {
  // Preserving a param the panel has no control for would still trap the user:
  // once dropped by any other means they could never set it again from this
  // screen. Both new facets render off FACETS, and CFP needs its own tickbox.
  it("offers a control for both new facets", () => {
    expect(FACETS.map((f) => f.param)).toContain("employment_status");
    expect(FACETS.map((f) => f.param)).toContain("secondary_industry");
    const panel = read("src/components/alumni/AlumniFilters.tsx");
    // FACETS is what the slide-over maps over to render its multi-selects.
    expect(panel).toContain("FACETS.map((facet)");
  });

  it("offers a CFP tickbox alongside CFA and CPA", () => {
    const panel = read("src/components/alumni/AlumniFilters.tsx");
    expect(panel).toContain('checkboxRow("cfa", "CFA designation")');
    expect(panel).toContain('checkboxRow("cfp", "CFP designation")');
    expect(panel).toContain('checkboxRow("cpa", "CPA designation")');
  });

  it("uses the employment_statuses option list that was previously unused", () => {
    expect(
      FACETS.find((f) => f.param === "employment_status")?.optKey,
    ).toBe("employment_statuses");
    expect(
      FACETS.find((f) => f.param === "secondary_industry")?.optKey,
    ).toBe("secondary_industries");
  });

  it("keeps the panel text-only — no icons on the new controls", () => {
    // UX-UI.md / CLAUDE.md: text-only buttons and controls.
    const panel = read("src/components/alumni/AlumniFilters.tsx");
    const engagement = panel.slice(panel.indexOf('{checkboxRow("attended"'));
    expect(engagement.slice(0, engagement.indexOf("</div>"))).not.toMatch(
      /lucide|<[A-Z]\w+ className="h-\d/,
    );
  });
});

/* ------------------------------------ employment status = a FIXED list (#593) -- */

describe("the Employment status facet offers a fixed list, not the data", () => {
  /**
   * Jake, 2026-08-03. `/alumni/filter-options` derives `employment_statuses`
   * from the values alumni already hold, so Military / Part-time / Unemployed
   * were absent from the dropdown until somebody answered a survey that way and
   * the filter looked broken. It now shows the same seven the survey and the
   * profile edit form show — the SHARED constant, so there is exactly one list.
   */

  /** A `/alumni/filter-options` payload with a deliberately thin, data-derived
   *  employment list — what prod actually returned. */
  const SERVED: FilterOptions = {
    employers: ["Goldman Sachs"],
    past_employers: [],
    titles: [],
    seniority_levels: [],
    industries: ["Investment Banking"],
    secondary_industries: [],
    employment_statuses: ["Full-time", "Employed"],
    cities: ["Provo"],
    states: ["Utah"],
    tags: ["Mentor"],
    status_labels: ["Retired"],
    leadership_roles: [],
    survey_statuses: ["Sent"],
    graduation_years: [2015],
    graduation_classes: [2015],
  };

  it("shows all seven canonical options even when the data holds two", () => {
    expect(facetOptions("employment_statuses", SERVED)).toEqual([
      ...EMPLOYMENT_STATUS_OPTIONS,
    ]);
  });

  it("reuses the shared constant rather than a second hand-typed copy", () => {
    // Identity against the constant the survey + edit forms read. A retyped
    // literal here is the drift this change exists to prevent, so assert on the
    // source too: the module must IMPORT the list.
    expect(FIXED_FACET_OPTIONS.employment_statuses).toBe(
      EMPLOYMENT_STATUS_OPTIONS,
    );
    expect(read("src/lib/alumniFilterParams.ts")).toContain(
      'from "@/constants/dropdowns"',
    );
  });

  it("leaves every other facet data-derived — Status Label especially", () => {
    // Status Label is a survey-suppression flag (fa-web-api#354), deliberately
    // separate from employment status; nothing about it changed here.
    for (const facet of FACETS) {
      if (facet.optKey === "employment_statuses") continue;
      expect(
        facetOptions(facet.optKey, SERVED),
        `${facet.param} should still come from /alumni/filter-options`,
      ).toEqual(SERVED[facet.optKey]);
    }
    expect(Object.keys(FIXED_FACET_OPTIONS)).toEqual(["employment_statuses"]);
  });

  it("falls back to an empty list when options are missing entirely", () => {
    expect(facetOptions("titles", null)).toEqual([]);
    // …but the fixed facet is fixed regardless of whether the fetch resolved.
    expect(facetOptions("employment_statuses", null)).toEqual([
      ...EMPLOYMENT_STATUS_OPTIONS,
    ]);
  });

  it("hands the panel a copy, so a facet can't mutate the constant", () => {
    const a = facetOptions("employment_statuses", SERVED);
    a.push("Tampered");
    expect(EMPLOYMENT_STATUS_OPTIONS).not.toContain("Tampered");
  });

  it("routes BOTH panels' dropdowns through the same resolver", () => {
    // The dashboard's Advanced search and the list's slide-over render the same
    // facet; reading `options[optKey]` directly in either would let them diverge.
    for (const p of [
      "src/components/alumni/AlumniFilters.tsx",
      "src/components/dashboard/DashboardSearch.tsx",
    ]) {
      const src = read(p);
      expect(src, `${p} should use facetOptions`).toContain(
        "facetOptions(facet.optKey, options)",
      );
      expect(src, `${p} still reads the raw option list`).not.toMatch(
        /options\[facet\.optKey\]/,
      );
    }
  });

  it("does not change what the filter emits, so list and export still agree", () => {
    // Only the OPTIONS changed. The param, its serialization and the export
    // mapping are untouched — export/list parity depends on that.
    const f = { ...EMPTY_FILTERS, employmentStatus: ["Military"] };
    expect(toAlumniFilterQs(f)).toBe("employment_status=Military");
    expect(toExportFilters(f).employment_status).toEqual(["Military"]);
  });
});

describe("an export mirrors the rows the user is looking at", () => {
  // The export reuses the panel's state, so a field the model gained but the
  // export mapping ignores exports a WIDER population than the visible list.
  it("carries the three new filters into the export payload", () => {
    const e = toExportFilters(MAXIMAL);
    expect(e.employment_status).toEqual(["Employed", "Self-Employed"]);
    expect(e.secondary_industry).toEqual(["Private Equity", "Venture Capital"]);
    expect(e.cfp).toBe(true);
  });

  it("leaves them unset when nothing is filtered", () => {
    const e = toExportFilters(EMPTY_FILTERS);
    expect(e.employment_status).toBeNull();
    expect(e.secondary_industry).toBeNull();
    expect(e.cfp).toBe(false);
  });
});
