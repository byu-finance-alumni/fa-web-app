import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_STATUS,
  EMPTY_ADD_LINK_FORM,
  EMPTY_LINKS_FILTERS,
  LINKS_PAGE_SIZE,
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
  type LinksFilterState,
  type OpportunityLink,
} from "@/lib/opportunityLinks";
import {
  SAMPLE_ALUMNI_OPTIONS,
  sampleLinkPage,
  sampleOpportunityLinks,
} from "@/lib/opportunityLinks.sample";

// --- from the alum-facing survey-form workstream ---
import {
  COMPANY_NAME_MAX,
  DETAILS_MAX,
  MAX_LINKS,
  URL_MAX,
  addLinkEntry,
  emptyLinkEntry,
  isBlankLinkEntry,
  linkSubmitErrorMessage,
  linksToSubmit,
  removeLinkEntry,
  updateLinkEntry,
  validateDetails,
  validateLinkEntries,
  validateLinkEntry,
  validateOpportunityUrl,
  validateShortText,
  type LinkEntry,
} from "./opportunityLinks";


/**
 * The alum-facing opportunity-link form (#441).
 *
 * Two things are worth pinning here, and they are not the same thing:
 *
 *  1. THE URL RULE. This is the app's only public write of a value that later
 *     becomes a clickable `href` on a signed-in staff member's screen. The
 *     client rule is NOT the control — the backend re-validates on the
 *     persistence path — but it has to agree with the backend's verdict, or an
 *     alum meets a 422 that names none of their entries. Every case below is
 *     taken from `validate_opportunity_url`'s own list, including the two
 *     parser-differential ones (backslash, raw whitespace) that exist because
 *     Python's `urlsplit` and a browser's WHATWG parser disagree about where the
 *     host ends.
 *  2. THE ADD/REMOVE LOGIC. Pure list functions, so they are testable without a
 *     DOM (the suites run in Node). The cases that matter are the boundaries: the
 *     ten-entry cap, and removing the last entry.
 */

const entry = (patch: Partial<LinkEntry> = {}): LinkEntry => ({
  ...emptyLinkEntry(),
  companyName: "Acme Capital",
  url: "https://careers.example.com/jobs/1234",
  roleType: "internship",
  ...patch,
});

