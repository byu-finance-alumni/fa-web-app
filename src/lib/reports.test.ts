import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

import { CAPABILITY } from "@/constants/capabilities";
import {
  BOOLEAN_FLAGS,
  countActiveFilters,
  parseAlumniFilters,
  toAlumniPopulationParams,
  type SearchParamMap,
} from "@/lib/alumniFilterParams";
import { exportParityGaps, toExportFilters } from "@/lib/exportFilters";
import {
  ALL_REPORTS,
  COUNT_UNAVAILABLE,
  MISSING_PHOTO_NET_ID_NOTE,
  REPORT_SECTIONS,
  listReportFilters,
  listReportHref,
  reportCount,
  visibleReportSections,
  visibleRelatedSurfaces,
  type Report,
} from "@/lib/reports";
import { LEAF_HREFS, getVisibleNav, leafHrefs } from "@/components/shell/nav";
import { ROLE } from "@/constants/roles";

/** `/alumni?a=1&b=2` → the search-param map the roster parses. */
function searchParams(href: string): SearchParamMap {
  const qs = href.includes("?") ? href.slice(href.indexOf("?") + 1) : "";
  const sp: SearchParamMap = {};
  for (const key of new Set(new URLSearchParams(qs).keys())) {
    const values = new URLSearchParams(qs).getAll(key);
    sp[key] = values.length > 1 ? values : values[0];
  }
  return sp;
}

const listReports = ALL_REPORTS.filter((r) => r.flag !== undefined);
const flagApiParam = (key: string) =>
  BOOLEAN_FLAGS.find((f) => f.key === key)?.api;

/* ===========================================================================
 * ⚠️ null is NOT zero
 *
 * `DataQuality.missing_photo` is `int | null`, and null means the headshots
 * bucket could not be listed. Rendered as `0` it reads as "everybody has a
 * photo" — an outage presented as an all-clear. These are the tests that stop
 * a `?? 0` from being added back at a call site.
 * ======================================================================== */
describe("reportCount: an unavailable figure is never a zero", () => {
  it("renders null as Unavailable, flagged as unknown", () => {
    const c = reportCount(null);
    expect(c.value).toBe(COUNT_UNAVAILABLE);
    expect(c.unavailable).toBe(true);
    // Never the success tone — nothing has been verified as complete.
    expect(c.tone).toBe("muted");
  });

  it("treats undefined (no data-quality read at all) the same as null", () => {
    expect(reportCount(undefined)).toEqual(reportCount(null));
  });

  it("renders a REAL zero as 0, and as success rather than unknown", () => {
    const c = reportCount(0);
    expect(c.value).toBe("0");
    expect(c.unavailable).toBe(false);
    expect(c.tone).toBe("success");
  });

  it("never renders null and zero the same way", () => {
    expect(reportCount(null).value).not.toBe(reportCount(0).value);
    expect(reportCount(null).tone).not.toBe(reportCount(0).tone);
  });

  it("renders a positive count as a localized warning figure", () => {
    const c = reportCount(1438);
    expect(c.value).toBe((1438).toLocaleString());
    expect(c.tone).toBe("warning");
    expect(c.unavailable).toBe(false);
  });

  it("the photo report says net-ID-less alumni are counted as missing one", () => {
    // Staff read the figure against the number of stored headshots and conclude
    // it is a bug. It is not, and the reason has to travel with the report.
    const photo = ALL_REPORTS.find((r) => r.id === "missing-photo");
    expect(photo?.note).toBe(MISSING_PHOTO_NET_ID_NOTE);
    expect(photo?.note).toMatch(/net ID/i);
  });
});

/* ===========================================================================
 * Every report's link produces the filter the list expects — and the export
 * covers the same people. This is the recurring bug class in this repo
 * (#590/#592): a link, a list and a CSV that disagree about who is in a cohort.
 * ======================================================================== */
