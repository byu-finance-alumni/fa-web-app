import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

import { CAPABILITY } from "@/constants/capabilities";
import {
  BOOLEAN_FLAGS,
  countActiveFilters,
  parseAlumniFilters,
  toAlumniFilterQs,
  toAlumniPopulationParams,
  type SearchParamMap,
} from "@/lib/alumniFilterParams";
import { exportParityGaps, toExportFilters } from "@/lib/exportFilters";
import {
  ALL_REPORTS,
  COUNT_UNAVAILABLE,
  MISSING_PHOTO_NET_ID_NOTE,
  MISSING_PHOTO_UNAVAILABLE_NOTE,
  RELATED_SURFACES,
  REPORT_SECTIONS,
  SURVEY_SCOPE_NOTE,
  listReportFilters,
  listReportHref,
  quotedCampaign,
  reportCount,
  surveyCount,
  surveyCountLabel,
  visibleReportSections,
  visibleRelatedSurfaces,
  type Report,
  type SurveySchedule,
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
    // The fact still has to be stated — a survey figure read as "the survey"
    // is the one thing no campaign count is. It moved from EACH ROW to the
    // section (#814), where it is said once instead of rendering verbatim
    // twice, but it must still be said.
    const survey = REPORT_SECTIONS.find((s) => s.id === "survey");
    expect(survey?.note).toMatch(/graduation year/i);
    for (const report of surveyReports) {
      expect(report.capability).toBe(CAPABILITY.SURVEYS_MANAGE);
    }
  });

  it("takes its number from a campaign row, never from a list filter", () => {
    expect(surveyReports.map((r) => r.surveyCountKey)).toEqual([
      "replied",
      "silent",
    ]);
    for (const report of surveyReports) expect(report.countKey).toBeUndefined();
  });
});

/* ===========================================================================
 * ⚠️ The survey figure is ONE class's, and it has to say so.
 *
 * There is no global "most recent survey": `survey_schedule` is one row per
 * graduation year, each with its own start date, cycle and status, and several
 * can be live at once. Summing them would add a campaign that finished months
 * ago to one emailed yesterday, count cancelled rows, and omit every class never
 * scheduled — a number nobody could act on, read by everybody as "the survey".
 * So the reports quote a single, nameable campaign. These tests pin which one,
 * and that its owner is always stated.
 * ======================================================================== */
