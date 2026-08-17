import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_STATUS,
  EMPTY_ADD_LINK_FORM,
  EMPTY_LINKS_FILTERS,
  LINKS_PAGE_SIZE,
  OPPORTUNITY_URL_MAX_LEN,
  SAMPLE_LINKS_FLAG,
  STALE_AFTER_DAYS,
  companyDisplay,
  daysSince,
  formatLinkDate,
  hasActiveLinkFilters,
  isDeadlinePassed,
  isStaleLink,
  linkAgeLabel,
  linkTarget,
  linksHref,
  locationDisplay,
  parseLinksFilters,
  parseLinksOffset,
  sampleLinksEnabled,
  submittedByDisplay,
  toCreateBody,
  toLinksApiQuery,
  toLinksQs,
  validateAddLink,
  validateOpportunityUrl,
  type LinksFilterState,
  type OpportunityLink,
} from "@/lib/opportunityLinks";
import {
  SAMPLE_ALUMNI_OPTIONS,
  sampleLinkPage,
  sampleOpportunityLinks,
} from "@/lib/opportunityLinks.sample";

/**
 * Guards for the Links tab (api #441).
 *
 * Three things here are worth more than the rest:
 *
 *  1. The filter state is the single source for BOTH the URL and the backend
 *     query. This repo's recurring bug class is those two drifting (see the
 *     export↔list parity note), so the round-trip and the derivation are pinned.
 *  2. `company_name` is nullable BY DESIGN — an alum can tick "my company" with
 *     no employer on file. That case has bitten before as an invented name or a
 *     blank cell with no explanation, so every branch is enumerated.
 *  3. The stored `url` is public-submitted. The scheme guard is tested here and
 *     the render site is checked STRUCTURALLY (source text, as
 *     `urlSafety.test.ts` does) because the suite runs in Node with no DOM and
 *     "this href never sees a raw stored value" is a structural invariant.
 */
function read(relPath: string): string {
  return readFileSync(resolve(process.cwd(), relPath), "utf8");
}

/** A link with every field set; individual tests override what they care about. */
function link(overrides: Partial<OpportunityLink> = {}): OpportunityLink {
  return {
    opportunity_link_id: 1,
    alumni_id: 10,
    submitted_by: "Marcus Whitfield",
    is_own_company: false,
    company_name: "Goldman Sachs",
    url: "https://example.com/careers",
    location_city: "Provo",
    location_state: "UT",
    role_type: "internship",
    application_deadline: null,
    details: null,
    status: "approved",
    source: "survey",
    submitted_at: "2026-08-01T12:00:00Z",
    reviewed_by: null,
    reviewed_at: null,
    ...overrides,
  };
}

/* ==================================================================== *
 * Filter params — URL in, backend query out
 * ==================================================================== */

describe("parseLinksFilters", () => {
  it("defaults an empty URL to the backend's own default status", () => {
    expect(parseLinksFilters({})).toEqual(EMPTY_LINKS_FILTERS);
    expect(EMPTY_LINKS_FILTERS.status).toBe(DEFAULT_STATUS);
  });

  it("reads every supported param", () => {
    expect(
      parseLinksFilters({
        q: "goldman",
        status: "pending",
        role_type: "full_time",
        company: "gold",
      }),
    ).toEqual({
      q: "goldman",
      status: "pending",
      role_type: "full_time",
      company: "gold",
    });
  });

  it("drops a value the backend would 422 on rather than forwarding it", () => {
    // A hand-edited or stale URL must degrade to the default view, never become
    // a validation error the user cannot see the cause of.
    const f = parseLinksFilters({ status: "all", role_type: "contract" });
    expect(f.status).toBe(DEFAULT_STATUS);
    expect(f.role_type).toBe("");
  });
});

describe("parseLinksOffset", () => {
  it("reads a positive offset", () => {
    expect(parseLinksOffset({ offset: "100" })).toBe(100);
  });

  it("clamps junk and negatives to the first page", () => {
    expect(parseLinksOffset({})).toBe(0);
    expect(parseLinksOffset({ offset: "-50" })).toBe(0);
    expect(parseLinksOffset({ offset: "abc" })).toBe(0);
    expect(parseLinksOffset({ offset: "12.7" })).toBe(12);
  });
});