describe("a report link and the list it opens describe one population", () => {
  it("has at least one list-backed report to check", () => {
    expect(listReports.length).toBeGreaterThan(0);
  });

  it.each(listReports.map((r): [string, Report] => [r.id, r]))(
    "%s: the href round-trips to exactly its own filter state",
    (_id, report) => {
      const parsed = parseAlumniFilters(searchParams(report.href));
      // Byte-for-byte the state the report claims — nothing extra switched on,
      // nothing silently dropped.
      expect(parsed).toEqual(listReportFilters(report.flag!));
      // …and exactly ONE filter is narrowing the list.
      expect(countActiveFilters(parsed)).toBe(1);
    },
  );

  it.each(listReports.map((r): [string, Report] => [r.id, r]))(
    "%s: the API call carries the flag, scoped to alumni",
    (_id, report) => {
      const params = toAlumniPopulationParams(
        parseAlumniFilters(searchParams(report.href)),
      );
      const api = flagApiParam(report.flag!);
      expect(api).toBeDefined();
      expect(params.get(api!)).toBe("true");
      // `kind` is always emitted explicitly — the #592 lesson: a predicate is
      // either a real value or genuinely absent, never a null standing in for a
      // default.
      expect(params.get("kind")).toBe("alumni");
      // Only the scope and this one flag narrow the population.
      expect([...new Set(params.keys())].sort()).toEqual(["kind", api].sort());
    },
  );

  it.each(listReports.map((r): [string, Report] => [r.id, r]))(
    "%s: the CSV export covers the same people as the list",
    (_id, report) => {
      const filters = parseAlumniFilters(searchParams(report.href));
      // Nothing in this view is inexpressible to the export API, so the export
      // is never blocked and never quietly widened.
      expect(exportParityGaps(filters)).toEqual([]);

      const body = toExportFilters(filters);
      const api = flagApiParam(report.flag!) as keyof typeof body;
      expect(body[api]).toBe(true);
      expect(body.is_alumni).toBe(true);

      // And every OTHER predicate is off: an export from this report must not
      // be narrower or wider than the list it came from.
      const listParams = toAlumniPopulationParams(filters);
      const noPredicate = toExportFilters(
        parseAlumniFilters(searchParams("/alumni")),
      );
      for (const key of Object.keys(body) as (keyof typeof body)[]) {
        if (key === api) continue;
        expect({ key, value: body[key] }).toEqual({
          key,
          value: noPredicate[key],
        });
      }
      expect([...new Set(listParams.keys())]).toContain(api);
    },
  );

  it("derives list hrefs from the filter model, not from typed strings", () => {
    // The canonical spellings today. If a param is renamed in the model this
    // fails LOUDLY here rather than leaving a link that still resolves and
    // quietly returns everyone.
    expect(listReportHref("missingEmployer")).toBe(
      "/alumni?missing_employer=1",
    );
    expect(listReportHref("missingLinkedin")).toBe(
      "/alumni?missing_linkedin=1",
    );
    expect(listReportHref("missingPhoto")).toBe("/alumni?missing_photo=1");
  });

  it("reuses the SAME employer deep link the Data quality page uses", () => {
    // Two screens computing "missing employer" independently would disagree
    // eventually; both point at this one URL and both read the count from
    // GET /dashboard/data-quality.
    const employer = ALL_REPORTS.find((r) => r.id === "missing-employer");
    expect(employer?.href).toBe("/alumni?missing_employer=1");
    expect(employer?.countKey).toBe("missing_employer");
  });
});

/* ===========================================================================
 * The survey reports: what exists, and what does not.
 * ======================================================================== */
describe("the survey reports point at the campaign console", () => {
  const surveyReports = ALL_REPORTS.filter((r) =>
    r.id.startsWith("survey-"),
  );

  it("covers both who responded and who did not", () => {
    expect(surveyReports.map((r) => r.id)).toEqual([
      "survey-responded",
      "survey-not-responded",
    ]);
  });

  it("does NOT fake a list filter for them", () => {
    // There is no alumni-list param that answers "responded to the most recent
    // survey": `survey_status` and `needs_survey` both read the legacy `surveys`
    // table, which nothing writes. Linking to /alumni here would produce a list
    // that looks filtered and is not.
    for (const report of surveyReports) {
      expect(report.flag).toBeUndefined();
      expect(report.href).toBe("/needs-surveying");
      expect(report.href.startsWith("/alumni")).toBe(false);
    }
  });

  it("says the campaign is per graduation class rather than guessing one", () => {
    for (const report of surveyReports) {
      expect(report.note).toMatch(/graduation year/i);
      expect(report.capability).toBe(CAPABILITY.SURVEYS_MANAGE);
    }
  });
});