describe("validateOpportunityUrl", () => {
  it("accepts an ordinary https posting", () => {
    expect(
      validateOpportunityUrl("https://careers.example.com/jobs/1234"),
    ).toBeNull();
  });

  it("accepts http as well as https", () => {
    expect(validateOpportunityUrl("http://jobs.example.org/apply")).toBeNull();
  });

  it("trims before judging", () => {
    expect(validateOpportunityUrl("  https://jobs.example.org/a  ")).toBeNull();
  });

  it("requires a value", () => {
    expect(validateOpportunityUrl("")).toBe("A link is required.");
    expect(validateOpportunityUrl("   ")).toBe("A link is required.");
  });

  it("caps length at the column width", () => {
    const long = `https://example.com/${"a".repeat(URL_MAX)}`;
    expect(validateOpportunityUrl(long)).toBe(
      `Must be ${URL_MAX} characters or fewer.`,
    );
    // One under the cap is fine — the boundary must not be off by one.
    const atCap = `https://e.com/${"a".repeat(URL_MAX - 14)}`;
    expect(atCap).toHaveLength(URL_MAX);
    expect(validateOpportunityUrl(atCap)).toBeNull();
  });

  // The whole reason the render side has its own guard: this value is a link a
  // staff member clicks from an authenticated session.
  it("refuses javascript: and data: however they are dressed up", () => {
    for (const bad of [
      "javascript:alert(1)",
      "JaVaScRiPt:alert(1)",
      "java\nscript:alert(1)",
      "\u0001javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox(1)",
    ]) {
      expect(validateOpportunityUrl(bad), bad).not.toBeNull();
    }
  });

  it("refuses relative and protocol-relative values", () => {
    for (const bad of ["/jobs/1234", "//evil.example/jobs", "careers.example.com"]) {
      expect(validateOpportunityUrl(bad), bad).not.toBeNull();
    }
  });

  it("refuses embedded credentials that make one host read as another", () => {
    // Resolves at evil.example while READING as acme.example in the queue.
    expect(
      validateOpportunityUrl("https://acme.example@evil.example/jobs"),
    ).not.toBeNull();
    expect(
      validateOpportunityUrl("https://user:pw@evil.example/jobs"),
    ).not.toBeNull();
  });

  it("refuses backslashes, encoded or not (the RFC-3986 vs WHATWG split)", () => {
    expect(
      validateOpportunityUrl("https://evil.example\\@acme.example/jobs"),
    ).not.toBeNull();
    expect(
      validateOpportunityUrl("https://evil.example%5C@acme.example/jobs"),
    ).not.toBeNull();
    expect(
      validateOpportunityUrl("https://evil.example%5c@acme.example/jobs"),
    ).not.toBeNull();
  });

  it("refuses any whitespace inside the value", () => {
    for (const bad of [
      "https://evil.example\t.acme.example/jobs",
      "https://acme.example/job posting",
      "https://acme.example\n/jobs",
    ]) {
      expect(validateOpportunityUrl(bad), JSON.stringify(bad)).not.toBeNull();
    }
  });

  it("refuses invisible characters, joiners included", () => {
    for (const bad of [
      "https://acme\u200B.example/jobs",
      "https://acme\u200D.example/jobs",
      "https://acme\uFEFF.example/jobs",
      "https://acme\u202E.example/jobs",
    ]) {
      expect(validateOpportunityUrl(bad), JSON.stringify(bad)).not.toBeNull();
    }
  });

  it("refuses a bare hostname with no dot", () => {
    expect(validateOpportunityUrl("http://localhost:8000/jobs")).not.toBeNull();
    expect(validateOpportunityUrl("http://intranet/jobs")).not.toBeNull();
  });

  it("says how to fix it rather than only that it is wrong", () => {
    const msg = validateOpportunityUrl("careers.example.com");
    expect(msg).toContain("https://");
  });
});

describe("validateShortText", () => {
  it("accepts an ordinary company name", () => {
    expect(
      validateShortText("Goldman Sachs & Co.", {
        field: "Company name",
        max: COMPANY_NAME_MAX,
        required: true,
      }),
    ).toBeNull();
  });

  it("only complains about a blank when the field is required", () => {
    expect(validateShortText("", { field: "City", max: 100 })).toBeNull();
    expect(
      validateShortText("", { field: "Company name", max: 100, required: true }),
    ).toBe("Company name is required.");
  });

  it("caps length", () => {
    expect(
      validateShortText("a".repeat(COMPANY_NAME_MAX + 1), {
        field: "Company name",
        max: COMPANY_NAME_MAX,
      }),
    ).toBe(`Must be ${COMPANY_NAME_MAX} characters or fewer.`);
  });

  it("refuses the characters the backend refuses", () => {
    for (const bad of ["Acme; DROP", "Acme=Corp", "Acme<b>", "Acme|Co"]) {
      expect(validateShortText(bad, { field: "Company name", max: 255 }), bad).not.toBeNull();
    }
  });

  // These rows are attacker-supplied text destined for a staff CSV export.
  it("refuses a leading formula character", () => {
    for (const bad of ["+1", "-1", "@SUM(1)"]) {
      expect(
        validateShortText(bad, { field: "Company name", max: 255 }),
        bad,
      ).toContain("can't start with");
    }
  });

  it("catches a leading = on the disallowed-character rule, as the server does", () => {
    // `=` is in the disallowed set AND is a formula lead, and the checks run in
    // the server's order, so the message names the character rule. Pinned
    // because the messages must not drift into disagreeing with the backend's
    // verdict about the same string.
    expect(
      validateShortText("=HYPERLINK(1)", { field: "Company name", max: 255 }),
    ).toContain("can't contain");
  });

  it("refuses control and invisible characters", () => {
    expect(
      validateShortText("Acme\u0000Corp", { field: "Company name", max: 255 }),
    ).not.toBeNull();
    expect(
      validateShortText("Acme\u200BCorp", { field: "Company name", max: 255 }),
    ).not.toBeNull();
  });
});