describe("toLinksQs", () => {
  it("is empty for the default view, so a clean list has a clean URL", () => {
    expect(toLinksQs(EMPTY_LINKS_FILTERS)).toBe("");
    expect(hasActiveLinkFilters(EMPTY_LINKS_FILTERS)).toBe(false);
  });

  it("omits the default status but keeps a non-default one", () => {
    expect(toLinksQs({ ...EMPTY_LINKS_FILTERS, status: "approved" })).toBe("");
    expect(toLinksQs({ ...EMPTY_LINKS_FILTERS, status: "pending" })).toBe(
      "status=pending",
    );
  });

  it("trims whitespace-only text filters away entirely", () => {
    expect(toLinksQs({ ...EMPTY_LINKS_FILTERS, q: "   ", company: "  " })).toBe(
      "",
    );
  });

  it("round-trips through parseLinksFilters", () => {
    const cases: LinksFilterState[] = [
      EMPTY_LINKS_FILTERS,
      { q: "analyst", status: "pending", role_type: "both", company: "zions" },
      { q: "", status: "rejected", role_type: "", company: "" },
      { q: "goldman sachs", status: "approved", role_type: "internship", company: "" },
    ];
    for (const f of cases) {
      const sp = Object.fromEntries(new URLSearchParams(toLinksQs(f)));
      expect(parseLinksFilters(sp)).toEqual(f);
    }
  });
});

describe("linksHref", () => {
  it("drops the query entirely for the default view", () => {
    expect(linksHref(EMPTY_LINKS_FILTERS)).toBe("/links");
  });

  it("carries the offset only past the first page", () => {
    expect(linksHref(EMPTY_LINKS_FILTERS, 0)).toBe("/links");
    expect(linksHref(EMPTY_LINKS_FILTERS, 50)).toBe("/links?offset=50");
    expect(linksHref({ ...EMPTY_LINKS_FILTERS, status: "pending" }, 50)).toBe(
      "/links?status=pending&offset=50",
    );
  });
});

describe("toLinksApiQuery", () => {
  const params = (f: LinksFilterState, opts?: { limit?: number; offset?: number }) =>
    Object.fromEntries(new URLSearchParams(toLinksApiQuery(f, opts)));

  it("always states the status explicitly, even at the default", () => {
    // The one thing worse than a redundant param is a list whose contents depend
    // on an implicit default we then have to remember on both ends.
    expect(params(EMPTY_LINKS_FILTERS).status).toBe("approved");
  });

  it("sends paging on every request", () => {
    expect(params(EMPTY_LINKS_FILTERS)).toMatchObject({
      limit: String(LINKS_PAGE_SIZE),
      offset: "0",
    });
    expect(params(EMPTY_LINKS_FILTERS, { limit: 10, offset: 30 })).toMatchObject({
      limit: "10",
      offset: "30",
    });
  });

  it("forwards exactly the filters the URL carries — no more, no less", () => {
    // The derivation guard: every filter the URL can express reaches the
    // backend, and nothing the URL does not express is invented here.
    const f: LinksFilterState = {
      q: "  analyst ",
      status: "pending",
      role_type: "full_time",
      company: " zions ",
    };
    expect(params(f)).toEqual({
      status: "pending",
      role_type: "full_time",
      company: "zions",
      q: "analyst",
      limit: String(LINKS_PAGE_SIZE),
      offset: "0",
    });
  });

  it("omits empty optional filters rather than sending blanks", () => {
    expect(Object.keys(params(EMPTY_LINKS_FILTERS)).sort()).toEqual([
      "limit",
      "offset",
      "status",
    ]);
  });

  it("keeps every URL filter reachable — a new one cannot be added to only one side", () => {
    // Set every text/enum filter to something non-default and assert the API
    // query grew for each. This is the check that fails if someone adds a filter
    // to the URL serializer and forgets the API one (or vice versa).
    const urlKeys = new Set(
      new URLSearchParams(
        toLinksQs({
          q: "a",
          status: "pending",
          role_type: "both",
          company: "b",
        }),
      ).keys(),
    );
    const apiKeys = new Set(
      new URLSearchParams(
        toLinksApiQuery({
          q: "a",
          status: "pending",
          role_type: "both",
          company: "b",
        }),
      ).keys(),
    );
    for (const key of urlKeys) expect(apiKeys.has(key)).toBe(true);
  });
});

