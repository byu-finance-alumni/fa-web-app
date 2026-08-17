import { describe, expect, it } from "vitest";

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
