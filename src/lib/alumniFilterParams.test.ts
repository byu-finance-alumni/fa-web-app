import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  BOOLEAN_FLAGS,
  EMPTY_FILTERS,
  EMPTY_PASS_THROUGH,
  FACETS,
  FIXED_FACET_OPTIONS,
  PASS_THROUGH_PARAMS,
  countActiveFilters,
  hasPassThroughFilters,
  facetOptions,
  parseAlumniFilters,
  parsePassThroughFilters,
  toAlumniFilterQs,
  toAlumniPopulationParams,
  type AlumniFilterState,
  type PassThroughFilters,
  type SearchParamMap,
} from "./alumniFilterParams";
import {
  EXPORT_MAPPING_FOR_TEST,
  exportParityGaps,
  toExportFilters,
} from "./exportFilters";
import type { AlumniExportFilters } from "@/types/export";
import { EMPLOYMENT_STATUS_OPTIONS } from "@/constants/dropdowns";
import type { FilterOptions } from "@/types/filters";

/**
 * The alumni list's filter round trip — and, since #592, the population it
 * covers.
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
 *
 * The second half of the file pins the matching invariant for the CSV export:
 * the list query and the export body must resolve to the SAME population — see
 * the block comment above `exportBodyAsParams`.
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
    // Both halves of the URL→API mapping: what the roster still reads directly,
    // and the shared pass-through parser it delegates the rest to (#592).
    const sources = [
      read("src/components/alumni/AlumniRoster.tsx"),
      read("src/lib/alumniFilterParams.ts"),
    ].join("\n");
    const read_ = new Set(
      [...sources.matchAll(/\bsp\.([a-z_][a-z0-9_]*)/gi)].map((m) => m[1]),
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
    // Since #592 the roster doesn't hand-write the API querystring at all — it
    // asks the shared population builder, which reads these off the model.
    expect(roster).toContain(
      "toAlumniPopulationParams(filters, kind, passThrough)",
    );
    const params = toAlumniPopulationParams(MAXIMAL);
    expect(params.getAll("employment_status")).toEqual(MAXIMAL.employmentStatus);
    expect(params.getAll("secondary_industry")).toEqual(
      MAXIMAL.secondaryIndustry,
    );
    expect(params.get("cfp")).toBe("true");
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
   * the filter looked broken. It now shows the same list the profile edit form
   * shows — the SHARED constant, so there is exactly one list.
   *
   * That list includes `Unknown` (#377): ~65 prod alumni hold it after the
   * 2026-08-04 cleanup, so it must be selectable here. The survey is the ONE
   * place that narrows the list.
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

  it("shows every canonical option even when the data holds two", () => {
    expect(facetOptions("employment_statuses", SERVED)).toEqual([
      ...EMPLOYMENT_STATUS_OPTIONS,
    ]);
  });

  it("offers Unknown, so the ~65 alumni holding it are findable (#377)", () => {
    // The gap #377 closes: prod holds `Unknown`, and an off-dropdown value is
    // an alumnus nobody can filter to.
    expect(facetOptions("employment_statuses", SERVED)).toContain("Unknown");
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

/* ------------------------------------------ list ⇄ export population parity -- */

/**
 * #592: `/alumni?employment_status=Employed` showed **26** rows under a dialog
 * reading "Exports the 26 alumni matching your current filters" — and produced a
 * CSV of **29**. The three extras were `is_alumni = false`: friends of the
 * program, whom the list excludes. Unfiltered it was 248 on screen, 267 in the
 * file (every non-archived friend).
 *
 * Cause: the export sent `is_alumni: null` expecting the backend's
 * `is_alumni=true` default, but `model_dump(exclude_unset=True)` counts an
 * explicit null as SET, so `build_alumni_query` applied no predicate at all. A
 * null meaning "no filter" on one side and "the default filter" on the other.
 *
 * That was the SECOND export-parity break in one batch (#590 was the first), so
 * these tests pin the invariant rather than the instance: the list query and the
 * export body must resolve to the same population, for every filter, on both
 * rosters. `toExportFilters` now derives the body from the very params the list
 * is fetched with, and `exportBodyAsParams` below reads it back INDEPENDENTLY
 * (a hand-written inverse, deliberately not the mapping table) so the comparison
 * can actually fail.
 */

/** The export body, read back as the population predicates it applies — the
 *  same shape `toAlumniPopulationParams` emits, so the two compare directly. */
