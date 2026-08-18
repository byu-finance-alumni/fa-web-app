import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { formatResidenceLocation, isUnitedStates } from "./residence";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

/**
 * "Residence Location" on the alumnus profile — the owner's ask: the residence
 * is only ever a city and a state, so print it as ONE line ("Provo, Utah")
 * instead of a field each. The three columns behind it are `contact.city`,
 * `contact.state` and `contact.country`.
 */
describe("formatResidenceLocation", () => {
  it("joins city and state with a comma", () => {
    expect(formatResidenceLocation("Provo", "Utah", null)).toBe("Provo, Utah");
  });

  it("shows a lone city with no dangling comma", () => {
    expect(formatResidenceLocation("Provo", null, null)).toBe("Provo");
    expect(formatResidenceLocation("Provo", "", "")).toBe("Provo");
  });

  it("shows a lone state with no leading comma", () => {
    expect(formatResidenceLocation(null, "Utah", null)).toBe("Utah");
    expect(formatResidenceLocation("", "Utah", undefined)).toBe("Utah");
  });

  it("returns null when nothing is on file, so the field renders an em-dash", () => {
    expect(formatResidenceLocation(null, null, null)).toBeNull();
    expect(formatResidenceLocation(undefined, undefined, undefined)).toBeNull();
    // A US-only row has no international information to add, so it is still
    // empty — never the bare word "United States".
    expect(formatResidenceLocation(null, null, "United States")).toBeNull();
  });

  it("omits the country when it is the United States, however it is spelled", () => {
    for (const country of [
      "United States",
      "united states",
      "  UNITED STATES  ",
      "USA",
      "usa",
      "U.S.A.",
      "US",
      "us",
      "United States of America",
      "america",
    ]) {
      expect(formatResidenceLocation("Provo", "Utah", country)).toBe(
        "Provo, Utah",
      );
    }
  });

  it("appends a genuinely foreign country so an international alum reads right", () => {
    expect(formatResidenceLocation("Toronto", "Ontario", "Canada")).toBe(
      "Toronto, Ontario, Canada",
    );
    expect(formatResidenceLocation("London", null, "United Kingdom")).toBe(
      "London, United Kingdom",
    );
    expect(formatResidenceLocation(null, null, "Japan")).toBe("Japan");
  });

  it("treats whitespace-only cells as absent", () => {
    expect(formatResidenceLocation("   ", "  ", "  ")).toBeNull();
    expect(formatResidenceLocation("   ", "Utah", "   ")).toBe("Utah");
    expect(formatResidenceLocation("Provo", "   ", "  Canada ")).toBe(
      "Provo, Canada",
    );
  });

  it("trims the values it does keep", () => {
    expect(formatResidenceLocation("  Provo ", " Utah ", null)).toBe(
      "Provo, Utah",
    );
  });
});

describe("isUnitedStates", () => {
  it("counts a blank country as domestic", () => {
    expect(isUnitedStates(null)).toBe(true);
    expect(isUnitedStates(undefined)).toBe(true);
    expect(isUnitedStates("  ")).toBe(true);
  });

  it("matches the US aliases case-insensitively", () => {
    expect(isUnitedStates("USA")).toBe(true);
    expect(isUnitedStates("us")).toBe(true);
    expect(isUnitedStates("United States of America")).toBe(true);
  });

  it("does not match anywhere else", () => {
    expect(isUnitedStates("Canada")).toBe(false);
    expect(isUnitedStates("United Kingdom")).toBe(false);
    expect(isUnitedStates("Mexico")).toBe(false);
  });
});

/**
 * Regression guard for the two fields the owner is actually looking at. The
 * residence must NEVER be fed from `alumni.home_country`, which is the country
 * of ORIGIN and is rendered separately next to citizenship.
 */
describe("the profile's Residence Location field", () => {
  const src = read("src/app/(app)/alumni/[id]/page.tsx");
  // Prettier wraps the helper call across lines; compare on a whitespace-
  // normalized copy so formatting churn never fails these guards.
  const flat = src.replace(/\s+/g, " ");

  it("renders one combined field, not a city field and a state field", () => {
    expect(src).toContain('label="Residence Location"');
    expect(src).not.toContain('label="Current city"');
    expect(src).not.toContain('label="Current state"');
    expect(src).not.toContain('label="Residence city"');
  });

  it("builds the value from the three contact columns via the helper", () => {
    expect(flat).toContain(
      "formatResidenceLocation( c?.city, c?.state, c?.country, )",
    );
  });

  it("keeps the country of ORIGIN out of the residence line", () => {
    // `alumni.home_country` is where the alum is FROM. It keeps its own field
    // next to citizenship and must never be fed into the residence helper.
    expect(flat).not.toContain("formatResidenceLocation( c?.city, c?.state, a.");
    expect(src).toContain('label="Home country / Citizenship"');
  });

  it("labels the completeness check the same way as the field", () => {
    expect(src).toContain('label: "Residence Location"');
    expect(src).not.toContain('label: "Residence city & state"');
  });

  it("keeps the employer's ZIP, and folds its country into the location line", () => {
    expect(src).toContain('label="Company ZIP"');
    // "Company country" was its own row until the employer's city/state/country
    // became one Employment Location line - keeping both would print the
    // country twice in the same panel.
    expect(src).not.toContain('label="Company country"');
  });
});