/* ==================================================================== *
 * Company-name resolution display
 * ==================================================================== */

describe("companyDisplay", () => {
  it("shows a typed company name as-is", () => {
    expect(companyDisplay(link({ is_own_company: false }))).toEqual({
      label: "Goldman Sachs",
      ownCompany: false,
      unresolved: false,
    });
  });

  it("shows the RESOLVED employer name for an own-company link, and marks it", () => {
    // The backend resolves this at read time from the alum's current employer,
    // so it follows a job change. The frontend must not re-derive it — only
    // label it.
    expect(
      companyDisplay(link({ is_own_company: true, company_name: "Qualtrics" })),
    ).toEqual({ label: "Qualtrics", ownCompany: true, unresolved: false });
  });

  it("falls back to a dash when an own-company alum has no employer on file", () => {
    // The documented null case. A dash plus an explicit marker, never an
    // invented name and never a silently blank cell.
    expect(
      companyDisplay(link({ is_own_company: true, company_name: null })),
    ).toEqual({ label: "—", ownCompany: true, unresolved: true });
  });

  it("does not claim 'unresolved' when there was nothing to resolve", () => {
    // Not own-company and no name is missing data, not a failed lookup — the
    // warning badge would be pointing at the wrong thing.
    expect(
      companyDisplay(link({ is_own_company: false, company_name: null })),
    ).toEqual({ label: "—", ownCompany: false, unresolved: false });
  });

  it("treats a whitespace-only name as absent", () => {
    expect(
      companyDisplay(link({ is_own_company: true, company_name: "   " })),
    ).toEqual({ label: "—", ownCompany: true, unresolved: true });
  });
});

describe("locationDisplay / submittedByDisplay", () => {
  it("joins city and state, and survives either being missing", () => {
    expect(locationDisplay(link())).toBe("Provo, UT");
    expect(locationDisplay(link({ location_state: null }))).toBe("Provo");
    expect(locationDisplay(link({ location_city: null }))).toBe("UT");
    expect(
      locationDisplay(link({ location_city: null, location_state: null })),
    ).toBe("—");
    expect(
      locationDisplay(link({ location_city: "  ", location_state: "  " })),
    ).toBe("—");
  });

  it("dashes a submitter the backend could not name", () => {
    expect(submittedByDisplay(link())).toBe("Marcus Whitfield");
    expect(submittedByDisplay(link({ submitted_by: null }))).toBe("—");
  });
});

/* ==================================================================== *
 * The stored URL never becomes an href unchecked
 * ==================================================================== */

describe("linkTarget", () => {
  it("returns a normalised href for a real http(s) URL", () => {
    const t = linkTarget("https://www.qualtrics.com/careers/");
    expect(t.href).toBe("https://www.qualtrics.com/careers/");
    expect(t.label).toBe("www.qualtrics.com/careers");
  });

  it("refuses javascript: and every other non-http scheme", () => {
    for (const raw of [
      "javascript:alert(document.cookie)",
      "java\nscript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox(1)",
      "//evil.example/careers",
      "not a url at all",
    ]) {
      expect(linkTarget(raw).href).toBeNull();
    }
  });

  it("still SHOWS a refused value, as text — staff have to see what was submitted", () => {
    const t = linkTarget("javascript:alert(1)");
    expect(t.href).toBeNull();
    expect(t.label).toBe("javascript:alert(1)");
  });

  it("dashes an empty value instead of rendering an empty link", () => {
    expect(linkTarget(null)).toEqual({ href: null, label: "—" });
    expect(linkTarget("   ")).toEqual({ href: null, label: "—" });
  });

  it("truncates a long label but never the href", () => {
    const long = `https://careers.example.com/${"a".repeat(200)}`;
    const t = linkTarget(long);
    expect(t.href).toBe(long);
    expect(t.label.length).toBeLessThanOrEqual(48);
    expect(t.label.endsWith("…")).toBe(true);
  });
});