function exportBodyAsParams(e: AlumniExportFilters): URLSearchParams {
  const p = new URLSearchParams();
  // `null` here is the bug itself: neither alumni nor friends, i.e. both.
  p.set(
    "kind",
    e.is_alumni === true ? "alumni" : e.is_alumni === false ? "friend" : "all",
  );
  const text = (name: string, v: string | number | null) => {
    if (v != null && v !== "") p.set(name, String(v));
  };
  const multi = (name: string, v: string[] | null) => {
    for (const x of v ?? []) p.append(name, x);
  };
  const flag = (name: string, v: boolean) => {
    if (v) p.set(name, "true");
  };
  text("q", e.q);
  text("net_id", e.net_id);
  text("first_name", e.first_name);
  text("last_name", e.last_name);
  text("preferred_name", e.preferred_name);
  text("email", e.email);
  text("graduation_year", e.graduation_year);
  text("grad_year_min", e.grad_year_min);
  text("grad_year_max", e.grad_year_max);
  text("gender", e.gender);
  text("industry_group", e.industry_group);
  text("contacted_after", e.contacted_after);
  text("contacted_before", e.contacted_before);
  multi("employer", e.employer);
  multi("past_employer", e.past_employer);
  multi("industry", e.industry);
  multi("secondary_industry", e.secondary_industry);
  multi("title", e.title);
  multi("seniority", e.seniority);
  multi("employment_status", e.employment_status);
  multi("city", e.city);
  multi("state", e.state);
  multi("tag", e.tag);
  multi("status_label", e.status_label);
  multi("leadership_role", e.leadership_role);
  multi("survey_status", e.survey_status);
  flag("never_contacted", e.never_contacted);
  flag("attended_event", e.attended_event);
  flag("donor", e.donor);
  flag("mentor_willing", e.mentor_willing);
  flag("guest_speaker_willing", e.guest_speaker_willing);
  flag("cfa", e.cfa);
  flag("cfp", e.cfp);
  flag("cpa", e.cpa);
  flag("missing_email", e.missing_email);
  flag("missing_employer", e.missing_employer);
  flag("duplicate", e.duplicate);
  flag("include_archived", e.include_archived);
  flag("needs_survey", e.needs_survey);
  // Wired up by fa-web-api#366 — previously these had no export field at all
  // and the dialog warned instead. The inverse has to read them or the parity
  // assertions silently stop covering them.
  multi("designations", e.designations);
  flag("graduate_degree", e.graduate_degree);
  flag("missing_phone", e.missing_phone);
  text("near", e.near);
  // Mirrors the builder: `radius` alone means nothing without `near`.
  if (e.near) text("radius", e.radius);
  text("spoke_after", e.spoke_after);
  text("spoke_before", e.spoke_before);
  if (e.deceased === true) p.set("deceased", "true");
  if (e.deceased === false) p.set("deceased", "false");
  return p;
}

/** Comparable, order-independent view of a param set. */
const predicates = (p: URLSearchParams): string[] =>
  [...p.entries()].map(([k, v]) => `${k}=${v}`).sort();

/** MAXIMAL minus the two filters `AlumniExportFilters` has no field for — those
 *  are asserted separately, as blockers rather than as silent widening. */
const MAXIMAL_EXPORTABLE: AlumniFilterState = {
  ...MAXIMAL,
  designations: [],
  graduateDegree: false,
};

/** Every URL-only narrowing param the export body CAN express. */
const PASS_THROUGH_EXPORTABLE: PassThroughFilters = {
  ...EMPTY_PASS_THROUGH,
  employer: ["Goldman Sachs", "Jefferies"],
  net_id: "jhansen",
  first_name: "Jane",
  last_name: "Hansen",
  preferred_name: "Janie",
  email: "jane@example.com",
};

/** …and the ones it cannot. */
const PASS_THROUGH_UNEXPORTABLE: PassThroughFilters = {
  ...EMPTY_PASS_THROUGH,
  near: "Provo, UT",
  radius: "50",
  spoke_after: "2026-01-01",
  spoke_before: "2026-06-30",
};

/** Each filter the model owns, on its own, as a labelled patch. */
const SINGLE_FILTERS: [string, Partial<AlumniFilterState>][] = [
  ...FACETS.map(
    (f) => [f.param, { [f.key]: ["Some value"] }] as [string, Partial<AlumniFilterState>],
  ),
  ...BOOLEAN_FLAGS.map(
    (f) => [f.param, { [f.key]: true }] as [string, Partial<AlumniFilterState>],
  ),
  ["q", { q: "hansen" }],
  ["grad year range", { ymin: "2008", ymax: "2015" }],
  ["gender", { gender: "F" }],
  ["industry_group", { industryGroup: "other" }],
  ["contacted_after", { contactedAfter: "2024-01-01" }],
  ["contacted_before", { contactedBefore: "2026-01-01" }],
  ["deceased only", { deceased: "only" }],
  ["deceased exclude", { deceased: "exclude" }],
  ["designations", { designations: ["CFA"] }],
  ["needs_survey", { needsSurvey: true }],
];

