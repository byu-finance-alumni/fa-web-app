import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  ADD_LINK_LAST_STEP,
  ADD_LINK_STEPS,
  DEFAULT_STATUS,
  EMPTY_ADD_LINK_FORM,
  EMPTY_LINKS_FILTERS,
  LINKS_PAGE_SIZE,
  MAX_LINKS_PER_BULK_DELETE,
  ROLE_TYPES,
  ROLE_TYPE_LABELS,
  ROLE_TYPE_OPTIONS,
  STALE_AFTER_DAYS,
  bulkDeleteBlockedReason,
  bulkDeleteConfirmMessage,
  bulkDeleteOutcomeMessage,
  companyDisplay,
  daysSince,
  isLinkSelected,
  isPageFullySelected,
  isPagePartiallySelected,
  linkCountLabel,
  pruneLinkSelection,
  selectionCountLabel,
  setPageLinkSelection,
  toBulkDeleteIds,
  toggleLinkSelection,
  type OpportunityLinkBulkDeleteResult,
  formatLinkDate,
  hasActiveLinkFilters,
  isDeadlinePassed,
  isStaleLink,
  linkAgeLabel,
  linkRowAction,
  linkTarget,
  linksHref,
  locationDisplay,
  maxReachableAddLinkStep,
  parseLinksFilters,
  parseLinksOffset,
  SHORT_LINK_LABEL_MAX,
  shortLinkTarget,
  submittedByDisplay,
  toCreateBody,
  toLinksApiQuery,
  toLinksQs,
  validateAddLink,
  validateAddLinkStep,
  type LinksFilterState,
  type OpportunityLink,
} from "@/lib/opportunityLinks";

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

