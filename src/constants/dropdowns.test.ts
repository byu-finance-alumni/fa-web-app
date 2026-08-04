import { describe, it, expect } from "vitest";
import {
  EMPLOYMENT_STATUS_OPTIONS,
  EMPLOYMENT_STATUS_PLACEHOLDERS,
  INDUSTRY_OPTIONS,
  isEmploymentStatusPlaceholder,
  PRIMARY_EXCLUDED_INDUSTRIES,
  PRIMARY_INDUSTRY_OPTIONS,
  SECONDARY_INDUSTRY_OPTIONS,
  SURVEY_EMPLOYMENT_STATUS_OPTIONS,
  filterPrimaryIndustries,
} from "./dropdowns";

/**
 * These lists are FALLBACKS — the live options come from /vocabulary/industry.
 * They're still worth pinning: a fallback that disagrees with the endpoint shows
 * the wrong options for the first paint of every form, and is what the dropdown
 * keeps for good if the fetch fails.
 */

/**
 * Case-insensitive sort with the pinned tail held last, in this fixed order:
 * "Unknown" (#295), "Graduate Student" (#294), then the "Other" catch-all (#282).
 * The rest of the list is alphabetized.
 */
const PINNED_TAIL = ["Unknown", "Graduate Student", "Other"];
function expectedOrder(values: readonly string[]): string[] {
  const rest = values.filter((v) => !PINNED_TAIL.includes(v));
  rest.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  const tail = PINNED_TAIL.filter((v) => values.includes(v));
  return [...rest, ...tail];
}

describe("INDUSTRY_OPTIONS", () => {
  it("is alphabetized case-insensitively with Other pinned last", () => {
    expect([...INDUSTRY_OPTIONS]).toEqual(expectedOrder(INDUSTRY_OPTIONS));
  });

  it("puts Financial Services in alphabetical order, before FP&A", () => {
    // Tanya's ask (#452): it used to sit just before "Other".
    const i = INDUSTRY_OPTIONS.indexOf("Financial Services");
    expect(INDUSTRY_OPTIONS[i - 1]).toBe("Equity Research");
    expect(INDUSTRY_OPTIONS[i + 1]).toBe("FP&A");
  });

  it("stores Sales and Trading with 'and', not an ampersand", () => {
    expect(INDUSTRY_OPTIONS).toContain("Sales and Trading");
    expect(INDUSTRY_OPTIONS).not.toContain("Sales & Trading");
  });

  it("has no duplicates", () => {
    expect(new Set(INDUSTRY_OPTIONS).size).toBe(INDUSTRY_OPTIONS.length);
  });
});

describe("PRIMARY_INDUSTRY_OPTIONS", () => {
  it("excludes exactly the four secondary-only industries", () => {
    for (const v of PRIMARY_EXCLUDED_INDUSTRIES) {
      expect(PRIMARY_INDUSTRY_OPTIONS).not.toContain(v);
    }
    expect(PRIMARY_INDUSTRY_OPTIONS).toHaveLength(
      INDUSTRY_OPTIONS.length - PRIMARY_EXCLUDED_INDUSTRIES.length,
    );
  });

  it("is the finance options in order, then the pinned tail", () => {
    expect([...PRIMARY_INDUSTRY_OPTIONS]).toEqual([
      "Asset Management",
      "Commercial Banking",
      "Consulting",
      "Corporate Finance",
      "Equity Research",
      "Financial Services",
      "FP&A",
      "Investment Banking",
      "Private Banking",
      "Private Credit",
      "Private Equity",
      "Real Estate",
      "Sales",
      "Valuation & Advisory",
      "Venture Capital",
      "Wealth Management",
      "Unknown",
      "Graduate Student",
      "Other",
    ]);
  });

  it("keeps Other last after filtering", () => {
    expect(PRIMARY_INDUSTRY_OPTIONS.at(-1)).toBe("Other");
  });

  it("keeps Sales, which must not be confused with Sales and Trading", () => {
    expect(PRIMARY_INDUSTRY_OPTIONS).toContain("Sales");
    expect(PRIMARY_INDUSTRY_OPTIONS).not.toContain("Sales and Trading");
  });
});