describe("render sites never hand a submitted URL straight to an href", () => {
  it("the links table routes the url through linkTarget", () => {
    const src = read("src/components/links/LinksTable.tsx");
    expect(src).toContain('from "@/lib/opportunityLinks"');
    expect(src).toContain("linkTarget(link.url)");
    // The forms that would be the bug. Their absence is the whole assertion.
    expect(src).not.toContain("href={link.url}");
    expect(src).not.toContain("href={link.url ?? undefined}");
  });

  it("no part of the feature renders any field as raw HTML", () => {
    // `details` and `company_name` are free text an alum typed into a public
    // form. There is no reason any of this ever renders as HTML. Matched as a
    // JSX prop rather than as a bare word, so a comment saying "we must never do
    // this" doesn't fail the guard that enforces it.
    const rawHtmlProp = /dangerouslySetInnerHTML\s*=/;
    for (const path of [
      "src/components/links/LinksTable.tsx",
      "src/components/links/LinksToolbar.tsx",
      "src/components/links/LinkReviewActions.tsx",
      "src/components/links/AddLinkForm.tsx",
      "src/app/(app)/links/page.tsx",
      "src/app/(app)/links/new/page.tsx",
    ]) {
      expect(read(path)).not.toMatch(rawHtmlProp);
    }
  });
});

/* ==================================================================== *
 * Age + staleness — the reason the submitted column exists
 * ==================================================================== */

describe("age and staleness", () => {
  const now = new Date("2026-08-17T09:00:00");
  const daysBefore = (n: number) =>
    new Date(now.getTime() - n * 86_400_000).toISOString();

  it("counts whole calendar days", () => {
    expect(daysSince(daysBefore(0), now)).toBe(0);
    expect(daysSince(daysBefore(1), now)).toBe(1);
    expect(daysSince(daysBefore(120), now)).toBe(120);
    expect(daysSince(null, now)).toBeNull();
    expect(daysSince("not a date", now)).toBeNull();
  });

  it("labels the age in words the list can print directly", () => {
    expect(linkAgeLabel(daysBefore(0), now)).toBe("Today");
    expect(linkAgeLabel(daysBefore(1), now)).toBe("1 day old");
    expect(linkAgeLabel(daysBefore(9), now)).toBe("9 days old");
    expect(linkAgeLabel(null, now)).toBe("—");
  });

  it("marks a link stale strictly PAST the threshold, not on it", () => {
    expect(isStaleLink(daysBefore(STALE_AFTER_DAYS), now)).toBe(false);
    expect(isStaleLink(daysBefore(STALE_AFTER_DAYS + 1), now)).toBe(true);
    expect(isStaleLink(null, now)).toBe(false);
  });

  it("flags a deadline that has already gone by", () => {
    expect(isDeadlinePassed(daysBefore(1), now)).toBe(true);
    expect(isDeadlinePassed(daysBefore(0), now)).toBe(false);
    expect(isDeadlinePassed(daysBefore(-30), now)).toBe(false);
    expect(isDeadlinePassed(null, now)).toBe(false);
  });

  it("dashes an unparseable date rather than printing 'Invalid Date'", () => {
    expect(formatLinkDate(null)).toBe("—");
    expect(formatLinkDate("nonsense")).toBe("—");
  });
});

/* ==================================================================== *
 * Add-link form validation
 * ==================================================================== */

describe("validateOpportunityUrl", () => {
  it("accepts a plain https careers page", () => {
    expect(validateOpportunityUrl("https://example.com/careers")).toBeNull();
  });

  it("rejects an empty value with the field's own wording", () => {
    expect(validateOpportunityUrl("   ")).toBe("Enter the link URL.");
  });

  it("rejects anything the render side would refuse to link", () => {
    expect(validateOpportunityUrl("javascript:alert(1)")).toContain("http://");
    expect(validateOpportunityUrl("example.com/careers")).toContain("http://");
  });

  it("rejects a value longer than the column", () => {
    const tooLong = `https://example.com/${"a".repeat(OPPORTUNITY_URL_MAX_LEN)}`;
    expect(validateOpportunityUrl(tooLong)).toContain(
      String(OPPORTUNITY_URL_MAX_LEN),
    );
  });
});