describe("validateDetails", () => {
  it("accepts prose, punctuation and newlines", () => {
    expect(
      validateDetails("Summer 2027 analyst program.\nGPA >= 3.5, apply by May."),
    ).toBeNull();
  });

  it("is blank-friendly — it is an optional field", () => {
    expect(validateDetails("")).toBeNull();
  });

  it("caps length", () => {
    expect(validateDetails("a".repeat(DETAILS_MAX + 1))).toBe(
      `Must be ${DETAILS_MAX} characters or fewer.`,
    );
  });

  it("still refuses a leading formula character", () => {
    expect(validateDetails("=HYPERLINK(\"http://evil\",\"click\")")).not.toBeNull();
  });
});

describe("validateLinkEntry", () => {
  it("passes a complete entry", () => {
    expect(validateLinkEntry(entry())).toEqual({});
  });

  it("says nothing at all about an untouched entry", () => {
    // The section opens with one blank row; looking at it and leaving must not
    // block the whole survey behind "a link is required".
    const blank = emptyLinkEntry();
    expect(isBlankLinkEntry(blank)).toBe(true);
    expect(validateLinkEntry(blank)).toEqual({});
  });

  it("treats a half-filled entry as a real entry", () => {
    const half = { ...emptyLinkEntry(), city: "Provo" };
    expect(isBlankLinkEntry(half)).toBe(false);
    const errors = validateLinkEntry(half);
    expect(errors.url).toBeTruthy();
    expect(errors.companyName).toBeTruthy();
    expect(errors.roleType).toBeTruthy();
  });

  it("requires a company name only when it is not the alum's own company", () => {
    expect(validateLinkEntry(entry({ companyName: "" })).companyName).toBeTruthy();
    expect(
      validateLinkEntry(entry({ companyName: "", isOwnCompany: true }))
        .companyName,
    ).toBeUndefined();
  });

  it("requires a role type", () => {
    expect(validateLinkEntry(entry({ roleType: "" })).roleType).toBeTruthy();
  });

  it("reports the bad url on the entry that owns it", () => {
    expect(validateLinkEntry(entry({ url: "javascript:alert(1)" })).url).toBeTruthy();
  });

  it("leaves the optional fields alone when they are blank", () => {
    const errors = validateLinkEntry(
      entry({ city: "", state: "", deadline: "", details: "" }),
    );
    expect(errors).toEqual({});
  });
});

describe("validateLinkEntries", () => {
  it("keys complaints by entry, and omits the entries that are fine", () => {
    const good = entry();
    const bad = entry({ url: "not-a-url" });
    const blank = emptyLinkEntry();
    const all = validateLinkEntries([good, bad, blank]);
    expect(Object.keys(all)).toEqual([bad.id]);
    expect(all[bad.id].url).toBeTruthy();
  });

  it("is empty for a list of blanks — the batch simply isn't sent", () => {
    expect(validateLinkEntries([emptyLinkEntry(), emptyLinkEntry()])).toEqual({});
  });
});