describe("SECONDARY_INDUSTRY_OPTIONS", () => {
  it("keeps the full list — the four hidden from primary live here", () => {
    expect([...SECONDARY_INDUSTRY_OPTIONS]).toEqual([...INDUSTRY_OPTIONS]);
    for (const v of PRIMARY_EXCLUDED_INDUSTRIES) {
      expect(SECONDARY_INDUSTRY_OPTIONS).toContain(v);
    }
  });

  it("is the full industry list (finance + Unknown/Graduate Student/Other)", () => {
    expect(SECONDARY_INDUSTRY_OPTIONS).toHaveLength(23);
  });
});

// The seven that shipped in #568, frozen verbatim: #377 only APPENDS to them.
const SEVEN_BEFORE_377 = [
  "Full-time",
  "Part-time",
  "Self-Employed",
  "Graduate Student",
  "Military",
  "Not in the Labor Force",
  "Unemployed",
];

describe("EMPLOYMENT_STATUS_OPTIONS", () => {
  // Unlike the industry lists this one is NOT a fallback — there's no
  // `/vocabulary/employment_status` endpoint, so this array IS what every
  // dropdown shows. Pin it verbatim: the order is Tanya's (#568), not
  // alphabetical, and "Not in the Labor Force" vs "Unemployed" is a distinction
  // the dashboard counts on.
  it("is the seven statuses plus Unknown, in Tanya's order", () => {
    expect([...EMPLOYMENT_STATUS_OPTIONS]).toEqual([
      ...SEVEN_BEFORE_377,
      "Unknown",
    ]);
  });

  it("pins Unknown last rather than sorting it in", () => {
    // Mirrors how INDUSTRY_OPTIONS pins its own "Unknown" (#295).
    expect(EMPLOYMENT_STATUS_OPTIONS.at(-1)).toBe("Unknown");
  });

  it("did not disturb the original seven's order", () => {
    // #377 is additive. A "helpful" alphabetization here silently reorders the
    // filter, both staff forms and the survey at once.
    expect(EMPLOYMENT_STATUS_OPTIONS.slice(0, -1)).toEqual(SEVEN_BEFORE_377);
  });

  it("offers Unknown, which ~65 prod alumni hold after the 2026-08-04 cleanup", () => {
    // The urgent bit of #377: it is live in the production database, so it has
    // to be a real option or those records fail validation on the next edit.
    expect(EMPLOYMENT_STATUS_OPTIONS).toContain("Unknown");
  });

  it("has no duplicates", () => {
    expect(new Set(EMPLOYMENT_STATUS_OPTIONS).size).toBe(
      EMPLOYMENT_STATUS_OPTIONS.length,
    );
  });

  it("fits alumni.employment_status varchar(50)", () => {
    for (const v of EMPLOYMENT_STATUS_OPTIONS) {
      expect(v.length).toBeLessThanOrEqual(50);
    }
  });
});