describe("quotedCampaign: one nameable campaign, never a grand total", () => {
  const row = (over: Partial<SurveySchedule>): SurveySchedule =>
    ({
      survey_schedule_id: 1,
      graduation_year: 2020,
      start_date: "2026-01-01",
      status: "active",
      cycle_seq: 1,
      last_run_at: null,
      created_at: null,
      created_by: null,
      paused_at: null,
      sent_initial: 0,
      sent_reminder_1: 0,
      sent_reminder_2: 0,
      non_responders: 0,
      emails_sent_all_time: 0,
      recipients: 100,
      replied: 10,
      awaiting_review: 0,
      applied: 0,
      rejected: 0,
      confirmed: 0,
      ...over,
    }) as SurveySchedule;

  it("has nothing to quote with no campaigns at all", () => {
    expect(quotedCampaign(null)).toBeNull();
    expect(quotedCampaign(undefined)).toBeNull();
    expect(quotedCampaign([])).toBeNull();
  });

  it("picks the most recently STARTED campaign", () => {
    const c = quotedCampaign([
      row({ graduation_year: 2018, start_date: "2026-02-01" }),
      row({ graduation_year: 2019, start_date: "2026-06-01", replied: 42 }),
      row({ graduation_year: 2020, start_date: "2026-03-01" }),
    ]);
    expect(c?.graduationYear).toBe(2019);
    expect(c?.replied).toBe(42);
  });

  it("skips a scheduled campaign that has emailed nobody", () => {
    // "0 of 0 replied" is not a fact about anybody. An unsent campaign must not
    // put a zero on screen — it must put nothing there.
    const c = quotedCampaign([
      row({ graduation_year: 2021, start_date: "2026-09-01", recipients: 0, replied: 0 }),
      row({ graduation_year: 2019, start_date: "2026-06-01" }),
    ]);
    expect(c?.graduationYear).toBe(2019);
    expect(quotedCampaign([row({ recipients: 0, replied: 0 })])).toBeNull();
  });

  it("never quotes a cancelled campaign", () => {
    expect(
      quotedCampaign([row({ status: "cancelled", start_date: "2026-09-01" })]),
    ).toBeNull();
  });

  it("breaks a shared start date on the newest cohort, stably", () => {
    const rows = [
      row({ graduation_year: 2017 }),
      row({ graduation_year: 2022 }),
      row({ graduation_year: 2019 }),
    ];
    expect(quotedCampaign(rows)?.graduationYear).toBe(2022);
    expect(quotedCampaign([...rows].reverse())?.graduationYear).toBe(2022);
  });

  it("NEVER sums across classes — the figure is one row's", () => {
    const c = quotedCampaign([
      row({ graduation_year: 2018, recipients: 500, replied: 200 }),
      row({ graduation_year: 2019, start_date: "2026-06-01", recipients: 310, replied: 42 }),
    ]);
    // 42, not 242. A total across campaigns is the number this page refuses to
    // invent, because no campaign it describes ever happened.
    expect(c?.replied).toBe(42);
    expect(c?.emailed).toBe(310);
    expect(c?.silent).toBe(268);
  });

  it("clamps a silent count that would otherwise go negative", () => {
    const c = quotedCampaign([row({ recipients: 10, replied: 12 })]);
    expect(c?.silent).toBe(0);
  });

  it("shows no survey number when there is no campaign to name", () => {
    expect(surveyCount(null, "replied")).toBeNull();
    expect(surveyCount(null, "silent")).toBeNull();
  });

  it("renders each side of the same campaign, in a neutral tone", () => {
    const c = quotedCampaign([row({ recipients: 310, replied: 42 })])!;
    expect(surveyCount(c, "replied")?.value).toBe((42).toLocaleString());
    expect(surveyCount(c, "silent")?.value).toBe((268).toLocaleString());
    // A reply is not a data-quality defect and the call sheet is not a failure,
    // so neither side wears the missing-data warning colour.
    expect(surveyCount(c, "replied")?.tone).toBe("muted");
    expect(surveyCount(c, "silent")?.tone).toBe("muted");
    expect(surveyCount(c, "replied")?.unavailable).toBe(false);
  });

  it("labels each figure with the class AND the side it belongs to", () => {
    const c = quotedCampaign([
      row({ graduation_year: 2019, recipients: 310, replied: 42 }),
    ])!;
    const replied = surveyCountLabel(c, "replied");
    const silent = surveyCountLabel(c, "silent");
    for (const label of [replied, silent]) {
      expect(label).toMatch(/Class of 2019/);
      expect(label).toMatch(/310/);
    }
    // Each side states its OWN number. Printing "42 have replied" beside a
    // badge reading 268 makes the reader do the subtraction.
    expect(replied).toMatch(/^42\b/);
    expect(replied).toMatch(/have replied/);
    expect(silent).toMatch(/^268\b/);
    expect(silent).toMatch(/have not replied/);
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

  it("names the class beside every survey figure", () => {
    // A campaign count with no owner reads as "the survey", which is exactly
    // what it is not.
    expect(src).toContain("surveyCountLabel");
    expect(src).toContain("SURVEY_COUNT_UNAVAILABLE_NOTE");
  });

  /* -------------------------------------------------------------------------
   * Jake's review of #775: no plumbing, and fewer words.
   * ---------------------------------------------------------------------- */

  it("prints no HTTP method or route anywhere it can be read", () => {
    // The provenance of each number belongs in a comment, not on a staff
    // screen. Checked over the DATA rather than the JSX so a route pasted into
    // a description is caught too.
    const renderable = [
      ...ALL_REPORTS.flatMap((r) => [
        r.title,
        r.action,
        r.linkLabel,
        r.note ?? "",
      ]),
      ...REPORT_SECTIONS.flatMap((s) => [s.title, s.note ?? ""]),
      ...RELATED_SURFACES.map((s) => s.title),
      MISSING_PHOTO_NET_ID_NOTE,
      MISSING_PHOTO_UNAVAILABLE_NOTE,
    ];
    for (const text of renderable) {
      expect({ text }).toEqual({
        text: expect.not.stringMatching(
          /\b(GET|POST|PUT|PATCH|DELETE)\s+\/|\/dashboard\/data-quality/,
        ),
      });
    }
    // …and the row that used to carry it is gone from the model entirely.
    for (const report of ALL_REPORTS) {
      expect(Object.keys(report)).not.toContain("source");
    }
  });

  it("has no intro paragraph — the page title already says Reports", () => {
    expect(src).not.toContain("The reports staff run most often");
    expect(src).not.toContain("section.blurb");
  });

  /**
   * ⚠️ STRUCTURAL, not a word count — and that is the whole point.
   *
   * The first answer to "too much text" (Jake's #775 review) capped
   * `description.length` at 80. The descriptions stayed, every row kept
   * stacking a title, a sentence, a scope line and a caveat, and the page still
   * read as machine-written when he looked at it again (#814). A cap on prose
   * lets the prose grow back in the same shape while the suite stays green.
   *
   * So the rule is now about SHAPE: a report row is a number, a name and a
   * link. If someone needs to explain a row, the row's title is wrong.
   */
  it("report rows carry no description at all", () => {
    for (const report of ALL_REPORTS) {
      expect(Object.keys(report)).not.toContain("description");
    }
    for (const surface of RELATED_SURFACES) {
      expect(Object.keys(surface)).not.toContain("description");
    }
    // …and the page cannot reintroduce one by rendering some other field as a
    // sentence under the title.
    expect(src).not.toContain("report.description");
    expect(src).not.toContain("surface.description");
  });

  it("says a section's caveat once, under the section — not on every row", () => {
    // SURVEY_SCOPE_NOTE used to hang off BOTH survey rows and rendered verbatim
    // twice on screen. It describes the section, so it lives on the section.
    const survey = REPORT_SECTIONS.find((s) => s.id === "survey");
    expect(survey?.note).toBe(SURVEY_SCOPE_NOTE);
    for (const report of ALL_REPORTS) {
      expect({ id: report.id, note: report.note }).not.toEqual({
        id: report.id,
        note: SURVEY_SCOPE_NOTE,
      });
    }
    expect(src).toContain("section.note");
  });

  it("leads each row with the count, not with prose", () => {
    // "Hard to tell what you are looking at" was partly that the number — the
    // only reason the row exists — rendered as a small pill mid-sentence.
    expect(src).toContain("tabular-nums");
    expect(src).not.toContain("<Badge");
  });

  it("keeps the row's action beside the row", () => {
    // Full-bleed rows put the button ~1,100px from its label at 1440px wide.
    expect(src).toContain("max-w-3xl");
  });

  it("keeps a note only where one stops a wrong conclusion", () => {
    // Trimmed to the two that earn it. A note on every row is how this started.
    const withNotes = ALL_REPORTS.filter((r) => r.note);
    expect(withNotes.map((r) => r.id)).toEqual(["missing-photo"]);
    for (const report of withNotes) {
      expect(report.note!.length).toBeLessThanOrEqual(130);
    }
  });

  it("keeps the two facts that stop a wrong conclusion", () => {
    // Trimmed, not deleted. Without these the photo figure looks like a bug and
    // "Unavailable" looks like "nobody is missing one".
    expect(MISSING_PHOTO_NET_ID_NOTE).toMatch(/net ID/i);
    expect(MISSING_PHOTO_UNAVAILABLE_NOTE).toMatch(/unknown/i);
    expect(MISSING_PHOTO_UNAVAILABLE_NOTE).toMatch(/not zero/i);
  });
});

/* ===========================================================================
 * ⚠️ BACK, FROM A REPORT, RETURNS TO REPORTS.
 *
 * Clicking a report must add exactly ONE history entry. The thing that could
 * add a second is the alumni Filters panel: it re-serializes its state into the
 * URL, and it navigates whenever that serialization differs from what it last
 * wrote. Two properties keep it silent on arrival, and both are load-bearing:
 *
 *   1. the panel seeds its "last written" ref from `toQs(initial)` — the MODEL,
 *      not the raw querystring — so the first render can never see a
 *      difference, whatever spelling the incoming link used; and
 *   2. every report href is ALREADY the canonical serialization, so there is
 *      nothing to rewrite even if (1) were seeded from the URL.
 *
 * Live filtering additionally uses `replace`, not `push`, so typing in the
 * search box does not stack one entry per keystroke between the user and the
 * page they came from.
 *
 * Verified in a real browser against the dev deploy (Chromium, Firefox, WebKit;
 * history entries read via CDP `Page.getNavigationHistory`): /reports →
 * /alumni?missing_photo=1 adds exactly one entry, and Back renders Reports.
 * `e2e/reports-back.spec.ts` is the end-to-end version of that walk.
 * ======================================================================== */
describe("clicking a report costs exactly one history entry", () => {
  const filtersSrc = readFileSync(
    resolve(process.cwd(), "src/components/alumni/AlumniFilters.tsx"),
    "utf8",
  );

  it.each(listReports.map((r): [string, Report] => [r.id, r]))(
    "%s: the href is already what the panel would write, so nothing is rewritten",
    (_id, report) => {
      const qs = report.href.slice(report.href.indexOf("?") + 1);
      // The fixed point: re-serializing the parsed URL reproduces it byte for
      // byte. A report link that did NOT satisfy this would make the panel
      // navigate on arrival — an entry between Reports and the list, and Back
      // would land on the list again instead of on Reports.
      expect(toAlumniFilterQs(parseAlumniFilters(searchParams(report.href)))).toBe(
        qs,
      );
    },
  );

  it("seeds the panel's last-written ref from the MODEL, not the URL", () => {
    // If this becomes `useRef(searchParams.toString())` (or anything else
    // derived from the raw URL), a link spelled differently from the canonical
    // form fires a navigation on mount and Back stops returning to Reports.
    expect(filtersSrc).toContain("useRef(toQs(initial))");
  });

  it("syncs live filtering with replace(), never push()", () => {
    const effect = filtersSrc.slice(
      filtersSrc.indexOf("if (serialized === lastPushedRef.current) return;"),
    );
    const body = effect.slice(0, effect.indexOf("// Re-seed only when"));
    expect(body).toContain("router.replace(");
    // A push here stacks one history entry per debounced keystroke, burying the
    // page the user came from under a pile of filter states.
    expect(body).not.toContain("router.push(");
  });

  it("guards the sync so an unchanged serialization navigates nowhere", () => {
    expect(filtersSrc).toContain(
      "if (serialized === lastPushedRef.current) return;",
    );
  });
});