/* ===========================================================================
 * Capability gating — a link that 403s on click is worse than no link.
 * ======================================================================== */
describe("capability gating", () => {
  const everything = Object.values(CAPABILITY) as string[];

  it("hides the survey section entirely without surveys.manage", () => {
    const sections = visibleReportSections([CAPABILITY.REPORTS_ADVANCED]);
    expect(sections.map((s) => s.id)).toEqual(["missing-data"]);
  });

  it("shows every section to a holder of both capabilities", () => {
    const sections = visibleReportSections(everything);
    expect(sections.map((s) => s.id)).toEqual(
      REPORT_SECTIONS.map((s) => s.id),
    );
  });

  it("fails closed on an empty capability list", () => {
    // Matches `getVisibleNav`: no capabilities means we could not find out, and
    // the safe answer is to offer nothing gated.
    expect(
      visibleReportSections([]).flatMap((s) => s.reports),
    ).not.toContainEqual(
      expect.objectContaining({ capability: CAPABILITY.SURVEYS_MANAGE }),
    );
  });

  it("only offers related surfaces the user can open", () => {
    const hrefs = visibleRelatedSurfaces([]).map((s) => s.href);
    expect(hrefs).toEqual(["/alumni"]);
    expect(visibleRelatedSurfaces(everything).map((s) => s.href)).toEqual([
      "/data-quality",
      "/needs-surveying",
      "/alumni",
    ]);
  });
});

/* ===========================================================================
 * The nav entry.
 * ======================================================================== */
describe("the Reports nav entry", () => {
  it("is a leaf under Insights, gated on reports.advanced", () => {
    expect(LEAF_HREFS).toContain("/reports");
    const insights = getVisibleNav(ROLE.ENGINEER, false, [
      CAPABILITY.REPORTS_ADVANCED,
    ]).find((i) => i.label === "Insights");
    expect(insights).toBeDefined();
    expect(leafHrefs(insights!)).toContain("/reports");
  });

  it("is hidden from a role without reports.advanced", () => {
    const insights = getVisibleNav(ROLE.VIEW_ONLY, false, []).find(
      (i) => i.label === "Insights",
    );
    // Insights may survive on Map/Statistics, but Reports must not be in it.
    expect(insights ? leafHrefs(insights) : []).not.toContain("/reports");
  });

  it("every report links somewhere the app actually routes to", () => {
    for (const report of ALL_REPORTS) {
      const path = report.href.split("?")[0];
      expect(LEAF_HREFS).toContain(path);
    }
  });
});

/* ===========================================================================
 * Source-invariant guards on the PAGE.
 *
 * The suites here run in Node with no DOM, so the rendering rule is pinned
 * structurally instead: the page must put every data-quality figure through
 * `reportCount` and must never coerce a null count to a number. `?? 0` on
 * `missing_photo` is the one edit that turns a storage outage into "everybody
 * has a photo", and it typechecks perfectly.
 * ======================================================================== */
describe("the Reports page renders an unknown count as unknown", () => {
  const src = readFileSync(
    resolve(process.cwd(), "src/app/(app)/reports/page.tsx"),
    "utf8",
  );

  it("routes counts through reportCount rather than rendering them raw", () => {
    expect(src).toContain("reportCount(");
    expect(src).toMatch(/count\??\.unavailable/);
  });

  it("never defaults a missing count to zero", () => {
    expect(src).not.toMatch(/\?\?\s*0\b/);
    expect(src).not.toMatch(/\|\|\s*0\b/);
    expect(src).not.toMatch(/missing_photo\s*\|\|/);
  });

  it("explains an unavailable figure instead of leaving a bare dash", () => {
    expect(src).toContain("MISSING_PHOTO_UNAVAILABLE_NOTE");
  });

  it("shows each report's own note (the net-ID caveat travels with it)", () => {
    expect(src).toContain("report.note");
  });
});