describe("add / remove / update", () => {
  it("appends a blank entry with a fresh key", () => {
    const one = [entry()];
    const two = addLinkEntry(one);
    expect(two).toHaveLength(2);
    expect(two[0]).toBe(one[0]);
    expect(isBlankLinkEntry(two[1])).toBe(true);
    expect(two[1].id).not.toBe(two[0].id);
  });

  it("never exceeds the server's batch cap", () => {
    let entries = [entry()];
    for (let i = 0; i < MAX_LINKS + 5; i += 1) entries = addLinkEntry(entries);
    expect(entries).toHaveLength(MAX_LINKS);
  });

  it("does not mutate the list it is given", () => {
    const one = [entry()];
    addLinkEntry(one);
    expect(one).toHaveLength(1);
  });

  it("removes the named entry and leaves the rest identical", () => {
    const a = entry({ companyName: "A" });
    const b = entry({ companyName: "B" });
    const c = entry({ companyName: "C" });
    const kept = removeLinkEntry([a, b, c], b.id);
    expect(kept.map((e) => e.companyName)).toEqual(["A", "C"]);
    expect(kept[0]).toBe(a);
  });

  it("leaves one blank entry behind when the last one is removed", () => {
    // "Remove" on a lone row means "start this over", not "leave me a dead end
    // with no way back into a form".
    const only = entry();
    const after = removeLinkEntry([only], only.id);
    expect(after).toHaveLength(1);
    expect(isBlankLinkEntry(after[0])).toBe(true);
    expect(after[0].id).not.toBe(only.id);
  });

  it("ignores an id that isn't in the list", () => {
    const a = entry();
    const b = entry();
    expect(removeLinkEntry([a, b], "nope").map((e) => e.id)).toEqual([a.id, b.id]);
  });

  it("patches one entry without touching its siblings", () => {
    const a = entry({ companyName: "A" });
    const b = entry({ companyName: "B" });
    const next = updateLinkEntry([a, b], b.id, { city: "Provo" });
    expect(next[0]).toBe(a);
    expect(next[1].city).toBe("Provo");
    expect(next[1].companyName).toBe("B");
    expect(b.city).toBe("");
  });
});

describe("linksToSubmit", () => {
  it("drops blank entries", () => {
    expect(linksToSubmit([emptyLinkEntry(), emptyLinkEntry()])).toEqual([]);
  });

  it("maps an entry onto the wire shape, blanks becoming null", () => {
    expect(
      linksToSubmit([
        entry({
          companyName: "  Acme Capital  ",
          url: "  https://careers.example.com/jobs/1  ",
          city: " Provo ",
          state: "Utah",
          roleType: "both",
          deadline: "2027-01-15",
          details: "  Summer analyst  ",
        }),
      ]),
    ).toEqual([
      {
        is_own_company: false,
        company_name: "Acme Capital",
        url: "https://careers.example.com/jobs/1",
        location_city: "Provo",
        location_state: "Utah",
        role_type: "both",
        application_deadline: "2027-01-15",
        details: "Summer analyst",
      },
    ]);
  });

  it("nulls every optional field that was left empty", () => {
    const [wire] = linksToSubmit([entry()]);
    expect(wire.location_city).toBeNull();
    expect(wire.location_state).toBeNull();
    expect(wire.application_deadline).toBeNull();
    expect(wire.details).toBeNull();
  });

  it("never sends a typed company name alongside is_own_company", () => {
    // The server's `_company_identity` validator 422s a batch that sends both:
    // the flag means "resolve it from my employment record".
    const [wire] = linksToSubmit([
      entry({ isOwnCompany: true, companyName: "Typed Anyway" }),
    ]);
    expect(wire.is_own_company).toBe(true);
    expect(wire.company_name).toBeNull();
  });

  it("keeps only the non-blank entries, in order", () => {
    const a = entry({ companyName: "A" });
    const b = entry({ companyName: "B" });
    const wire = linksToSubmit([a, emptyLinkEntry(), b]);
    expect(wire.map((w) => w.company_name)).toEqual(["A", "B"]);
  });
});

describe("linkSubmitErrorMessage", () => {
  it("tells an expired link apart from a rate limit apart from a bad value", () => {
    expect(linkSubmitErrorMessage(404)).toContain("expired");
    expect(linkSubmitErrorMessage(429)).toContain("wait a few minutes");
    expect(linkSubmitErrorMessage(422)).toContain("check the link");
  });

  it("never claims a partial success — the batch is all-or-nothing", () => {
    for (const status of [400, 404, 410, 413, 422, 429, 500, null]) {
      const msg = linkSubmitErrorMessage(status);
      expect(msg, String(status)).not.toMatch(/some of/i);
      expect(msg.length, String(status)).toBeGreaterThan(20);
    }
  });

  it("says the rest of the submission survived, because it did", () => {
    // Fields are posted first and are not retried, so a links failure never
    // costs the alum the corrections they came here to make.
    expect(linkSubmitErrorMessage(404)).toContain("other updates were received");
    expect(linkSubmitErrorMessage(500)).toContain("other updates were received");
  });
});

// --- from the staff Links-tab workstream ---

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