describe("validateAddLink", () => {
  const valid = {
    ...EMPTY_ADD_LINK_FORM,
    alumniId: 42,
    companyName: "Zions Bancorporation",
    url: "https://example.com/careers",
  };

  it("passes a complete form", () => {
    expect(validateAddLink(valid)).toEqual({});
  });

  it("requires an alumnus — attribution is not optional", () => {
    expect(validateAddLink({ ...valid, alumniId: null }).alumniId).toBeTruthy();
  });

  it("requires a company name only when 'their own company' is unticked", () => {
    expect(
      validateAddLink({ ...valid, companyName: "  " }).companyName,
    ).toBeTruthy();
    expect(
      validateAddLink({ ...valid, companyName: "", isOwnCompany: true })
        .companyName,
    ).toBeUndefined();
  });

  it("rejects an unsafe URL before it can ever be stored", () => {
    expect(validateAddLink({ ...valid, url: "javascript:alert(1)" }).url)
      .toBeTruthy();
  });
});

describe("toCreateBody", () => {
  const base = {
    ...EMPTY_ADD_LINK_FORM,
    alumniId: 42,
    url: "  https://example.com/careers  ",
  };

  it("sends null rather than a typed name when 'their own company' is ticked", () => {
    // Sending both would store a snapshot of today's employer name alongside the
    // flag that says to resolve it live — two answers to one question.
    const body = toCreateBody({
      ...base,
      isOwnCompany: true,
      companyName: "Stale Name Inc",
    });
    expect(body.is_own_company).toBe(true);
    expect(body.company_name).toBeNull();
  });

  it("trims every optional string and nulls the empty ones", () => {
    const body = toCreateBody({
      ...base,
      companyName: "  Deloitte  ",
      locationCity: "  Dallas ",
      locationState: "",
      applicationDeadline: "",
      details: "   ",
    });
    expect(body).toMatchObject({
      alumni_id: 42,
      company_name: "Deloitte",
      url: "https://example.com/careers",
      location_city: "Dallas",
      location_state: null,
      application_deadline: null,
      details: null,
      role_type: "internship",
    });
  });
});

/* ==================================================================== *
 * The local-only sample-data gate
 * ==================================================================== */

describe("sampleLinksEnabled", () => {
  it("is off in every deployed environment, flag or no flag", () => {
    // Every Vercel build — dev project and prod project alike — runs with
    // NODE_ENV=production. This single condition is what makes it impossible
    // for fabricated rows to appear on dev or prod.
    expect(
      sampleLinksEnabled({ NODE_ENV: "production", [SAMPLE_LINKS_FLAG]: "1" }),
    ).toBe(false);
    expect(
      sampleLinksEnabled({ NODE_ENV: "test", [SAMPLE_LINKS_FLAG]: "1" }),
    ).toBe(false);
    expect(sampleLinksEnabled({ [SAMPLE_LINKS_FLAG]: "1" })).toBe(false);
  });

  it("is off in local development until it is explicitly asked for", () => {
    expect(sampleLinksEnabled({ NODE_ENV: "development" })).toBe(false);
    expect(
      sampleLinksEnabled({ NODE_ENV: "development", [SAMPLE_LINKS_FLAG]: "0" }),
    ).toBe(false);
    expect(
      sampleLinksEnabled({
        NODE_ENV: "development",
        [SAMPLE_LINKS_FLAG]: "true",
      }),
    ).toBe(false);
  });

  it("is on only for the exact local opt-in", () => {
    expect(
      sampleLinksEnabled({ NODE_ENV: "development", [SAMPLE_LINKS_FLAG]: "1" }),
    ).toBe(true);
  });

  it("is a server-only flag — a NEXT_PUBLIC name would be baked into the bundle", () => {
    expect(SAMPLE_LINKS_FLAG.startsWith("NEXT_PUBLIC")).toBe(false);
  });
});

