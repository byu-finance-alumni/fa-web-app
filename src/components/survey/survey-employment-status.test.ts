import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  EMPLOYMENT_STATUS_OPTIONS,
  EMPLOYMENT_STATUS_PLACEHOLDERS,
  SURVEY_EMPLOYMENT_STATUS_OPTIONS,
  isEmploymentStatusPlaceholder,
} from "@/constants/dropdowns";
import { displayValue } from "./survey-screens";

/**
 * The survey is the ONE place `Unknown` must not appear (#377).
 *
 * Everywhere else — the list filter, both staff edit forms, the create form, the
 * CSV import, the export — it is a first-class employment status, because ~65
 * prod alumni hold it after Jake's 2026-08-04 cleanup. But "Unknown" is
 * meaningless as a SELF-description: offering it back to an alum just
 * re-collects the non-answer the survey exists to clear.
 *
 * The suite runs in Node with no DOM, so the option list the component renders
 * is asserted against its source rather than a mounted tree — enough to catch
 * the one regression that matters, someone "tidying" the import back to the full
 * constant.
 */

const SOURCE = readFileSync(
  resolve(process.cwd(), "src/components/survey/survey-screens.tsx"),
  "utf8",
);

describe("the survey's employment-status dropdown", () => {
  it("renders from the narrowed survey list", () => {
    expect(SOURCE).toContain("options={SURVEY_EMPLOYMENT_STATUS_OPTIONS}");
  });

  it("never renders from the full staff list", () => {
    // The regression this guards: dropping the survey list and reaching for the
    // canonical constant, which would put "Unknown" in front of every alum.
    expect(SOURCE).not.toContain("options={EMPLOYMENT_STATUS_OPTIONS}");
    expect(SOURCE).not.toMatch(/^\s*EMPLOYMENT_STATUS_OPTIONS,$/m);
  });

  it("offers every real answer, and only those", () => {
    expect([...SURVEY_EMPLOYMENT_STATUS_OPTIONS]).toEqual(
      EMPLOYMENT_STATUS_OPTIONS.filter((v) => !isEmploymentStatusPlaceholder(v)),
    );
    for (const placeholder of EMPLOYMENT_STATUS_PLACEHOLDERS) {
      expect(SURVEY_EMPLOYMENT_STATUS_OPTIONS).not.toContain(placeholder);
    }
  });
});

describe("a stored Unknown reaching the survey", () => {
  const field = { key: "profile.employment_status", label: "Employment Status", kind: "employmentStatus" as const };

  it("displays as blank rather than as a pre-selected answer (#572)", () => {
    // Only `edits` is POSTed, so blanking the DISPLAY never writes: an untouched
    // field is absent from the payload and the stored value survives.
    expect(displayValue(field, "Unknown")).toBe("");
    expect(displayValue(field, "UNKNOWN")).toBe("");
  });

  it("leaves every real status alone", () => {
    for (const value of SURVEY_EMPLOYMENT_STATUS_OPTIONS) {
      expect(displayValue(field, value)).toBe(value);
    }
    // …including a legacy off-list answer, which is a real (if vague) one.
    expect(displayValue(field, "Employed")).toBe("Employed");
  });
});