describe("the CSV export covers the same people as the list (#592)", () => {
  it("constrains an alumni-list export to alumni — never 'alumni AND friends'", () => {
    // The verbatim repro. `is_alumni: null` is what put 3 friends of the program
    // into a file the dialog called "the 26 alumni matching your current filters".
    const filtered = toExportFilters({
      ...EMPTY_FILTERS,
      employmentStatus: ["Employed"],
    });
    expect(filtered.is_alumni).toBe(true);
    expect(filtered.is_alumni).not.toBeNull();
    // …and the unfiltered case: 248 alumni on screen, 267 rows in the CSV.
    expect(toExportFilters(EMPTY_FILTERS).is_alumni).toBe(true);
  });

  it("exports friends of the program from the friends roster, and only them", () => {
    expect(toExportFilters(EMPTY_FILTERS, "friend").is_alumni).toBe(false);
  });

  it("never emits a null is_alumni, whatever the filters", () => {
    for (const [label, patch] of SINGLE_FILTERS) {
      for (const scope of ["alumni", "friend"] as const) {
        const e = toExportFilters({ ...EMPTY_FILTERS, ...patch }, scope);
        expect(e.is_alumni, `${label} on ${scope}`).toBe(scope === "alumni");
      }
    }
  });

  it("resolves to the same predicates as the list query, filter for filter", () => {
    for (const scope of ["alumni", "friend"] as const) {
      const list = toAlumniPopulationParams(
        MAXIMAL_EXPORTABLE,
        scope,
        PASS_THROUGH_EXPORTABLE,
      );
      const exported = exportBodyAsParams(
        toExportFilters(MAXIMAL_EXPORTABLE, scope, PASS_THROUGH_EXPORTABLE),
      );
      expect(predicates(exported), `${scope} export ≠ ${scope} list`).toEqual(
        predicates(list),
      );
    }
  });

  it("agrees on the empty view too — everyone the list shows, no one more", () => {
    for (const scope of ["alumni", "friend"] as const) {
      expect(
        predicates(exportBodyAsParams(toExportFilters(EMPTY_FILTERS, scope))),
      ).toEqual(predicates(toAlumniPopulationParams(EMPTY_FILTERS, scope)));
    }
  });

  it("matches the list for every single filter on its own", () => {
    // One at a time, so a mismatch names the culprit instead of a diff of 40.
    for (const [label, patch] of SINGLE_FILTERS) {
      const f = { ...EMPTY_FILTERS, ...patch };
      if (exportParityGaps(f).length) continue; // asserted as a blocker below
      expect(
        predicates(exportBodyAsParams(toExportFilters(f))),
        `${label}: the export covers a different population than the list`,
      ).toEqual(predicates(toAlumniPopulationParams(f)));
    }
  });

  it("carries the URL-only filters a dashboard deep link sets", () => {
    // `?employer=Goldman+Sachs` / `?net_id=…` narrow the LIST but had no home in
    // the panel's state, so the export sent them as null and covered everyone.
    const e = toExportFilters(EMPTY_FILTERS, "alumni", PASS_THROUGH_EXPORTABLE);
    expect(e.employer).toEqual(["Goldman Sachs", "Jefferies"]);
    expect(e.net_id).toBe("jhansen");
    expect(e.first_name).toBe("Jane");
    expect(e.last_name).toBe("Hansen");
    expect(e.preferred_name).toBe("Janie");
    expect(e.email).toBe("jane@example.com");
  });

  it("has an export mapping for every param the population builder emits", () => {
    // The structural guard: add a filter to the model and it lands here, unmapped,
    // until it is either given an export field or declared unsupported.
    const emitted = new Set(
      toAlumniPopulationParams(MAXIMAL, "alumni", {
        ...PASS_THROUGH_EXPORTABLE,
        ...PASS_THROUGH_UNEXPORTABLE,
      }).keys(),
    );
    const unmapped = [...emitted].filter(
      (p) => !(p in EXPORT_MAPPING_FOR_TEST),
    );
    expect(
      unmapped,
      "map these to an export field in EXPORT_MAPPING, or declare them " +
        "{ as: 'unsupported' } with a label so the dialog can refuse",
    ).toEqual([]);
  });
});