describe("sample data is structurally incapable of reaching a real environment", () => {
  it("is only ever loaded behind the gate, via a dynamic import", () => {
    // A static import would put the fabricated rows in the production bundle
    // even though they are unreachable. The dynamic form keeps them out of it.
    const page = read("src/app/(app)/links/page.tsx");
    expect(page).toContain("sampleLinksEnabled(process.env)");
    expect(page).toContain('await import("@/lib/opportunityLinks.sample")');
    expect(page).not.toContain('from "@/lib/opportunityLinks.sample"');
  });

  it("makes every write path refuse while sample rows are on screen", () => {
    // Sample ids exist in no database, and NEXT_PUBLIC_API_URL may still point
    // at a real environment. Approve/Reject/Create must not send anything.
    const actions = read("src/app/(app)/links/actions.ts");
    expect(actions).toContain("sampleLinksEnabled(process.env)");
    for (const fn of ["approveLink", "rejectLink", "createLink"]) {
      const body = actions.slice(actions.indexOf(`export async function ${fn}`));
      const upToNextExport = body.slice(0, body.indexOf("\nexport ", 1));
      expect(upToNextExport).toContain("inSampleMode()");
    }
  });

  it("carries no filename the repo-hygiene guard would block", () => {
    // The CI job blocks TEST_* / SCRATCH* / DRAFT_* / *.scratch / *DO_NOT_MERGE*.
    const blocked = /(^|\/)(TEST_[^/]*|SCRATCH[^/]*|DRAFT_[^/]*|[^/]*\.scratch|[^/]*DO_NOT_MERGE[^/]*)$/;
    for (const path of [
      "src/lib/opportunityLinks.ts",
      "src/lib/opportunityLinks.sample.ts",
      "src/lib/opportunityLinks.test.ts",
    ]) {
      expect(blocked.test(path)).toBe(false);
    }
  });
});

describe("sampleLinkPage", () => {
  const now = new Date("2026-08-17T09:00:00");
  const page = (f: Partial<LinksFilterState>, offset = 0) =>
    sampleLinkPage(
      { ...EMPTY_LINKS_FILTERS, ...f },
      { limit: LINKS_PAGE_SIZE, offset, now },
    );

  it("provides a dozen rows to look at", () => {
    expect(sampleOpportunityLinks(now).length).toBeGreaterThanOrEqual(12);
  });

  it("covers every state the real table has to render", () => {
    const rows = sampleOpportunityLinks(now);
    const statuses = new Set(rows.map((r) => r.status));
    expect(statuses).toEqual(new Set(["approved", "pending", "rejected"]));
    expect(new Set(rows.map((r) => r.role_type))).toEqual(
      new Set(["internship", "full_time", "both"]),
    );
    // The nullable-by-design cases, so the page's dash branches are exercised.
    expect(
      rows.some((r) => r.is_own_company && r.company_name === null),
    ).toBe(true);
    expect(rows.some((r) => r.location_city === null)).toBe(true);
    expect(rows.some((r) => r.details === null)).toBe(true);
    expect(rows.some((r) => isStaleLink(r.submitted_at, now))).toBe(true);
    expect(
      rows.some((r) => isDeadlinePassed(r.application_deadline, now)),
    ).toBe(true);
  });

  it("every fabricated URL is one the render side will actually link", () => {
    for (const r of sampleOpportunityLinks(now)) {
      expect(linkTarget(r.url).href).not.toBeNull();
    }
  });

  it("filters the way the endpoint does, so the toolbar is demonstrable", () => {
    expect(page({ status: "approved" }).items.every((l) => l.status === "approved"))
      .toBe(true);
    expect(page({ status: "pending" }).total).toBeGreaterThan(0);
    expect(
      page({ role_type: "internship" }).items.every(
        (l) => l.role_type === "internship",
      ),
    ).toBe(true);
    expect(page({ company: "goldman" }).total).toBe(1);
    expect(page({ q: "zzzz-no-such-thing" }).total).toBe(0);
  });

  it("returns the same envelope as the endpoint, paging included", () => {
    const p = sampleLinkPage(EMPTY_LINKS_FILTERS, { limit: 3, offset: 3, now });
    expect(p.limit).toBe(3);
    expect(p.offset).toBe(3);
    expect(p.items.length).toBeLessThanOrEqual(3);
    expect(p.total).toBeGreaterThan(p.items.length);
  });

  it("names alumni the picker can find", () => {
    expect(SAMPLE_ALUMNI_OPTIONS.length).toBeGreaterThan(0);
    for (const a of SAMPLE_ALUMNI_OPTIONS) expect(a.name.trim()).not.toBe("");
  });
});

/* ==================================================================== *
 * Nav registration
 * ==================================================================== */

describe("the Links nav entry", () => {
  it("sits alongside the other top-level sections and is capability-gated", () => {
    const src = read("src/components/shell/nav.ts");
    expect(src).toContain(
      '{ href: "/links", label: "Links", capability: CAPABILITY.SURVEYS_MANAGE }',
    );
  });

  it("introduces no icon — the sidebar renders labels only", () => {
    const src = read("src/components/shell/Sidebar.tsx");
    expect(src).not.toContain("icon:");
  });
});
