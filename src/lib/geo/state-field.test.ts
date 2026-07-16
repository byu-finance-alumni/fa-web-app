import { describe, it, expect } from "vitest";
import {
  STATE_NAMES,
  regionForState,
  stateSuggestions,
  toFullStateName,
} from "./state-field";

/** A stand-in for the server's `region_by_state`, keyed by FULL state name. */
const REGION_BY_STATE = {
  Connecticut: "Northeast",
  Florida: "Southeast",
  Ohio: "Midwest",
  Texas: "Southwest",
  Utah: "West",
  "New York": "Northeast",
  "District of Columbia": "Southeast",
};

describe("STATE_NAMES", () => {
  it("offers the 50 states + DC and no territories", () => {
    expect(STATE_NAMES).toHaveLength(51);
    expect(STATE_NAMES).toContain("District of Columbia");
    expect(STATE_NAMES).not.toContain("Puerto Rico");
    expect(STATE_NAMES).not.toContain("Guam");
  });

  it("uses full names, never USPS abbreviations", () => {
    expect(STATE_NAMES).toContain("Utah");
    expect(STATE_NAMES).not.toContain("UT");
    // No entry is a bare 2-letter code.
    expect(STATE_NAMES.filter((n) => n.length === 2)).toEqual([]);
  });
});

describe("toFullStateName", () => {
  it("expands a USPS code to the full name, any casing", () => {
    expect(toFullStateName("UT")).toBe("Utah");
    expect(toFullStateName("ut")).toBe("Utah");
    expect(toFullStateName("Ny")).toBe("New York");
    expect(toFullStateName("dc")).toBe("District of Columbia");
  });

  it("canonicalizes the casing of a full name", () => {
    expect(toFullStateName("utah")).toBe("Utah");
    expect(toFullStateName("UTAH")).toBe("Utah");
    expect(toFullStateName("new york")).toBe("New York");
  });

  it("trims surrounding whitespace", () => {
    expect(toFullStateName("  Utah  ")).toBe("Utah");
    expect(toFullStateName("  ut ")).toBe("Utah");
  });

  it("returns '' for blank/nullish input", () => {
    expect(toFullStateName("")).toBe("");
    expect(toFullStateName("   ")).toBe("");
    expect(toFullStateName(null)).toBe("");
    expect(toFullStateName(undefined)).toBe("");
  });

  it("leaves an international province untouched — free text is valid", () => {
    expect(toFullStateName("Ontario")).toBe("Ontario");
    expect(toFullStateName("Bavaria")).toBe("Bavaria");
    // A 2-letter non-US value isn't a state code; it must survive verbatim.
    expect(toFullStateName("ZZ")).toBe("ZZ");
  });
});

describe("stateSuggestions", () => {
  it("offers every state for an empty query", () => {
    expect(stateSuggestions("")).toEqual(STATE_NAMES);
    expect(stateSuggestions("   ")).toEqual(STATE_NAMES);
  });

  it("filters by name prefix, case-insensitively", () => {
    expect(stateSuggestions("co")).toContain("Colorado");
    expect(stateSuggestions("co")).toContain("Connecticut");
    expect(stateSuggestions("CONN")).toEqual(["Connecticut"]);
  });

  it("puts name-prefix matches ahead of substring matches", () => {
    const hits = stateSuggestions("new");
    expect(hits[0]).toBe("New Hampshire");
    // "New Mexico" (prefix) must outrank nothing here, but a substring-only
    // match must never displace a prefix match.
    expect(hits.every((h) => h.toLowerCase().startsWith("new"))).toBe(true);
  });

  it("resolves a USPS code to its state", () => {
    expect(stateSuggestions("ut")).toContain("Utah");
    expect(stateSuggestions("ny")).toContain("New York");
  });

  it("finds a state by an interior word", () => {
    expect(stateSuggestions("york")).toEqual(["New York"]);
    expect(stateSuggestions("virginia")).toEqual(["Virginia", "West Virginia"]);
  });

  it("returns nothing for an international province — but it stays typeable", () => {
    // No suggestion is NOT a rejection: the combobox keeps whatever is typed.
    expect(stateSuggestions("Bavaria")).toEqual([]);
  });
});

describe("regionForState", () => {
  it("maps a canonical full state name to its region", () => {
    expect(regionForState(REGION_BY_STATE, "Utah")).toBe("West");
    expect(regionForState(REGION_BY_STATE, "Florida")).toBe("Southeast");
    expect(regionForState(REGION_BY_STATE, "New York")).toBe("Northeast");
  });

  it("expands a 2-letter code before looking up", () => {
    // The map is keyed by full name only; a form holding "UT" must still resolve.
    expect(regionForState(REGION_BY_STATE, "UT")).toBe("West");
    expect(regionForState(REGION_BY_STATE, "ny")).toBe("Northeast");
  });

  it("normalizes casing and whitespace before looking up", () => {
    expect(regionForState(REGION_BY_STATE, "  utah ")).toBe("West");
    expect(regionForState(REGION_BY_STATE, "TEXAS")).toBe("Southwest");
  });

  it("returns null for a blank state", () => {
    expect(regionForState(REGION_BY_STATE, "")).toBeNull();
    expect(regionForState(REGION_BY_STATE, "  ")).toBeNull();
    expect(regionForState(REGION_BY_STATE, null)).toBeNull();
  });

  it("returns null for a non-US value — regions are US-only", () => {
    // Callers must leave the stored region alone rather than blank it.
    expect(regionForState(REGION_BY_STATE, "Ontario")).toBeNull();
    expect(regionForState(REGION_BY_STATE, "Bavaria")).toBeNull();
  });

  it("returns null for a US state missing from the map", () => {
    expect(regionForState(REGION_BY_STATE, "Idaho")).toBeNull();
  });

  it("returns null before the crosswalk has loaded", () => {
    // No fallback map exists on purpose — guessing a region is worse than not
    // filling one in.
    expect(regionForState(null, "Utah")).toBeNull();
    expect(regionForState(undefined, "Utah")).toBeNull();
  });
});