// --- from the owner's four form changes (#441 follow-up) ---
import {
  COUNTRY_MAX,
  STATE_MAX,
  normalizeOpportunityUrl,
  settleOpportunityUrl,
  todayIsoUtc,
  validateApplicationDeadline,
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
        // US mode implies the country and never asks, so nothing is invented.
        location_country: null,
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
    location_country: null,
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

/* ==================================================================== *
 * shortLinkTarget — the dense row's Link cell (2026-08-17)
 * ==================================================================== */

/**
 * The list is one line per row now, so the Link cell shortens what it PRINTS.
 * The whole risk in that sentence is the word "prints": a shortened URL that
 * reached an `href` would send a reviewer to a host that is merely a PREFIX of
 * the one they read, which is a phishing primitive rather than a layout bug.
 * Every test below that asserts a label also asserts the href is untouched.
 */
describe("shortLinkTarget", () => {
  const LONG_PATH = `https://careers.example.com/${"a".repeat(200)}`;

  it("drops the scheme and keeps host + path", () => {
    const t = shortLinkTarget("https://www.qualtrics.com/careers/");
    expect(t.label).toBe("www.qualtrics.com/careers");
    expect(t.label).not.toContain("https://");
  });

  it("cuts a long host/path with a real ellipsis character", () => {
    const t = shortLinkTarget(LONG_PATH);
    expect(t.label.length).toBeLessThanOrEqual(SHORT_LINK_LABEL_MAX);
    expect(t.label.endsWith("…")).toBe(true);
  });

  it("is shorter than the label linkTarget would have produced", () => {
    // The point of the helper: the dense row's budget is tighter than the old
    // one, and a label that outgrows its column stops being one line.
    const full = linkTarget(LONG_PATH).label;
    expect(SHORT_LINK_LABEL_MAX).toBeLessThan(full.length);
    expect(shortLinkTarget(LONG_PATH).label.length).toBeLessThan(full.length);
  });

  it("leaves a URL that already fits completely alone", () => {
    const t = shortLinkTarget("https://byu.edu/jobs");
    expect(t.label).toBe("byu.edu/jobs");
    expect(t.label).not.toContain("…");
  });

  it("NEVER shortens the href — the destination is always the full URL", () => {
    for (const raw of [
      LONG_PATH,
      "https://careers.example.com/very/deep/path/that/keeps/going?req=12345&src=alumni",
      "https://byu.edu/jobs",
    ]) {
      const short = shortLinkTarget(raw);
      expect(short.href).toBe(raw);
      // And identical to the unshortened call: shortening touches label only.
      expect(short.href).toBe(linkTarget(raw).href);
      expect(short.href).not.toContain("…");
    }
  });

  it("keeps an unsafe URL as plain text — shortening does not launder it", () => {
    for (const raw of [
      "javascript:alert(document.cookie)",
      "java\nscript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox(1)",
      "//evil.example/careers",
      "not a url at all",
    ]) {
      expect(shortLinkTarget(raw).href).toBeNull();
    }
    // Still SHOWN, because staff have to read it in order to reject it.
    expect(shortLinkTarget("javascript:alert(1)").label).toBe(
      "javascript:alert(1)",
    );
  });

  it("dashes an empty value instead of rendering an empty link", () => {
    expect(shortLinkTarget(null)).toEqual({ href: null, label: "—" });
    expect(shortLinkTarget("   ")).toEqual({ href: null, label: "—" });
  });

  it("honours an explicit budget", () => {
    const t = shortLinkTarget("https://careers.example.com/engineering", 12);
    expect(t.label.length).toBeLessThanOrEqual(12);
    expect(t.href).toBe("https://careers.example.com/engineering");
  });
});

/* ==================================================================== *
 * linkRowAction — who owns a click on a row (2026-08-17)
 * ==================================================================== */

/**
 * Three features want the same click and the arbitration is the bug surface: a
 * row that opens its detail dialog while selection mode is on buries the list
 * someone is triaging, and a row that opens it when the click was really on the
 * anchor pops a dialog over the page the browser is already leaving.
 */
describe("linkRowAction", () => {
  it("opens the detail panel on a plain row click", () => {
    expect(linkRowAction({ selecting: false, fromControl: false })).toBe(
      "open-detail",
    );
  });

  it("toggles selection instead, once selection mode is on", () => {
    expect(linkRowAction({ selecting: true, fromControl: false })).toBe(
      "toggle-selection",
    );
  });

  it("keeps its hands off a click that a control already owns", () => {
    // Both modes: the anchor, the checkbox and Approve/Reject all outrank the
    // row, and a checkbox toggled by BOTH the input and the row is a checkbox
    // that never changes.
    expect(linkRowAction({ selecting: false, fromControl: true })).toBe(
      "ignore",
    );
    expect(linkRowAction({ selecting: true, fromControl: true })).toBe("ignore");
  });
});

describe("the links table wires the click collisions it is supposed to", () => {
  const table = () => read("src/components/links/LinksTable.tsx");

  it("arbitrates the row click through linkRowAction rather than by hand", () => {
    expect(table()).toContain("linkRowAction({ selecting, fromControl })");
  });

  it("stops the anchor, the checkbox and the review cell from bubbling", () => {
    // Three collisions, three braces — plus the Company button, which opens the
    // panel itself and must not let the row handler run a second time.
    const stops = table().match(/stopPropagation\(\)/g) ?? [];
    expect(stops.length).toBeGreaterThanOrEqual(4);
  });

  it("closes an open panel when selection mode is entered", () => {
    expect(table()).toContain("if (selecting) setDetail(null);");
  });

  it("gives the panel Esc-to-close by building it on the shared Dialog", () => {
    // Radix's Dialog owns Esc, the focus trap and the scroll lock; the visible
    // way out is a worded button, never an icon (standing no-icons rule).
    const panel = read("src/components/links/LinkDetailPanel.tsx");
    expect(panel).toContain('from "@/components/ui/dialog"');
    expect(panel).toContain("<Dialog");
    expect(panel).toContain("Close");
  });
});

describe("render sites never hand a submitted URL straight to an href", () => {
  it("the links table routes the url through the guard before shortening", () => {
    const src = read("src/components/links/LinksTable.tsx");
    expect(src).toContain('from "@/lib/opportunityLinks"');
    // The dense row shortens the LABEL. `shortLinkTarget` is `linkTarget` plus
    // an ellipsis, so the scheme check still stands between url and href.
    expect(src).toContain("shortLinkTarget(link.url)");
    // The forms that would be the bug. Their absence is the whole assertion.
    expect(src).not.toContain("href={link.url}");
    expect(src).not.toContain("href={link.url ?? undefined}");
  });

  it("the detail panel routes the url through linkTarget too", () => {
    // The panel is the one place the FULL url is on screen, which makes it the
    // one place tempted to print the raw string straight into an href.
    const src = read("src/components/links/LinkDetailPanel.tsx");
    expect(src).toContain('from "@/lib/opportunityLinks"');
    expect(src).toContain("linkTarget(link.url)");
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
      "src/components/links/LinkDetailPanel.tsx",
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
 * Role-type labels — display only
 * ==================================================================== */

describe("role-type labels", () => {
  it('spells `both` "Internship & Full-time" for the reader', () => {
    expect(ROLE_TYPE_LABELS.both).toBe("Internship & Full-time");
    expect(ROLE_TYPE_LABELS.internship).toBe("Internship");
    expect(ROLE_TYPE_LABELS.full_time).toBe("Full-time");
  });

  it("leaves the WIRE values alone — the API and the DB CHECK own those", () => {
    // The label is cosmetic; `both` is the value the request body carries and
    // the value the database constraint accepts. Relabelling must never become
    // a rename.
    expect(ROLE_TYPES).toEqual(["internship", "full_time", "both"]);
    expect(Object.keys(ROLE_TYPE_LABELS).sort()).toEqual(
      ["both", "full_time", "internship"].sort(),
    );
    expect(
      toCreateBody({ ...EMPTY_ADD_LINK_FORM, alumniId: 1, roleType: "both" })
        .role_type,
    ).toBe("both");
  });

  it("is the ONE map — the alum-facing options are derived from it", () => {
    // A second hand-written list is how the survey form and the staff table
    // end up calling the same code two different things.
    expect(ROLE_TYPE_OPTIONS.map((o) => o.value)).toEqual([...ROLE_TYPES]);
    for (const option of ROLE_TYPE_OPTIONS) {
      expect(option.label).toBe(ROLE_TYPE_LABELS[option.value]);
    }
  });

  it("is read from the map at every render site, never re-spelled", () => {
    for (const path of [
      "src/components/links/LinksTable.tsx",
      "src/components/links/LinksToolbar.tsx",
      "src/components/links/AddLinkForm.tsx",
    ]) {
      const src = read(path);
      expect(src).toContain("ROLE_TYPE_LABELS");
      expect(src).not.toContain(">Both<");
    }
  });
});

/* ==================================================================== *
 * The staff add form's two steps
 * ==================================================================== */

describe("the Add-link steps", () => {
  const chosen = { ...EMPTY_ADD_LINK_FORM, alumniId: 7 };

  it("asks who it is from first, then the opportunity", () => {
    expect(ADD_LINK_STEPS).toEqual(["Who this is from", "The opportunity"]);
    expect(ADD_LINK_LAST_STEP).toBe(1);
  });

  it("keeps step 2 unreachable until an alumnus is chosen", () => {
    expect(maxReachableAddLinkStep(EMPTY_ADD_LINK_FORM)).toBe(0);
    expect(maxReachableAddLinkStep(chosen)).toBe(ADD_LINK_LAST_STEP);
  });

  it("surfaces only the current step's complaints", () => {
    // Step 1 is the attribution. An empty URL is real but belongs to step 2 —
    // printing it here would be a message about a field not yet on screen.
    const step1 = validateAddLinkStep(EMPTY_ADD_LINK_FORM, 0);
    expect(Object.keys(step1)).toEqual(["alumniId"]);

    const step2 = validateAddLinkStep(chosen, 1);
    expect(Object.keys(step2).sort()).toEqual(["companyName", "url"]);
    expect(step2.alumniId).toBeUndefined();
  });

  it("says nothing about a step that does not exist", () => {
    expect(validateAddLinkStep(EMPTY_ADD_LINK_FORM, 2)).toEqual({});
    expect(validateAddLinkStep(EMPTY_ADD_LINK_FORM, -1)).toEqual({});
  });

  it("derives its messages from the whole-form rule, never a second copy", () => {
    const values = {
      ...chosen,
      companyName: "Deloitte",
      url: "not-a-url",
    };
    const all = validateAddLink(values);
    expect(validateAddLinkStep(values, 1).url).toBe(all.url);
  });

  it("between them the two steps cover every field the submit path checks", () => {
    const all = Object.keys(validateAddLink(EMPTY_ADD_LINK_FORM)).sort();
    const perStep = [
      ...Object.keys(validateAddLinkStep(EMPTY_ADD_LINK_FORM, 0)),
      ...Object.keys(validateAddLinkStep(EMPTY_ADD_LINK_FORM, 1)),
    ].sort();
    expect(perStep).toEqual(all);
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
/* ==================================================================== *
 * Selection mode + bulk delete (the owner's "Edit next to filters")
 * ==================================================================== */

describe("row selection", () => {
  it("toggles one id on and back off", () => {
    expect(toggleLinkSelection([], 7)).toEqual([7]);
    expect(toggleLinkSelection([7], 7)).toEqual([]);
    expect(toggleLinkSelection([3, 7], 9)).toEqual([3, 7, 9]);
    expect(toggleLinkSelection([3, 7, 9], 7)).toEqual([3, 9]);
  });

  it("never mutates the array it was given", () => {
    const before = [1, 2, 3];
    toggleLinkSelection(before, 2);
    setPageLinkSelection(before, [4, 5], true);
    pruneLinkSelection(before, [1]);
    expect(before).toEqual([1, 2, 3]);
  });

  it("reads membership", () => {
    expect(isLinkSelected([1, 2], 2)).toBe(true);
    expect(isLinkSelected([1, 2], 3)).toBe(false);
    expect(isLinkSelected([], 1)).toBe(false);
  });

  it("select-all adds only the page rows that are missing, once each", () => {
    expect(setPageLinkSelection([], [1, 2, 3], true)).toEqual([1, 2, 3]);
    expect(setPageLinkSelection([2], [1, 2, 3], true)).toEqual([2, 1, 3]);
    // Idempotent — a second select-all must not double anything up.
    const once = setPageLinkSelection([], [1, 2, 3], true);
    expect(setPageLinkSelection(once, [1, 2, 3], true)).toEqual([1, 2, 3]);
  });

  it("clear-all on the page drops exactly the page rows", () => {
    expect(setPageLinkSelection([1, 2, 3], [1, 3], false)).toEqual([2]);
    expect(setPageLinkSelection([1, 2, 3], [1, 2, 3], false)).toEqual([]);
  });

  it("reports full / partial page selection for the header checkbox", () => {
    expect(isPageFullySelected([1, 2], [1, 2])).toBe(true);
    expect(isPageFullySelected([1], [1, 2])).toBe(false);
    expect(isPagePartiallySelected([1], [1, 2])).toBe(true);
    expect(isPagePartiallySelected([1, 2], [1, 2])).toBe(false);
    expect(isPagePartiallySelected([], [1, 2])).toBe(false);
  });

  it("an empty page is neither fully nor partially selected", () => {
    // Guards the header checkbox on a zero-row page: "every id in []" is
    // vacuously true, which would otherwise render it ticked.
    expect(isPageFullySelected([], [])).toBe(false);
    expect(isPagePartiallySelected([], [])).toBe(false);
  });

  it("prunes to what is on screen, so a filter change can't leave rows armed", () => {
    // The whole reason this exists: an id selected on page 1 must not still be
    // queued for deletion while the user is looking at page 2 with no way to
    // untick it.
    expect(pruneLinkSelection([1, 2, 3], [2, 3, 4])).toEqual([2, 3]);
    expect(pruneLinkSelection([1, 2], [])).toEqual([]);
    expect(pruneLinkSelection([], [1, 2])).toEqual([]);
  });
});

describe("the bulk-delete request body", () => {
  it("de-duplicates and keeps click order", () => {
    expect(toBulkDeleteIds([3, 1, 3, 2, 1])).toEqual([3, 1, 2]);
  });

  it("drops anything that is not a positive integer id", () => {
    expect(toBulkDeleteIds([0, -1, 1.5, Number.NaN, 4])).toEqual([4]);
  });
});

describe("the 100-id cap", () => {
  it("matches MAX_LINKS_PER_BULK_DELETE on the endpoint", () => {
    expect(MAX_LINKS_PER_BULK_DELETE).toBe(100);
  });

  it("refuses an empty selection rather than posting one", () => {
    // The request model requires at least one id, so an empty POST is a 422 on
    // a destructive action — the worst possible feedback.
    expect(bulkDeleteBlockedReason([])).toBe(
      "Select at least one link to delete.",
    );
  });

  it("allows exactly the cap", () => {
    const atCap = Array.from(
      { length: MAX_LINKS_PER_BULK_DELETE },
      (_, i) => i + 1,
    );
    expect(bulkDeleteBlockedReason(atCap)).toBeNull();
  });

  it("blocks one over the cap and says what to do", () => {
    const overCap = Array.from(
      { length: MAX_LINKS_PER_BULK_DELETE + 1 },
      (_, i) => i + 1,
    );
    const reason = bulkDeleteBlockedReason(overCap);
    expect(reason).not.toBeNull();
    expect(reason).toContain("101");
    expect(reason).toContain(String(MAX_LINKS_PER_BULK_DELETE));
  });

  it("counts duplicates once, so a repeated id can't fake the cap", () => {
    const withDupes = [
      ...Array.from({ length: MAX_LINKS_PER_BULK_DELETE }, (_, i) => i + 1),
      1,
      2,
    ];
    expect(bulkDeleteBlockedReason(withDupes)).toBeNull();
  });

  it("a full page still fits inside the cap", () => {
    // Selection is pruned to the visible page, so a page-worth is the most the
    // UI can ever submit. Stated as a test so raising LINKS_PAGE_SIZE past the
    // cap fails here rather than as a 422 in someone's face.
    expect(LINKS_PAGE_SIZE).toBeLessThanOrEqual(MAX_LINKS_PER_BULK_DELETE);
  });
});

describe("the confirmation copy", () => {
  it("states the count and that it cannot be undone", () => {
    const msg = bulkDeleteConfirmMessage(4);
    expect(msg).toContain("4 links");
    expect(msg).toContain("cannot be undone");
  });

  it("reads correctly for a single link", () => {
    expect(bulkDeleteConfirmMessage(1)).toContain("1 link?");
    expect(bulkDeleteConfirmMessage(1)).not.toContain("1 links");
  });

  it("counts read as singular / plural everywhere", () => {
    expect(linkCountLabel(1)).toBe("1 link");
    expect(linkCountLabel(2)).toBe("2 links");
    expect(selectionCountLabel(0)).toBe("Nothing selected");
    expect(selectionCountLabel(1)).toBe("1 selected");
    expect(selectionCountLabel(3)).toBe("3 selected");
  });
});

describe("reporting what the best-effort delete actually did", () => {
  const result = (
    requested: number,
    deleted: number[],
    missing: number[],
  ): OpportunityLinkBulkDeleteResult => ({
    requested,
    deleted_ids: deleted,
    missing_ids: missing,
  });

  it("reports a clean batch as a plain success", () => {
    const out = bulkDeleteOutcomeMessage(result(3, [1, 2, 3], []));
    expect(out.tone).toBe("success");
    expect(out.message).toBe("Deleted 3 links.");
  });

  it("does NOT report a partial batch as a flat success", () => {
    // The owner's case: selected 5, four deleted. Saying "Deleted 5 links" is a
    // lie about a destructive action, and the count is the only thing the user
    // can check us on.
    const out = bulkDeleteOutcomeMessage(result(5, [1, 2, 3, 4], [5]));
    expect(out.tone).toBe("warning");
    expect(out.message).toContain("Deleted 4 links of 5 selected");
    expect(out.message).toContain("1 link");
  });

  it("does not claim a success when nothing was deleted", () => {
    const out = bulkDeleteOutcomeMessage(result(2, [], [1, 2]));
    expect(out.tone).toBe("warning");
    expect(out.message).toContain("Nothing was deleted");
  });

  it("never invents a number the result did not carry", () => {
    // len(deleted_ids) + len(missing_ids) == requested is the endpoint's stated
    // invariant; the copy is built from those fields and nothing else.
    const r = result(5, [1, 2, 3, 4], [5]);
    expect(r.deleted_ids.length + r.missing_ids.length).toBe(r.requested);
    expect(bulkDeleteOutcomeMessage(r).message).not.toContain("5 links");
  });
});

/* ==================================================================== *
 * Capability gating — links.delete, not surveys.manage, never a role
 * ==================================================================== */

describe("the links.delete gate", () => {
  it("uses the code the backend registers", () => {
    const src = read("src/constants/capabilities.ts");
    expect(src).toContain('LINKS_DELETE: "links.delete"');
    expect(src).toContain("export const canDeleteLinks");
    expect(src).toContain("CAPABILITY.LINKS_DELETE");
  });

  it("the list page reads the capability, not the role, and fails closed", () => {
    const src = read("src/app/(app)/links/page.tsx");
    expect(src).toContain("canDelete = canDeleteLinks(capabilities)");
    // An unreadable /auth/context must not leave the delete controls on.
    expect(src).toMatch(/catch \{[\s\S]*?canDelete = false;[\s\S]*?\}/);
    // #379: never a role-name check for a capability-backed control.
    expect(src).not.toContain("super_admin");
    expect(src).not.toContain("hasFullAccess");
    expect(src).not.toContain("isEngineer");
  });

  it("is a SEPARATE grant from surveys.manage — delete is not inferred from review", () => {
    const src = read("src/app/(app)/links/page.tsx");
    // Full Access keeps approve/reject and does NOT get delete, so the two
    // flags must come from two different capabilities.
    expect(src).toContain("canReview = canManageSurveys(capabilities)");
    expect(src).not.toContain("canDelete = canReview");
    expect(src).not.toContain("canDelete = canManageSurveys");
  });

  it("the Edit button and the delete bar both require the capability", () => {
    const toggleSrc = read("src/components/links/LinksSelection.tsx");
    expect(toggleSrc).toContain("if (!selection?.canDelete) return null;");
    // Even a forced enter() cannot open selection mode without the capability.
    expect(toggleSrc).toContain("active: canDelete && active");

    const barSrc = read("src/components/links/LinksBulkDeleteBar.tsx");
    expect(barSrc).toContain(
      "if (!selection?.canDelete || !selection.active) return null;",
    );
  });

  it("the server action re-checks the cap before it posts", () => {
    const src = read("src/app/(app)/links/actions.ts");
    expect(src).toContain("bulkDeleteBlockedReason");
    expect(src).toContain('"/opportunity-links/bulk-delete"');
    // The whole per-id result is returned, not a boolean — see the honest
    // reporting tests above.
    expect(src).toContain("OpportunityLinkBulkDeleteResult");
  });
});

describe("selection mode is ephemeral UI state", () => {
  it("never enters the URL", () => {
    // Every other control on this page is URL-driven; this one deliberately is
    // not. A shareable link pre-armed for a destructive action is a trap.
    const src = read("src/components/links/LinksSelection.tsx");
    expect(src).not.toContain("useSearchParams");
    expect(src).not.toContain("router.replace");
    expect(src).not.toContain("URLSearchParams");
    // The filter serializer knows nothing about it either.
    const withFilters: LinksFilterState = {
      ...EMPTY_LINKS_FILTERS,
      company: "Goldman",
    };
    expect(toLinksQs(withFilters)).toBe("company=Goldman");
  });

  it("leaving selection mode clears the selection", () => {
    const src = read("src/components/links/LinksSelection.tsx");
    expect(src).toMatch(/setActive\(false\);\s*setSelected\(\[\]\);/);
  });
});

describe("the delete UI introduces no icons", () => {
  it("stays text-only, checkboxes aside", () => {
    for (const path of [
      "src/components/links/LinksSelection.tsx",
      "src/components/links/LinksBulkDeleteBar.tsx",
      "src/components/links/LinksTable.tsx",
    ]) {
      const src = read(path);
      expect(src).not.toContain("lucide-react");
      expect(src).not.toMatch(/<svg/);
    }
  });

  it("takes its blue from the design tokens, never a literal hex", () => {
    for (const path of [
      "src/components/links/LinksSelection.tsx",
      "src/components/links/LinksBulkDeleteBar.tsx",
      "src/components/links/LinksTable.tsx",
    ]) {
      expect(read(path)).not.toMatch(/#[0-9a-fA-F]{6}/);
    }
    // The owner asked for blue; that is the primary Button variant, which is
    // `brand-blue-600` in tailwind.config.ts.
    expect(read("src/components/links/LinksSelection.tsx")).toContain(
      'variant={selection.active ? "secondary" : "primary"}',
    );
  });
});

describe("the engineer console picks links.delete up on its own", () => {
  it("the permission editor is driven by the backend matrix, not a local list", () => {
    // GET /engineer/permissions returns every capability with its label,
    // description, assignable flag and order, so a new backend capability
    // appears with no frontend change. If anyone ever hardcodes a list here,
    // this fails and the new capability silently disappears from the console.
    const src = read("src/components/engineer/PermissionEditor.tsx");
    expect(src).toContain("matrix.capabilities.map");
    expect(src).toContain("{cap.label}");
    expect(src).toContain("{cap.description}");
    expect(src).not.toContain("links.delete");
    expect(src).not.toContain("surveys.manage");
    expect(src).not.toContain("CAPABILITY");
  });

  it("the read-only role table in Users is driven the same way", () => {
    const src = read("src/components/admin/RoleCapabilitiesTable.tsx");
    expect(src).toContain("matrix.capabilities.filter((c) => c.assignable)");
    expect(src).not.toContain("links.delete");
    expect(src).not.toContain("CAPABILITY");
  });
});

/* ==================================================================== *
 * The owner's four form changes (#441 follow-up)
 *
 * Ordered by how much damage getting them wrong would do:
 *
 *  1. `normalizeOpportunityUrl` — the only one of the four that touches the
 *     value we STORE, and therefore the only one with a security story. It
 *     exists so a bare `jakegunnell.com` reaches the backend as a complete
 *     `https://` URL, because the backend still refuses bare hostnames on
 *     purpose and we are not relaxing it. Everything below is about the one
 *     thing that must never happen: concatenation turning a value the rules
 *     REFUSE into a value they ACCEPT. A bare hostname is the single exception,
 *     and it is the exception the owner asked for.
 *  2. The deadline rule, which must mirror the server EXACTLY — today accepted,
 *     strictly earlier refused, compared as dates in UTC. Stricter than the
 *     server is the worse failure: it silently refuses what the server would
 *     have taken.
 *  3. The two-slot location model, whose whole job is that flipping the
 *     out-of-US toggle strands nothing.
 * ==================================================================== */

describe("normalizeOpportunityUrl: the bare-domain rescue", () => {
  it("prefixes a bare domain and hands back the canonical form", () => {
    // The owner's example, verbatim.
    expect(normalizeOpportunityUrl("jakegunnell.com")).toBe(
      "https://jakegunnell.com/",
    );
  });

  it("keeps the path, query and fragment of a bare domain", () => {
    expect(normalizeOpportunityUrl("jakegunnell.com/careers")).toBe(
      "https://jakegunnell.com/careers",
    );
    expect(normalizeOpportunityUrl("careers.example.com/jobs/1234?src=alum")).toBe(
      "https://careers.example.com/jobs/1234?src=alum",
    );
    expect(normalizeOpportunityUrl("example.com/a#apply")).toBe(
      "https://example.com/a#apply",
    );
  });

  it("trims, and normalises host casing the way the browser will", () => {
    expect(normalizeOpportunityUrl("  JakeGunnell.COM/Careers  ")).toBe(
      "https://jakegunnell.com/Careers",
    );
  });

  it("leaves an already-schemed http(s) URL addressed as it was", () => {
    expect(normalizeOpportunityUrl("https://careers.example.com/jobs/1")).toBe(
      "https://careers.example.com/jobs/1",
    );
    expect(normalizeOpportunityUrl("http://jobs.example.org/apply")).toBe(
      "http://jobs.example.org/apply",
    );
    // Canonicalising a bare host adds the empty path — the browser's own form.
    expect(normalizeOpportunityUrl("https://example.com")).toBe(
      "https://example.com/",
    );
  });

  it("is idempotent — settling a settled value changes nothing", () => {
    const once = normalizeOpportunityUrl("jakegunnell.com");
    expect(normalizeOpportunityUrl(once)).toBe(once);
  });

  it("returns an empty string for an empty or whitespace-only value", () => {
    expect(normalizeOpportunityUrl("")).toBe("");
    expect(normalizeOpportunityUrl("   ")).toBe("");
  });

  /* ---- the part that must not be got wrong ---- */

  it("NEVER prefixes a value that already carries a scheme", () => {
    // Each of these is refused today. Prefixing any of them would dress it up
    // as a web address; the rule is that concatenation may only ever rescue a
    // bare hostname.
    for (const bad of [
      "javascript:alert(1)",
      "JaVaScRiPt:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "DATA:text/html;base64,PHNjcmlwdD4=",
      "file:///etc/passwd",
      "vbscript:msgbox(1)",
      "mailto:jobs@example.com",
      "tel:+18015551234",
      "blob:https://example.com/1234",
    ]) {
      expect(normalizeOpportunityUrl(bad), bad).toBe(bad);
      expect(
        validateOpportunityUrl(normalizeOpportunityUrl(bad)),
        bad,
      ).not.toBeNull();
    }
  });

  it("does not launder a scheme that only LOOKS broken", () => {
    // `java\nscript:` has no scheme as far as the regex is concerned, so it IS
    // prefixed — and then refused for the raw newline, which is the whole point
    // of running the full rule on the result instead of trusting the prefix.
    expect(
      validateOpportunityUrl(normalizeOpportunityUrl("java\nscript:alert(1)")),
    ).not.toBeNull();
    expect(
      validateOpportunityUrl(
        normalizeOpportunityUrl("javascript:alert(1)"),
      ),
    ).not.toBeNull();
  });

  it("refuses to prefix a protocol-relative or slash-led value", () => {
    // Not academic: `https://` + `//evil.example` parses to
    // `https://evil.example/` in a WHATWG parser, so gluing would MANUFACTURE
    // an authority out of a value that is refused today. Same for backslashes.
    expect(new URL("https:////evil.example").href).toBe("https://evil.example/");
    for (const bad of [
      "//evil.example/jobs",
      "/jobs/1234",
      "\\\\evil.example\\share",
      "\\evil.example",
    ]) {
      expect(normalizeOpportunityUrl(bad), bad).toBe(bad);
      expect(
        validateOpportunityUrl(normalizeOpportunityUrl(bad)),
        bad,
      ).not.toBeNull();
    }
  });

  it("still refuses backslashes and %5C once prefixed", () => {
    for (const bad of [
      "evil.example\\@acme.example/jobs",
      "evil.example%5C@acme.example/jobs",
      "evil.example%5c@acme.example/jobs",
    ]) {
      expect(
        validateOpportunityUrl(normalizeOpportunityUrl(bad)),
        bad,
      ).not.toBeNull();
    }
  });

  it("still refuses whitespace, control and invisible characters once prefixed", () => {
    for (const bad of [
      "example .com/jobs",
      "example.com/jobs 1234",
      "example.com/jobs\t1",
      "exa​mple.com",
      "example.com/‮jobs",
      "example.com/",
    ]) {
      expect(
        validateOpportunityUrl(normalizeOpportunityUrl(bad)),
        bad,
      ).not.toBeNull();
    }
  });

  it("still refuses embedded credentials once prefixed", () => {
    // Reads as acme.example to a staff member scanning the queue, resolves at
    // evil.example. Bare-domain shape, so it IS prefixed — and then refused.
    for (const bad of [
      "acme.example@evil.example/jobs",
      "www.acme.example@evil.example/jobs",
    ]) {
      expect(
        validateOpportunityUrl(normalizeOpportunityUrl(bad)),
        bad,
      ).not.toBeNull();
    }
    // With a colon it reads as a scheme (`user:`), so it is not prefixed at all
    // — and is refused for the unknown scheme instead. Either door, same answer.
    expect(normalizeOpportunityUrl("user:pw@evil.example/jobs")).toBe(
      "user:pw@evil.example/jobs",
    );
    expect(
      validateOpportunityUrl(
        normalizeOpportunityUrl("user:pw@evil.example/jobs"),
      ),
    ).not.toBeNull();
  });

  it("still refuses a bare label with no dot in it", () => {
    for (const bad of ["localhost", "intranet", "localhost/jobs"]) {
      expect(normalizeOpportunityUrl(bad), bad).toBe(bad);
      expect(
        validateOpportunityUrl(normalizeOpportunityUrl(bad)),
        bad,
      ).not.toBeNull();
    }
  });

  it("checks the length cap against the FINAL string, not the typed one", () => {
    // Prefixing adds eight characters, so a value that fits before it can stop
    // fitting after it. The column is what has to hold the result.
    const underBefore = `e.com/${"a".repeat(URL_MAX - 6)}`;
    expect(underBefore).toHaveLength(URL_MAX);
    // Prefixed it busts the column, so the rescue is declined...
    expect(validateOpportunityUrl(`https://${underBefore}`)).toBe(
      `Must be ${URL_MAX} characters or fewer.`,
    );
    // ...and the value comes back exactly as typed, still refused.
    expect(normalizeOpportunityUrl(underBefore)).toBe(underBefore);
    expect(
      validateOpportunityUrl(normalizeOpportunityUrl(underBefore)),
    ).not.toBeNull();

    // One that lands exactly on the cap after prefixing is accepted.
    const exact = `e.com/${"a".repeat(URL_MAX - 8 - 6)}`;
    const normalised = normalizeOpportunityUrl(exact);
    expect(normalised).toHaveLength(URL_MAX);
    expect(validateOpportunityUrl(normalised)).toBeNull();
  });

  it("does not let CANONICALISING push a value over the cap", () => {
    // A bare host has no path, so `new URL(...).href` adds a "/" and grows the
    // string by one. On the boundary that would produce something the server
    // refuses, so the pre-canonical form — which already passed everything —
    // is what comes back.
    const host = `${"a".repeat(60)}.`.repeat(33) + `${"a".repeat(23)}.com`;
    const candidate = `https://${host}`;
    expect(candidate).toHaveLength(URL_MAX);
    expect(new URL(candidate).href).toHaveLength(URL_MAX + 1);

    const normalised = normalizeOpportunityUrl(host);
    expect(normalised).toBe(candidate);
    expect(validateOpportunityUrl(normalised)).toBeNull();
  });

  it("the invariant, stated once: it either changes nothing or produces something valid", () => {
    // The single property that makes this safe to run over arbitrary input.
    // Anything it REWRITES has been through the whole door; anything it could
    // not rescue comes back exactly as typed (trimmed), so the message the user
    // reads is about the text still in their box.
    for (const raw of [
      "jakegunnell.com",
      "jakegunnell.com/careers?x=1",
      "https://example.com",
      "http://example.com/a",
      "javascript:alert(1)",
      "data:text/html,x",
      "//evil.example",
      "\\evil.example",
      "acme.example@evil.example/jobs",
      "localhost",
      "example .com",
      "",
      "   ",
      "not a url at all",
      "?",
      "...",
      "https://",
    ]) {
      const out = normalizeOpportunityUrl(raw);
      if (out === raw.trim()) continue;
      expect(validateOpportunityUrl(out), raw).toBeNull();
    }
  });

  it("what is stored is exactly what becomes the href", () => {
    // The reason canonicalisation happens at all: the staff table runs
    // `linkTarget` over the STORED string, and a stored value that differs from
    // its own href is a value we validated in one form and rendered in another.
    for (const raw of [
      "jakegunnell.com",
      "jakegunnell.com/careers",
      "JakeGunnell.com",
      "https://example.com",
      "https://careers.example.com/jobs/1?a=b#c",
      "http://jobs.example.org/apply",
    ]) {
      const stored = normalizeOpportunityUrl(raw);
      expect(validateOpportunityUrl(stored), raw).toBeNull();
      expect(linkTarget(stored).href, raw).toBe(stored);
    }
  });
});

describe("settleOpportunityUrl: what blur does", () => {
  it("hands back the normalised value and no complaint for a bare domain", () => {
    expect(settleOpportunityUrl("jakegunnell.com")).toEqual({
      value: "https://jakegunnell.com/",
      error: null,
    });
  });

  it("says nothing about an empty box", () => {
    // Blur is a convenience. "A link is required" belongs to submit, not to
    // tabbing past a row on the way to the one below it.
    expect(settleOpportunityUrl("")).toEqual({ value: "", error: null });
    expect(settleOpportunityUrl("   ")).toEqual({ value: "", error: null });
  });

  it("complains about a value it could not rescue, leaving the text alone", () => {
    const settled = settleOpportunityUrl("javascript:alert(1)");
    expect(settled.value).toBe("javascript:alert(1)");
    expect(settled.error).toBe(validateOpportunityUrl("javascript:alert(1)"));
  });

  it("agrees with the submit path, always", () => {
    // Blur validation is a convenience layered ON the submit check, never a
    // replacement — so the two must never reach different verdicts.
    for (const raw of [
      "jakegunnell.com",
      "https://example.com/jobs",
      "javascript:alert(1)",
      "localhost",
      "acme.example@evil.example/jobs",
    ]) {
      const settled = settleOpportunityUrl(raw);
      const onSubmit = validateLinkEntry(entry({ url: raw })).url ?? null;
      expect(settled.error, raw).toBe(onSubmit);
    }
  });
});

describe("the application deadline must not be in the past", () => {
  // Mid-UTC-day so the fixture itself is never the ambiguous part.
  const now = new Date("2026-08-17T12:00:00Z");

  it("accepts TODAY — the server does, and stricter is the worse failure", () => {
    expect(validateApplicationDeadline("2026-08-17", now)).toBeNull();
  });

  it("refuses a strictly earlier date", () => {
    expect(validateApplicationDeadline("2026-08-16", now)).toBeTruthy();
    expect(validateApplicationDeadline("2019-01-01", now)).toBeTruthy();
  });

  it("accepts a future date", () => {
    expect(validateApplicationDeadline("2026-08-18", now)).toBeNull();
    expect(validateApplicationDeadline("2030-12-31", now)).toBeNull();
  });

  it("treats a blank deadline as fine — the field is optional", () => {
    expect(validateApplicationDeadline("", now)).toBeNull();
    expect(validateApplicationDeadline("   ", now)).toBeNull();
  });

  it("stays LAXER than the server on a shape it does not understand", () => {
    // The native date input can only produce yyyy-mm-dd or "". Anything else
    // arrived some other way; refusing it here could block a value the server
    // would have taken, so it is passed through for the server to judge.
    expect(validateApplicationDeadline("not a date", now)).toBeNull();
    expect(validateApplicationDeadline("08/16/2026", now)).toBeNull();
  });

  it("compares dates in UTC, with no timezone arithmetic to drift", () => {
    // Late-UTC-evening "now": the boundary a Date-based comparison gets wrong
    // for anyone west of Greenwich. Today is still today.
    const lateUtc = new Date("2026-08-17T23:59:59Z");
    expect(todayIsoUtc(lateUtc)).toBe("2026-08-17");
    expect(validateApplicationDeadline("2026-08-17", lateUtc)).toBeNull();
    expect(validateApplicationDeadline("2026-08-16", lateUtc)).toBeTruthy();

    const earlyUtc = new Date("2026-08-17T00:00:00Z");
    expect(todayIsoUtc(earlyUtc)).toBe("2026-08-17");
    expect(validateApplicationDeadline("2026-08-17", earlyUtc)).toBeNull();
  });

  it("is enforced on both forms, from the one rule", () => {
    expect(
      validateLinkEntry(entry({ deadline: "2026-08-16" }), now).deadline,
    ).toBe(validateApplicationDeadline("2026-08-16", now));
    expect(
      validateLinkEntry(entry({ deadline: "2026-08-17" }), now).deadline,
    ).toBeUndefined();

    const staff = {
      ...EMPTY_ADD_LINK_FORM,
      alumniId: 42,
      companyName: "Zions Bancorporation",
      url: "https://example.com/careers",
    };
    expect(
      validateAddLink({ ...staff, applicationDeadline: "2026-08-16" }, now)
        .applicationDeadline,
    ).toBeTruthy();
    expect(
      validateAddLink({ ...staff, applicationDeadline: "2026-08-17" }, now)
        .applicationDeadline,
    ).toBeUndefined();
  });

  it("belongs to step 2 of the staff wizard, where the field is", () => {
    const values = {
      ...EMPTY_ADD_LINK_FORM,
      alumniId: 42,
      companyName: "Zions Bancorporation",
      url: "https://example.com/careers",
      applicationDeadline: "2026-08-16",
    };
    expect(validateAddLinkStep(values, 0, now)).toEqual({});
    expect(validateAddLinkStep(values, 1, now).applicationDeadline).toBeTruthy();
  });
});

describe("both forms accept a bare domain, and store the schemed one", () => {
  it("the alum-facing form validates the NORMALISED url", () => {
    // Typed and submitted with Enter, never blurred: the verdict must be the
    // same one blur would have reached.
    expect(
      validateLinkEntry(entry({ url: "jakegunnell.com" })).url,
    ).toBeUndefined();
    expect(
      validateLinkEntry(entry({ url: "javascript:alert(1)" })).url,
    ).toBeTruthy();
    expect(validateLinkEntry(entry({ url: "" })).url).toBe("A link is required.");
  });

  it("the staff form validates the NORMALISED url", () => {
    const staff = {
      ...EMPTY_ADD_LINK_FORM,
      alumniId: 42,
      companyName: "Zions Bancorporation",
    };
    expect(
      validateAddLink({ ...staff, url: "jakegunnell.com" }).url,
    ).toBeUndefined();
    expect(
      validateAddLink({ ...staff, url: "javascript:alert(1)" }).url,
    ).toBeTruthy();
  });

  it("both wire mappers send the schemed value, never the typed one", () => {
    const [wire] = linksToSubmit([entry({ url: "  jakegunnell.com  " })]);
    expect(wire.url).toBe("https://jakegunnell.com/");

    const body = toCreateBody({
      ...EMPTY_ADD_LINK_FORM,
      alumniId: 42,
      url: "jakegunnell.com/careers",
    });
    expect(body.url).toBe("https://jakegunnell.com/careers");
  });
});

describe("the out-of-US location toggle strands nothing", () => {
  const usEntry = entry({ state: "Utah", city: "Provo" });

  it("submits the US state while the toggle is off", () => {
    const [wire] = linksToSubmit([usEntry]);
    expect(wire.location_state).toBe("Utah");
    expect(wire.location_country).toBeNull();
  });

  it("keeps the picked state when the toggle goes on, and restores it", () => {
    // The two modes own two different slots, so this is a round trip, not a
    // rewrite: nothing was overwritten on the way out and nothing needs
    // reconstructing on the way back.
    const abroad: LinkEntry = {
      ...usEntry,
      isOutsideUS: true,
      region: "Ontario",
      country: "Canada",
    };
    expect(abroad.state).toBe("Utah");

    const [wire] = linksToSubmit([abroad]);
    expect(wire.location_state).toBe("Ontario");
    expect(wire.location_country).toBe("Canada");

    const [back] = linksToSubmit([{ ...abroad, isOutsideUS: false }]);
    expect(back.location_state).toBe("Utah");
    expect(back.location_country).toBeNull();
  });

  it("does the same on the staff form", () => {
    const base = {
      ...EMPTY_ADD_LINK_FORM,
      alumniId: 42,
      companyName: "Acme",
      url: "https://example.com/careers",
      locationState: "Utah",
      locationRegion: "Bavaria",
      locationCountry: "Germany",
    };
    expect(toCreateBody(base)).toMatchObject({
      location_state: "Utah",
      location_country: null,
    });
    expect(toCreateBody({ ...base, isOutsideUS: true })).toMatchObject({
      location_state: "Bavaria",
      location_country: "Germany",
    });
  });

  it("only complains about the control that is on screen", () => {
    // A message about a box the user cannot see is a message they cannot act on.
    const bad = "=cmd|'/c calc'!A1";
    expect(
      validateLinkEntry(entry({ isOutsideUS: false, region: bad, country: bad })),
    ).toMatchObject({});
    const abroad = validateLinkEntry(
      entry({ isOutsideUS: true, region: bad, country: bad }),
    );
    expect(abroad.state).toBeTruthy();
    expect(abroad.country).toBeTruthy();
  });

  it("caps the region and country at the column widths", () => {
    expect(STATE_MAX).toBe(100);
    expect(COUNTRY_MAX).toBe(100);
    const long = "a".repeat(COUNTRY_MAX + 1);
    expect(
      validateLinkEntry(entry({ isOutsideUS: true, country: long })).country,
    ).toBe(`Must be ${COUNTRY_MAX} characters or fewer.`);
    expect(
      validateAddLink({
        ...EMPTY_ADD_LINK_FORM,
        alumniId: 1,
        companyName: "Acme",
        url: "https://example.com/a",
        isOutsideUS: true,
        locationCountry: long,
      }).locationCountry,
    ).toBeTruthy();
  });

  it("a row carrying only out-of-US answers is not 'blank'", () => {
    // A blank row is DROPPED unvalidated. If the new fields were left out of
    // that check, someone who filled in nothing but a country would have their
    // entry silently discarded.
    expect(isBlankLinkEntry({ ...emptyLinkEntry(), country: "Canada" })).toBe(
      false,
    );
    expect(isBlankLinkEntry({ ...emptyLinkEntry(), region: "Ontario" })).toBe(
      false,
    );
    expect(isBlankLinkEntry({ ...emptyLinkEntry(), isOutsideUS: true })).toBe(
      false,
    );
    expect(isBlankLinkEntry(emptyLinkEntry())).toBe(true);
  });

  it("the staff list prints the country when there is one", () => {
    expect(
      locationDisplay(
        link({
          location_city: "Toronto",
          location_state: "Ontario",
          location_country: "Canada",
        }),
      ),
    ).toBe("Toronto, Ontario, Canada");
    expect(
      locationDisplay(
        link({
          location_city: null,
          location_state: null,
          location_country: "Japan",
        }),
      ),
    ).toBe("Japan");
    // A domestic row is unchanged — US mode stores no country, so there is
    // nothing extra to print.
    expect(locationDisplay(link())).toBe("Provo, UT");
  });
});

describe("the two forms wire the same rules to the same controls", () => {
  it("both import the one normalisation helper rather than re-deriving it", () => {
    for (const path of [
      "src/components/links/AddLinkForm.tsx",
      "src/components/survey/survey-screens.tsx",
    ]) {
      const src = read(path);
      expect(src, path).toContain("settleOpportunityUrl");
      expect(src, path).toContain('from "@/lib/opportunityLinks"');
      // The rule itself must never be re-spelled inside a component.
      expect(src, path).not.toContain('"https://" +');
      expect(src, path).not.toContain("`https://${");
    }
  });

  it("both validate the URL on blur, not only on save", () => {
    expect(read("src/components/links/AddLinkForm.tsx")).toContain(
      "onBlur={settleUrl}",
    );
    expect(read("src/components/survey/survey-screens.tsx")).toContain(
      "onBlur={settleUrl}",
    );
  });

  it("both floor the deadline picker at today", () => {
    for (const path of [
      "src/components/links/AddLinkForm.tsx",
      "src/components/survey/survey-screens.tsx",
    ]) {
      const src = read(path);
      expect(src, path).toContain("todayIsoUtc");
      expect(src, path).toContain("min={minDeadline}");
    }
  });

  it("the staff form reuses the shared states control, not a new list", () => {
    const src = read("src/components/links/AddLinkForm.tsx");
    expect(src).toContain('from "@/components/alumni/StateCombobox"');
    expect(src).toContain("<StateCombobox");
  });

  it("the survey keeps its native state dropdown over the shared list", () => {
    const src = read("src/components/survey/survey-screens.tsx");
    expect(src).toContain('from "@/lib/geo/state-field"');
    expect(src).toContain("options={STATE_NAMES}");
  });

  it("the out-of-US toggle is text, on both forms", () => {
    for (const path of [
      "src/components/links/AddLinkForm.tsx",
      "src/components/survey/survey-screens.tsx",
    ]) {
      expect(read(path), path).toMatch(/outside the United States/i);
    }
    // The staff form has no icon set at all — the standing project rule.
    const staff = read("src/components/links/AddLinkForm.tsx");
    expect(staff).not.toContain("lucide-react");
    expect(staff).not.toMatch(/<svg/);
  });
});

describe("opportunity links stay OUT of the survey's three-list machinery", () => {
  it("the new fields introduce no `table.column` survey field", () => {
    // The parity suite binds the form list, the email picker and the sample
    // record together on `table.column` keys. Links are rows in their own table
    // posted to their own endpoint, so a location country here must never
    // become a survey field — that is what would make the staff email offer
    // "the opportunity link we have on file", which is not a thing that exists.
    const src = read("src/components/survey/survey-screens.tsx");
    expect(src).not.toContain('"links.location_country"');
    expect(src).not.toContain('"links.state"');
    expect(read("src/lib/sampleAlumni.ts")).not.toContain("location_country");
  });
});