describe("isEmploymentStatusPlaceholder", () => {
  it("matches Unknown case-insensitively — prod holds both spellings", () => {
    // 24 rows are "Unknown", 17 are "UNKNOWN" (free-text intake sheet).
    expect(isEmploymentStatusPlaceholder("Unknown")).toBe(true);
    expect(isEmploymentStatusPlaceholder("UNKNOWN")).toBe(true);
    expect(isEmploymentStatusPlaceholder("unknown")).toBe(true);
  });

  it("ignores surrounding whitespace", () => {
    expect(isEmploymentStatusPlaceholder("  Unknown ")).toBe(true);
  });

  it("treats blank/missing as not a placeholder — there is nothing to hide", () => {
    expect(isEmploymentStatusPlaceholder("")).toBe(false);
    expect(isEmploymentStatusPlaceholder("   ")).toBe(false);
    expect(isEmploymentStatusPlaceholder(null)).toBe(false);
    expect(isEmploymentStatusPlaceholder(undefined)).toBe(false);
  });

  it("leaves real answers alone, including legacy ones off the list", () => {
    // "Employed" is a real (if ambiguous) answer on 3 prod rows — it must keep
    // the normal preserve-and-offer behaviour, not be blanked.
    for (const v of ["Employed", "Full-time", "Graduate Student", "Retired"]) {
      expect(isEmploymentStatusPlaceholder(v)).toBe(false);
    }
  });

  it("never hides one of the seven real answers", () => {
    for (const v of SEVEN_BEFORE_377) {
      expect(isEmploymentStatusPlaceholder(v)).toBe(false);
    }
  });

  it("keeps the placeholder list disjoint from what the SURVEY offers", () => {
    // #377 made "Unknown" a canonical option, so the disjointness that matters
    // is against the survey list — the one place it must never be offered.
    for (const p of EMPLOYMENT_STATUS_PLACEHOLDERS) {
      expect(SURVEY_EMPLOYMENT_STATUS_OPTIONS).not.toContain(p);
      // …but it IS a canonical option; it is not a parallel vocabulary.
      expect(EMPLOYMENT_STATUS_OPTIONS).toContain(p);
    }
  });
});

describe("SURVEY_EMPLOYMENT_STATUS_OPTIONS", () => {
  it("does NOT offer Unknown as a self-description (#377)", () => {
    // Nobody describes themselves as unknown, and offering it back to an alum
    // re-collects the non-answer the survey exists to clear.
    expect(SURVEY_EMPLOYMENT_STATUS_OPTIONS).not.toContain("Unknown");
  });

  it("is the canonical list minus exactly the placeholders", () => {
    expect([...SURVEY_EMPLOYMENT_STATUS_OPTIONS]).toEqual(SEVEN_BEFORE_377);
    expect(
      EMPLOYMENT_STATUS_OPTIONS.filter(
        (v) => !SURVEY_EMPLOYMENT_STATUS_OPTIONS.includes(v),
      ),
    ).toEqual([...EMPLOYMENT_STATUS_PLACEHOLDERS]);
  });

  it("preserves the canonical order", () => {
    expect([...SURVEY_EMPLOYMENT_STATUS_OPTIONS]).toEqual(
      EMPLOYMENT_STATUS_OPTIONS.filter((v) =>
        SURVEY_EMPLOYMENT_STATUS_OPTIONS.includes(v),
      ),
    );
  });

  it("is derived, not a second hand-typed list", () => {
    // A ninth status must reach the survey without anyone remembering to update
    // a parallel array — that drift is exactly what #568 removed.
    expect(SURVEY_EMPLOYMENT_STATUS_OPTIONS.length).toBe(
      EMPLOYMENT_STATUS_OPTIONS.length - EMPLOYMENT_STATUS_PLACEHOLDERS.length,
    );
  });
});

describe("filterPrimaryIndustries", () => {
  it("preserves the order of what it keeps", () => {
    expect(filterPrimaryIndustries(["Consulting", "Law", "Sales"])).toEqual([
      "Consulting",
      "Sales",
    ]);
  });

  it("matches case-insensitively — admin edits can drift term casing", () => {
    expect(filterPrimaryIndustries(["law", "CREDIT RISK", "Consulting"])).toEqual(
      ["Consulting"],
    );
  });

  it("ignores surrounding whitespace on a term", () => {
    expect(filterPrimaryIndustries([" Law ", "Consulting"])).toEqual([
      "Consulting",
    ]);
  });

  it("leaves an unrelated vocabulary untouched", () => {
    const other = ["Mentor", "Speaker"];
    expect(filterPrimaryIndustries(other)).toEqual(other);
  });
});