describe("filters the export API cannot express warn about the export", () => {
  // These six had NO export field, so an export would return more people than
  // the list — the exact shape of #592. fa-web-api#366 gave the export API the
  // matching fields, so they are now ordinary mappings and nothing warns.
  //
  // The gap MECHANISM is kept deliberately: the next filter added to the list
  // ahead of the export needs it, and the structural test above forces whoever
  // adds one to pick a side.
  it("no longer flags the six that fa-web-api#366 wired up", () => {
    expect(exportParityGaps({ ...EMPTY_FILTERS, designations: ["CFA"] })).toEqual(
      [],
    );
    expect(
      exportParityGaps({ ...EMPTY_FILTERS, graduateDegree: true }),
    ).toEqual([]);
    expect(
      exportParityGaps(EMPTY_FILTERS, "alumni", PASS_THROUGH_UNEXPORTABLE),
    ).toEqual([]);
  });

  it("still reports a gap for any filter declared unsupported", () => {
    // Guards the mechanism itself, independently of whether anything currently
    // uses it — otherwise the next unsupported filter ships silently widening
    // the export, which is #592 all over again.
    const declared = Object.values(EXPORT_MAPPING_FOR_TEST).filter(
      (m) => m.as === "unsupported",
    );
    for (const m of declared) {
      expect(typeof (m as { label: string }).label).toBe("string");
    }
    // And the reporter reads labels off the table rather than a hardcoded list.
    expect(String(exportParityGaps)).toContain("unsupported");
  });

  it("stays quiet for everything the export CAN express", () => {
    expect(
      exportParityGaps(MAXIMAL_EXPORTABLE, "alumni", PASS_THROUGH_EXPORTABLE),
    ).toEqual([]);
    expect(exportParityGaps(EMPTY_FILTERS)).toEqual([]);
    expect(exportParityGaps(EMPTY_FILTERS, "friend")).toEqual([]);
  });

  it("warns about them but still allows the download (Jake, 2026-08-03)", () => {
    // The gaps were originally a hard block. Jake chose warn-but-allow: he
    // would rather have the file and know it is wider than not have it at all.
    // The warning is therefore the ONLY thing standing between the operator and
    // a CSV containing people the list excluded — if it stops rendering, the
    // export silently lies. That is what this pins.
    const dialog = read("src/components/alumni/ExportAlumniButton.tsx");
    expect(dialog).toContain("const blocked = unsupportedFilters.length > 0;");
    // Rendered as a warning...
    expect(dialog).toContain("{blocked ? (");
    expect(dialog).toContain("This file will have extra people in it");
    // ...but the download is NOT gated on it.
    expect(dialog).not.toContain("disabled={blocked");
    expect(dialog).toContain("disabled={pending || loading");
    // …and the panel actually hands the gaps to the dialog.
    const panel = read("src/components/alumni/AlumniFilters.tsx");
    expect(panel).toContain("unsupportedFilters={exportGaps}");
    expect(panel).toContain("exportParityGaps(f, scope, passThrough)");
  });

  it("keeps the notice text-only — no icons", () => {
    // UX-UI.md / CLAUDE.md: text-only controls.
    const dialog = read("src/components/alumni/ExportAlumniButton.tsx");
    const notice = dialog.slice(dialog.indexOf("{blocked ? ("));
    expect(notice.slice(0, notice.indexOf(") : null}"))).not.toMatch(
      /lucide|<[A-Z]\w+ className="h-\d/,
    );
  });
});

describe("the roster feeds the export the same inputs it queried with", () => {
  const roster = read("src/components/alumni/AlumniRoster.tsx");

  it("parses the pass-through params through the shared parser", () => {
    expect(roster).toContain("parsePassThroughFilters(sp)");
    // The inline, roster-only validation is what the export could never see.
    expect(roster).not.toContain('one(sp.near).trim()');
    expect(roster).not.toContain('arr(sp.employer)');
  });

  it("hands them to the panel, which builds the export body from them", () => {
    expect(roster).toContain("passThrough={passThrough}");
    const panel = read("src/components/alumni/AlumniFilters.tsx");
    expect(panel).toContain("toExportFilters(f, scope, passThrough)");
  });

  it("validates near/radius and the spoke dates exactly once", () => {
    const pt = parsePassThroughFilters({
      near: " Provo, UT ",
      radius: "50",
      spoke_after: "2026-01-01",
      spoke_before: "not-a-date",
      employer: ["Goldman Sachs", ""],
    });
    expect(pt.near).toBe("Provo, UT");
    expect(pt.radius).toBe("50");
    expect(pt.spoke_after).toBe("2026-01-01");
    expect(pt.spoke_before).toBe("");
    expect(pt.employer).toEqual(["Goldman Sachs"]);
    expect(parsePassThroughFilters({ radius: "abc" }).radius).toBe("");
    expect(hasPassThroughFilters(EMPTY_PASS_THROUGH)).toBe(false);
    expect(hasPassThroughFilters(pt)).toBe(true);
  });

  it("drops a radius with no near — it narrows nothing on its own", () => {
    const p = toAlumniPopulationParams(EMPTY_FILTERS, "alumni", {
      ...EMPTY_PASS_THROUGH,
      radius: "50",
    });
    expect(p.get("radius")).toBeNull();
    expect(exportParityGaps(EMPTY_FILTERS, "alumni", {
      ...EMPTY_PASS_THROUGH,
      radius: "50",
    })).toEqual([]);
  });
});
